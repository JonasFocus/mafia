-- Test helpers. Flow tests run as postgres (definer RPCs check auth.uid() via
-- the request.jwt.claim.sub GUC); RLS tests SET ROLE authenticated explicitly.
create schema if not exists test;
grant usage on schema test to authenticated, anon;

create or replace function test.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'ASSERT FAIL: %', p_msg;
  end if;
end $$;
grant execute on function test.ok(boolean, text) to authenticated;

create or replace function test.act(p_uid uuid) returns void
language sql as $$
  select set_config('request.jwt.claim.sub', p_uid::text, false);
$$;
grant execute on function test.act(uuid) to authenticated;

create or replace function test.mk_user(p_name text) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into auth.users default values returning id into v_id;
  insert into public.users (id, display_name) values (v_id, p_name);
  return v_id;
end $$;

-- Creates a lobby + joins n players through the real join_game RPC.
-- uids[1] is the host. Chameleon games pick the first seeded category.
create or replace function test.new_game(
  p_mode text, p_n int, p_mafia int default 1,
  p_sheriff boolean default true, p_angel boolean default true)
returns table (game_id uuid, uids uuid[])
language plpgsql as $$
declare v_game uuid; v_uids uuid[] := '{}'; v_uid uuid; v_cat uuid; i int;
begin
  select c.id into v_cat from categories c join words w on w.category_id = c.id limit 1;
  for i in 1..p_n loop
    v_uids := v_uids || test.mk_user('p' || i);
  end loop;
  insert into games (room_code, host_id, category_id, game_mode, mafia_count, sheriff_enabled, angel_enabled)
  values (upper(substr(md5(random()::text), 1, 6)), v_uids[1], v_cat, p_mode, p_mafia, p_sheriff, p_angel)
  returning id into v_game;
  foreach v_uid in array v_uids loop
    perform test.act(v_uid);
    perform public.join_game((select g.room_code from games g where g.id = v_game));
  end loop;
  return query select v_game, v_uids;
end $$;

create or replace function test.status(p_game uuid) returns game_status
language sql as $$ select status from games where id = p_game $$;

create or replace function test.round(p_game uuid) returns int
language sql as $$ select current_round from games where id = p_game $$;

create or replace function test.living(p_game uuid, p_role player_role default null)
returns uuid[] language sql as $$
  select coalesce(array_agg(user_id order by join_order), '{}')
  from game_players
  where game_id = p_game and is_eliminated = false
    and (p_role is null or role = p_role);
$$;

create or replace function test.living_not(p_game uuid, p_role player_role)
returns uuid[] language sql as $$
  select coalesce(array_agg(user_id order by join_order), '{}')
  from game_players
  where game_id = p_game and is_eliminated = false and role <> p_role;
$$;

create or replace function test.role_of(p_game uuid, p_uid uuid) returns player_role
language sql as $$ select role from game_players where game_id = p_game and user_id = p_uid $$;

create or replace function test.kill(p_game uuid, p_actor uuid, p_target uuid) returns void
language plpgsql as $$
begin
  perform test.act(p_actor);
  perform public.submit_night_action(p_game, 'kill', p_target);
end $$;

create or replace function test.inspect(p_game uuid, p_actor uuid, p_target uuid) returns void
language plpgsql as $$
begin
  perform test.act(p_actor);
  perform public.submit_night_action(p_game, 'inspect', p_target);
end $$;

create or replace function test.protect(p_game uuid, p_actor uuid, p_target uuid) returns void
language plpgsql as $$
begin
  perform test.act(p_actor);
  perform public.submit_night_action(p_game, 'protect', p_target);
end $$;

create or replace function test.vote(p_game uuid, p_voter uuid, p_target uuid) returns void
language plpgsql as $$
begin
  perform test.act(p_voter);
  perform public.cast_day_vote(p_game, p_target);
end $$;

-- Runs one full night with a deterministic strategy; returns the kill target.
-- All mafia kill the first living non-mafia; sheriff (if alive) inspects the
-- first living player who isn't themselves; angel (if alive) protects the kill
-- target when p_save, else themselves.
create or replace function test.play_night(p_game uuid, p_save boolean) returns uuid
language plpgsql as $$
declare
  v_mafia uuid[] := test.living(p_game, 'mafia');
  v_target uuid; v_sheriff uuid; v_angel uuid; v_m uuid; v_insp uuid;
  v_sheriff_on bool; v_angel_on bool;
begin
  select sheriff_enabled, angel_enabled into v_sheriff_on, v_angel_on from games where id = p_game;
  v_target := (test.living_not(p_game, 'mafia'))[1];
  foreach v_m in array v_mafia loop
    perform test.kill(p_game, v_m, v_target);
  end loop;
  if v_sheriff_on then
    v_sheriff := (test.living(p_game, 'sheriff'))[1];
    if v_sheriff is not null then
      v_insp := (select u from unnest(test.living(p_game)) u where u <> v_sheriff limit 1);
      perform test.inspect(p_game, v_sheriff, v_insp);
      perform test.ok(
        (select result from night_actions
          where game_id = p_game and actor_id = v_sheriff and action_type = 'inspect'
            and round_number = test.round(p_game))
        = (case when test.role_of(p_game, v_insp) = 'mafia' then 'mafia' else 'not_mafia' end),
        'inspect result matches target role');
    end if;
  end if;
  if v_angel_on then
    v_angel := (test.living(p_game, 'angel'))[1];
    if v_angel is not null then
      perform test.protect(p_game, v_angel, case when p_save then v_target else v_angel end);
    end if;
  end if;
  return v_target;
end $$;
