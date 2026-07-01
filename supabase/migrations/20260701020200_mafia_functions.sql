-- Mafia mode: SECURITY DEFINER engine functions.
-- All host/role/phase/alive/target checks are enforced server-side; the client is never trusted.
-- Resolution is chained inside the submit/cast functions (no triggers on the new tables),
-- and serialized with a `for update` lock on the games row to prevent double-resolution races.

-- Win check: 'town' when 0 living mafia; 'mafia' when living_mafia >= living_non_mafia; else null.
create or replace function public._mafia_win_check(p_game_id uuid)
returns text language sql security definer set search_path = public as $$
  with alive as (
    select role from game_players
    where game_id = p_game_id and is_eliminated = false and role is not null
  )
  select case
    when (select count(*) from alive where role='mafia') = 0 then 'town'
    when (select count(*) from alive where role='mafia')
         >= (select count(*) from alive where role<>'mafia') then 'mafia'
    else null
  end;
$$;
revoke execute on function public._mafia_win_check(uuid) from public, anon, authenticated;

-- start_mafia_game (host-only): validate counts, randomly assign roles, go to role_reveal.
create or replace function public.start_mafia_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host uuid; v_status game_status; v_mafia int; v_sheriff bool; v_angel bool;
  v_n int; v_need int; v_max_mafia int; v_ids uuid[]; v_i int;
begin
  select host_id, status, mafia_count, sheriff_enabled, angel_enabled
    into v_host, v_status, v_mafia, v_sheriff, v_angel from games where id = p_game_id;
  if v_host is null then raise exception 'game not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can start'; end if;
  if v_status <> 'lobby' then raise exception 'game already started'; end if;

  select count(*) into v_n from game_players where game_id = p_game_id;
  if v_n < 5 then raise exception 'mafia needs at least 5 players'; end if;

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

  update games set status='role_reveal', current_round=1, game_mode='mafia', winner=null, ended_at=null
    where id=p_game_id;
end; $$;
revoke execute on function public.start_mafia_game(uuid) from public, anon;
grant execute on function public.start_mafia_game(uuid) to authenticated;

-- Phase helpers (host-only), guarded on the current status.
create or replace function public.begin_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from games where id=p_game_id and host_id=auth.uid())
    then raise exception 'only the host'; end if;
  update games set status='night'
    where id=p_game_id and status in ('role_reveal','day_result');
end; $$;
revoke execute on function public.begin_night(uuid) from public, anon;
grant execute on function public.begin_night(uuid) to authenticated;

create or replace function public.begin_day_vote(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from games where id=p_game_id and host_id=auth.uid())
    then raise exception 'only the host'; end if;
  update games set status='day_vote' where id=p_game_id and status='day_result';
end; $$;
revoke execute on function public.begin_day_vote(uuid) from public, anon;
grant execute on function public.begin_day_vote(uuid) to authenticated;

-- resolve_night: locks the game row and re-checks phase (race guard), picks the plurality
-- kill target (random tiebreak), spares it if any protector protected it, then win-checks.
create or replace function public.resolve_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_target uuid; v_winner text;
begin
  select current_round into v_round from games
    where id=p_game_id and status='night' for update;
  if v_round is null then return; end if;  -- already resolved or not night

  select target_id into v_target from (
    select target_id, count(*) cnt from night_actions
    where game_id=p_game_id and round_number=v_round and action_type='kill'
    group by target_id order by count(*) desc, random() limit 1) t;

  -- kill unless the target was protected (set-membership; supports any number of protectors)
  if v_target is not null and not exists (
    select 1 from night_actions
    where game_id=p_game_id and round_number=v_round
      and action_type='protect' and target_id=v_target
  ) then
    update game_players set is_eliminated=true
      where game_id=p_game_id and user_id=v_target;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update games set status='game_over', winner=v_winner, ended_at=now() where id=p_game_id;
  else
    update games set status='day_result' where id=p_game_id;
  end if;
end; $$;
revoke execute on function public.resolve_night(uuid) from public, anon, authenticated;

