-- Server-side game logic. These run as SECURITY DEFINER so clients never compute
-- or trust word/outsider assignment or vote tallies themselves.

-- start_game: host-only RPC. Picks the word and outsider server-side so the
-- host's own client never has to SELECT words.text to choose one.
create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_category_id uuid;
  v_word_id uuid;
  v_player_count int;
  v_outsider_id uuid;
  v_hint_order uuid[];
begin
  select host_id, category_id into v_host_id, v_category_id from games where id = p_game_id;

  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_host_id != auth.uid() then
    raise exception 'only the host can start the game';
  end if;

  select count(*) into v_player_count from game_players where game_id = p_game_id;
  if v_player_count < 4 then
    raise exception 'need at least 4 players';
  end if;
  if v_player_count > 8 then
    raise exception 'max 8 players';
  end if;

  select id into v_word_id from words where category_id = v_category_id order by random() limit 1;
  if v_word_id is null then
    raise exception 'category has no words';
  end if;

  select user_id into v_outsider_id from game_players where game_id = p_game_id order by random() limit 1;

  update game_players set is_outsider = (user_id = v_outsider_id) where game_id = p_game_id;

  select array_agg(user_id order by join_order) into v_hint_order from game_players where game_id = p_game_id;

  insert into rounds (game_id, round_number, hint_order) values (p_game_id, 1, v_hint_order);

  update games set word_id = v_word_id, status = 'hint_phase', current_round = 1 where id = p_game_id;
end;
$$;

revoke execute on function public.start_game(uuid) from public, anon;
grant execute on function public.start_game(uuid) to authenticated;

-- auto-advance hint_phase -> voting once every active player has hinted this round
create or replace function public.check_hints_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_active_count int;
  v_hint_count int;
begin
  select game_id into v_game_id from rounds where id = new.round_id;
  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_hint_count from hints_given where round_id = new.round_id;

  if v_hint_count >= v_active_count then
    update games set status = 'voting' where id = v_game_id and status = 'hint_phase';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_hints_complete() from public, anon, authenticated;

create trigger hints_given_after_insert
after insert on hints_given
for each row execute function check_hints_complete();

-- auto-resolve voting -> round_result -> (hint_phase next round | game_over)
create or replace function public.resolve_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_round_number int;
  v_max_rounds int;
  v_active_count int;
  v_vote_count int;
  v_top_voted uuid;
  v_top_count int;
  v_tie_count int;
  v_is_outsider boolean;
  v_hint_order uuid[];
begin
  select r.game_id, r.round_number into v_game_id, v_round_number from rounds r where r.id = new.round_id;
  select g.max_rounds into v_max_rounds from games g where g.id = v_game_id;

  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_vote_count from votes where round_id = new.round_id;

  if v_vote_count < v_active_count then
    return new;
  end if;

  if not exists (select 1 from games where id = v_game_id and status = 'voting') then
    return new; -- already resolved, idempotency guard
  end if;

  select voted_for_id, cnt into v_top_voted, v_top_count
  from (
    select voted_for_id, count(*) cnt
    from votes where round_id = new.round_id
    group by voted_for_id
    order by count(*) desc
    limit 1
  ) t;

  select count(*) into v_tie_count
  from (
    select voted_for_id from votes where round_id = new.round_id
    group by voted_for_id having count(*) = v_top_count
  ) t2;

  update games set status = 'round_result' where id = v_game_id;

  if v_tie_count > 1 then
    -- tie: no elimination this round (open design question, defaulted)
    if v_round_number >= v_max_rounds then
      update games set status = 'game_over' where id = v_game_id;
    else
      select array_agg(user_id order by join_order) into v_hint_order
      from game_players where game_id = v_game_id and is_eliminated = false;
      insert into rounds (game_id, round_number, hint_order) values (v_game_id, v_round_number + 1, v_hint_order);
      update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
    end if;
    return new;
  end if;

  select is_outsider into v_is_outsider from game_players where game_id = v_game_id and user_id = v_top_voted;
  update game_players set is_eliminated = true where game_id = v_game_id and user_id = v_top_voted;

  if v_is_outsider then
    update games set status = 'game_over' where id = v_game_id;
  elsif v_round_number >= v_max_rounds then
    update games set status = 'game_over' where id = v_game_id;
  else
    select array_agg(user_id order by join_order) into v_hint_order
    from game_players where game_id = v_game_id and is_eliminated = false;
    insert into rounds (game_id, round_number, hint_order) values (v_game_id, v_round_number + 1, v_hint_order);
    update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.resolve_votes() from public, anon, authenticated;

create trigger votes_after_insert
after insert on votes
for each row execute function resolve_votes();

-- Reveal word + roles to everyone (including the Outsider) once the game ends.
drop policy "words readable by non-outsider players post-reveal" on words;

create policy "words readable per game phase" on words
  for select to authenticated using (
    exists (
      select 1
      from games g
      join game_players gp on gp.game_id = g.id
      where g.word_id = words.id
        and gp.user_id = (select auth.uid())
        and (
          (gp.is_outsider = false and g.status != 'lobby')
          or g.status = 'game_over'
        )
    )
  );

create or replace view game_players_public with (security_invoker = true) as
select
  gp.id,
  gp.game_id,
  gp.user_id,
  gp.is_eliminated,
  gp.join_order,
  gp.joined_at,
  case
    when gp.user_id = (select auth.uid()) then gp.is_outsider
    when g.status = 'game_over' then gp.is_outsider
    else null
  end as is_outsider
from game_players gp
join games g on g.id = gp.game_id;
