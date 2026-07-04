-- Mafia hardening + big games, part 2/2 (functions).
-- Requires 20260704100000_big_games_and_hardening_ddl.sql (lynch_result enum
-- value, last_lynch_victim column, widened mafia_count).

-- join_game: per-mode capacity (mafia parties can be much larger than a
-- chameleon table). Keeps the re-entry-before-status-check order from
-- 20260701191437 so an existing player can reload into a running game.
create or replace function public.join_game(p_room_code text)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_count int;
  v_cap int;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You need a session to join' using errcode = '28000';
  end if;

  select * into v_game from games g where g.room_code = upper(p_room_code) limit 1;
  if not found then
    raise exception 'Room not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from game_players gp where gp.game_id = v_game.id and gp.user_id = v_uid) then
    return query select v_game.id, v_game.room_code, v_game.game_mode;
    return;
  end if;

  if v_game.status <> 'lobby' then
    raise exception 'This game has already started' using errcode = 'P0001';
  end if;

  v_cap := case when v_game.game_mode = 'mafia' then 25 else 8 end;
  select count(*)::int into v_count from game_players gp where gp.game_id = v_game.id;
  if v_count >= v_cap then
    raise exception 'This room is full' using errcode = 'P0001';
  end if;

  insert into game_players (game_id, user_id, join_order)
  values (v_game.id, v_uid, v_count);

  return query select v_game.id, v_game.room_code, v_game.game_mode;
end;
$$;

-- start_mafia_game: now refuses non-mafia lobbies (it used to silently convert
-- the game_mode, desyncing clients that had already mounted the other mode's
-- component) and enforces the 25-player ceiling server-side.
create or replace function public.start_mafia_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host uuid; v_status game_status; v_mode text; v_mafia int; v_sheriff bool; v_angel bool;
  v_n int; v_need int; v_max_mafia int; v_ids uuid[]; v_i int;
begin
  select host_id, status, game_mode, mafia_count, sheriff_enabled, angel_enabled
    into v_host, v_status, v_mode, v_mafia, v_sheriff, v_angel from games where id = p_game_id;
  if v_host is null then raise exception 'game not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can start'; end if;
  if v_status <> 'lobby' then raise exception 'game already started'; end if;
  if v_mode <> 'mafia' then raise exception 'not a mafia game'; end if;

  select count(*) into v_n from game_players where game_id = p_game_id;
  if v_n < 5 then raise exception 'mafia needs at least 5 players'; end if;
  if v_n > 25 then raise exception 'max 25 players'; end if;

  v_need := v_mafia + (case when v_sheriff then 1 else 0 end)
                    + (case when v_angel then 1 else 0 end) + 1;
  if v_n < v_need then raise exception 'not enough players for selected roles'; end if;

  v_max_mafia := (v_n - 1) / 2;   -- floor: town starts as strict majority
  if v_mafia > v_max_mafia then raise exception 'too many mafia'; end if;

  select array_agg(user_id order by random()) into v_ids
    from game_players where game_id = p_game_id;

  update game_players set role = 'faithful', is_eliminated = false where game_id = p_game_id;
  update game_players set role = 'mafia'
    where game_id = p_game_id and user_id = any(v_ids[1:v_mafia]);
  v_i := v_mafia + 1;
  if v_sheriff then
    update game_players set role='sheriff' where game_id=p_game_id and user_id=v_ids[v_i];
    v_i := v_i + 1;
  end if;
  if v_angel then
    update game_players set role='angel' where game_id=p_game_id and user_id=v_ids[v_i];
  end if;

  update games set status='role_reveal', current_round=1, winner=null, ended_at=null,
      last_night_victim=null, last_lynch_victim=null
    where id=p_game_id;
end; $$;

-- start_game (chameleon): same mode guard in the other direction.
-- Body otherwise identical to 20260701180002_chameleon_multi_impostor.
create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_category_id uuid;
  v_mode text;
  v_word_id uuid;
  v_player_count int;
  v_mafia_count int;
  v_max_mafia int;
  v_hint_order uuid[];
begin
  select host_id, category_id, game_mode, mafia_count
    into v_host_id, v_category_id, v_mode, v_mafia_count from games where id = p_game_id;

  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_host_id != auth.uid() then
    raise exception 'only the host can start the game';
  end if;
  if v_mode <> 'chameleon' then
    raise exception 'not a chameleon game';
  end if;

  select count(*) into v_player_count from game_players where game_id = p_game_id;
  if v_player_count < 4 then
    raise exception 'need at least 4 players';
  end if;
  if v_player_count > 8 then
    raise exception 'max 8 players';
  end if;

  v_max_mafia := (v_player_count - 1) / 2;
  if v_mafia_count > v_max_mafia then
    raise exception 'too many mafia for % players (max %)', v_player_count, v_max_mafia;
  end if;

  select id into v_word_id from words where category_id = v_category_id order by random() limit 1;
  if v_word_id is null then
    raise exception 'category has no words';
  end if;

  update game_players set is_outsider = false where game_id = p_game_id;
  update game_players set is_outsider = true where id in (
    select id from game_players where game_id = p_game_id order by random() limit v_mafia_count
  );

  select array_agg(user_id order by join_order) into v_hint_order from game_players where game_id = p_game_id;

  insert into rounds (game_id, round_number, hint_order) values (p_game_id, 1, v_hint_order);

  update games set word_id = v_word_id, status = 'hint_phase', current_round = 1 where id = p_game_id;