-- _maybe_resolve_night: resolves once every required living actor has submitted
-- (each living mafia has a kill; living sheriff has an inspect if enabled; living angel
-- has a protect if enabled).
create or replace function public._maybe_resolve_night(p_game_id uuid, p_round int)
returns void language plpgsql security definer set search_path=public as $$
declare v_sheriff bool; v_angel bool;
  v_live_mafia int; v_kills int;
  v_need_inspect int; v_have_inspect int;
  v_need_protect int; v_have_protect int;
begin
  select sheriff_enabled, angel_enabled into v_sheriff, v_angel from games where id=p_game_id;

  select count(*) into v_live_mafia from game_players
    where game_id=p_game_id and role='mafia' and is_eliminated=false;
  select count(distinct actor_id) into v_kills from night_actions
    where game_id=p_game_id and round_number=p_round and action_type='kill';

  select count(*) into v_need_inspect from game_players
    where game_id=p_game_id and role='sheriff' and is_eliminated=false and v_sheriff;
  select count(distinct actor_id) into v_have_inspect from night_actions
    where game_id=p_game_id and round_number=p_round and action_type='inspect';

  select count(*) into v_need_protect from game_players
    where game_id=p_game_id and role='angel' and is_eliminated=false and v_angel;
  select count(distinct actor_id) into v_have_protect from night_actions
    where game_id=p_game_id and round_number=p_round and action_type='protect';

  if v_kills >= v_live_mafia
     and v_have_inspect >= v_need_inspect
     and v_have_protect >= v_need_protect then
    perform public.resolve_night(p_game_id);
  end if;
end; $$;
revoke execute on function public._maybe_resolve_night(uuid,int) from public, anon, authenticated;

-- submit_night_action: validates phase/role/target; stores the inspect alignment result;
-- upserts the action; then attempts resolution. Locks the game row so the round number and
-- completeness check are consistent under client retries and concurrent submits.
create or replace function public.submit_night_action(
  p_game_id uuid, p_action_type night_action_type, p_target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_role player_role; v_result text;
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

-- resolve_day: locks the game row and re-checks phase, tallies day votes, lynches the top
-- target (tie -> no lynch), then win-checks and advances to the next night or game_over.
create or replace function public.resolve_day(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_target uuid; v_top int; v_ties int; v_winner text;
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
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update games set status='game_over', winner=v_winner, ended_at=now() where id=p_game_id;
  else
    update games set current_round=v_round+1, status='night' where id=p_game_id;
  end if;
end; $$;
revoke execute on function public.resolve_day(uuid) from public, anon, authenticated;

-- cast_day_vote: validates phase/alive/target; upserts the ballot; resolves when all living vote.
create or replace function public.cast_day_vote(p_game_id uuid, p_target_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_alive int; v_cast int;
begin
  select current_round into v_round from games
    where id=p_game_id and status='day_vote' for update;
  if v_round is null then raise exception 'not day vote phase'; end if;

  if not exists (select 1 from game_players
    where game_id=p_game_id and user_id=auth.uid() and is_eliminated=false)
    then raise exception 'not an active player'; end if;
  if not exists (select 1 from game_players
    where game_id=p_game_id and user_id=p_target_id and is_eliminated=false)
    then raise exception 'invalid target'; end if;

  insert into day_votes(game_id,round_number,voter_id,target_id)
  values (p_game_id,v_round,auth.uid(),p_target_id)
  on conflict (game_id,round_number,voter_id)
  do update set target_id=excluded.target_id, created_at=now();

  select count(*) into v_alive from game_players
    where game_id=p_game_id and is_eliminated=false;
  select count(*) into v_cast from day_votes
    where game_id=p_game_id and round_number=v_round;
  if v_cast >= v_alive then perform public.resolve_day(p_game_id); end if;
end; $$;
revoke execute on function public.cast_day_vote(uuid,uuid) from public, anon;
grant execute on function public.cast_day_vote(uuid,uuid) to authenticated;