end;
$$;

-- begin_night: previously also accepted day_result, which skipped resolve_day's
-- round increment and re-entered night on the SAME round number — the previous
-- night's actions were still on that round, so _maybe_resolve_night fired after
-- the first submission and resolve_night replayed the old kill. Now the only
-- post-day entry point is lynch_result, and the round increments here.
create or replace function public.begin_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from games where id=p_game_id and host_id=auth.uid())
    then raise exception 'only the host'; end if;
  update games set
      status='night',
      current_round = current_round + (case when status='lynch_result' then 1 else 0 end)
    where id=p_game_id and status in ('role_reveal','lynch_result');
end; $$;

-- resolve_day: instead of jumping straight into the next night (nobody ever saw
-- who was voted out), land on lynch_result with the outcome recorded. The host
-- advances to night from there (begin_night), which now owns the round bump.
create or replace function public.resolve_day(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_target uuid; v_top int; v_ties int; v_winner text; v_lynched boolean := false;
begin
  select current_round into v_round from games
    where id=p_game_id and status='day_vote' for update;
  if v_round is null then return; end if;  -- already resolved

  select target_id, cnt into v_target, v_top from (
    select target_id, count(*) cnt from day_votes
    where game_id=p_game_id and round_number=v_round
    group by target_id order by count(*) desc limit 1) t;

  select count(*) into v_ties from (
    select target_id from day_votes
    where game_id=p_game_id and round_number=v_round
    group by target_id having count(*)=v_top) x;

  if v_ties = 1 then  -- no lynch on tie
    update game_players set is_eliminated=true
      where game_id=p_game_id and user_id=v_target;
    v_lynched := true;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update games set status='game_over', winner=v_winner, ended_at=now(),
        last_lynch_victim = case when v_lynched then v_target end
      where id=p_game_id;
  else
    update games set status='lynch_result',
        last_lynch_victim = case when v_lynched then v_target end
      where id=p_game_id;
  end if;
end; $$;
revoke execute on function public.resolve_day(uuid) from public, anon, authenticated;

-- submit_night_action: the upsert let a sheriff re-target after reading the
-- stored inspect result — inspecting the whole table in one night from a REST
-- console. Kill/protect re-targeting stays (mafia coordination is a feature and
-- the angel learns nothing), but an inspect is locked to its first target;
-- re-submitting the SAME target stays idempotent so client retries are safe.
create or replace function public.submit_night_action(
  p_game_id uuid, p_action_type night_action_type, p_target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_role player_role; v_result text; v_prev_target uuid;
begin
  select current_round into v_round from games
    where id=p_game_id and status='night' for update;
  if v_round is null then raise exception 'not night phase'; end if;

  select role into v_role from game_players
    where game_id=p_game_id and user_id=auth.uid() and is_eliminated=false;
  if v_role is null then raise exception 'not an active player'; end if;

  if (p_action_type='kill' and v_role<>'mafia')
     or (p_action_type='inspect' and v_role<>'sheriff')
     or (p_action_type='protect' and v_role<>'angel')
  then raise exception 'role cannot perform this action'; end if;

  if not exists (select 1 from game_players
    where game_id=p_game_id and user_id=p_target_id and is_eliminated=false)
  then raise exception 'invalid target'; end if;

  if p_action_type='inspect' then
    select target_id into v_prev_target from night_actions
      where game_id=p_game_id and round_number=v_round
        and actor_id=auth.uid() and action_type='inspect';
    if v_prev_target is not null and v_prev_target <> p_target_id then
      raise exception 'inspection already locked in tonight';
    end if;
    select case when role='mafia' then 'mafia' else 'not_mafia' end into v_result
      from game_players where game_id=p_game_id and user_id=p_target_id;
  end if;

  insert into night_actions(game_id,round_number,actor_id,action_type,target_id,result)
  values (p_game_id,v_round,auth.uid(),p_action_type,p_target_id,v_result)
  on conflict (game_id,round_number,actor_id,action_type)
  do update set target_id=excluded.target_id, result=excluded.result, created_at=now();

  perform public._maybe_resolve_night(p_game_id, v_round);
end; $$;
revoke execute on function public.submit_night_action(uuid,night_action_type,uuid) from public, anon;
grant execute on function public.submit_night_action(uuid,night_action_type,uuid) to authenticated;
