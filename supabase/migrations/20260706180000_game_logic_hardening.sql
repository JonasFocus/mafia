-- Game logic hardening (2026-07-06 audit):
-- 1. Chameleon hints/votes must target the current round (RLS + triggers).
-- 2. Prevent duplicate round rows per game.
-- 3. Block mafia-on-mafia kills server-side.
-- 4. Host phase transitions fail loudly on wrong phase.
-- 5. start_mafia_game locks the game row (match join_game/start_game).
-- 6. Record chameleon winner + ended_at on game_over.

-- ---------------------------------------------------------------------------
-- rounds: one row per (game_id, round_number)
-- ---------------------------------------------------------------------------
create unique index if not exists rounds_game_id_round_number_key
  on public.rounds (game_id, round_number);

-- ---------------------------------------------------------------------------
-- Chameleon RLS: bind inserts to games.current_round
-- ---------------------------------------------------------------------------
drop policy if exists "hints insert by living player in hint phase" on public.hints_given;
create policy "hints insert by living player in hint phase" on public.hints_given
  for insert to authenticated with check (
    player_id = (select auth.uid())
    and exists (
      select 1 from rounds r
      join games g on g.id = r.game_id
      where r.id = round_id
        and r.round_number = g.current_round
        and public._game_status(r.game_id) = 'hint_phase'
        and public._is_alive_player(r.game_id, player_id)
    )
  );

drop policy if exists "votes insert by living player in voting phase" on public.votes;
create policy "votes insert by living player in voting phase" on public.votes
  for insert to authenticated with check (
    voter_id = (select auth.uid())
    and exists (
      select 1 from rounds r
      join games g on g.id = r.game_id
      where r.id = round_id
        and r.round_number = g.current_round
        and public._game_status(r.game_id) = 'voting'
        and public._is_alive_player(r.game_id, voter_id)
        and public._is_alive_player(r.game_id, voted_for_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Chameleon triggers: ignore stale round_id inserts
-- ---------------------------------------------------------------------------
create or replace function public.check_hints_complete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_round_number int;
  v_current_round int;
  v_active_count int;
  v_hint_count int;
begin
  select r.game_id, r.round_number into v_game_id, v_round_number
  from rounds r where r.id = new.round_id;

  select g.current_round into v_current_round
  from games g where g.id = v_game_id for update;

  if v_round_number is distinct from v_current_round then
    return new;
  end if;

  select count(*) into v_active_count
  from game_players where game_id = v_game_id and is_eliminated = false;

  select count(*) into v_hint_count from hints_given where round_id = new.round_id;

  if v_hint_count >= v_active_count then
    update games set status = 'voting' where id = v_game_id and status = 'hint_phase';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_hints_complete() from public, anon, authenticated;

create or replace function public.resolve_votes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_round_number int;
  v_current_round int;
  v_max_rounds int;
  v_active_count int;
  v_vote_count int;
  v_top_voted uuid;
  v_top_count int;
  v_tie_count int;
  v_remaining_mafia int;
  v_hint_order uuid[];
begin
  select r.game_id, r.round_number into v_game_id, v_round_number
  from rounds r where r.id = new.round_id;

  select g.current_round, g.max_rounds into v_current_round, v_max_rounds
  from games g where g.id = v_game_id for update;

  if v_round_number is distinct from v_current_round then
    return new;
  end if;

  if not exists (select 1 from games where id = v_game_id and status = 'voting') then
    return new;
  end if;

  select count(*) into v_active_count
  from game_players where game_id = v_game_id and is_eliminated = false;

  select count(*) into v_vote_count from votes where round_id = new.round_id;

  if v_vote_count < v_active_count then
    return new;
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
    if v_round_number >= v_max_rounds then
      update games set status = 'game_over', winner = 'mafia', ended_at = now() where id = v_game_id;
    else
      select array_agg(user_id order by join_order) into v_hint_order
      from game_players where game_id = v_game_id and is_eliminated = false;
      insert into rounds (game_id, round_number, hint_order)
        values (v_game_id, v_round_number + 1, v_hint_order);
      update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
    end if;
    return new;
  end if;

  update game_players set is_eliminated = true
  where game_id = v_game_id and user_id = v_top_voted;

  select count(*) into v_remaining_mafia
  from game_players where game_id = v_game_id and is_outsider = true and is_eliminated = false;

  if v_remaining_mafia = 0 then
    update games set status = 'game_over', winner = 'town', ended_at = now() where id = v_game_id;
  elsif v_round_number >= v_max_rounds then
    update games set status = 'game_over', winner = 'mafia', ended_at = now() where id = v_game_id;
  else
    select array_agg(user_id order by join_order) into v_hint_order
    from game_players where game_id = v_game_id and is_eliminated = false;
    insert into rounds (game_id, round_number, hint_order)
      values (v_game_id, v_round_number + 1, v_hint_order);
    update games set current_round = v_round_number + 1, status = 'hint_phase' where id = v_game_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.resolve_votes() from public, anon, authenticated;

-- force_advance_phase voting branch: record chameleon winner + use current_round round row
create or replace function public.force_advance_phase(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_status game_status;
  v_round_id uuid;
  v_round_number int;
  v_max_rounds int;
  v_top_voted uuid;
  v_top_count int;
  v_tie_count int;
  v_remaining_mafia int;
  v_hint_order uuid[];
begin
  select host_id, status into v_host, v_status from games where id = p_game_id for update;
  if v_host is null then raise exception 'game not found'; end if;
  if v_host <> auth.uid() then raise exception 'only the host can advance the phase'; end if;

  if v_status = 'night' then
    perform public.resolve_night(p_game_id);
  elsif v_status = 'day_vote' then
    perform public.resolve_day(p_game_id);
  elsif v_status = 'hint_phase' then
    update games set status = 'voting' where id = p_game_id and status = 'hint_phase';
    if not found then raise exception 'invalid phase for hint advance'; end if;
  elsif v_status = 'voting' then
    select g.current_round, g.max_rounds into v_round_number, v_max_rounds
    from games g where g.id = p_game_id;

    select id into v_round_id from rounds
    where game_id = p_game_id and round_number = v_round_number;

    select voted_for_id, cnt into v_top_voted, v_top_count
      from (select voted_for_id, count(*) cnt from votes where round_id = v_round_id
            group by voted_for_id order by count(*) desc limit 1) t;

    select count(*) into v_tie_count
      from (select voted_for_id from votes where round_id = v_round_id
            group by voted_for_id having count(*) = v_top_count) t2;

    update games set status = 'round_result' where id = p_game_id;

    if v_top_voted is null or v_tie_count > 1 then
      if v_round_number >= v_max_rounds then
        update games set status = 'game_over', winner = 'mafia', ended_at = now() where id = p_game_id;
      else
        select array_agg(user_id order by join_order) into v_hint_order
          from game_players where game_id = p_game_id and is_eliminated = false;
        insert into rounds (game_id, round_number, hint_order)
          values (p_game_id, v_round_number + 1, v_hint_order);
        update games set current_round = v_round_number + 1, status = 'hint_phase' where id = p_game_id;
      end if;
      return;
    end if;

    update game_players set is_eliminated = true where game_id = p_game_id and user_id = v_top_voted;

    select count(*) into v_remaining_mafia
    from game_players where game_id = p_game_id and is_outsider = true and is_eliminated = false;

    if v_remaining_mafia = 0 then
      update games set status = 'game_over', winner = 'town', ended_at = now() where id = p_game_id;
    elsif v_round_number >= v_max_rounds then
      update games set status = 'game_over', winner = 'mafia', ended_at = now() where id = p_game_id;
    else
      select array_agg(user_id order by join_order) into v_hint_order
        from game_players where game_id = p_game_id and is_eliminated = false;
      insert into rounds (game_id, round_number, hint_order)
        values (p_game_id, v_round_number + 1, v_hint_order);
      update games set current_round = v_round_number + 1, status = 'hint_phase' where id = p_game_id;
    end if;
  else
    raise exception 'cannot advance from this phase';
  end if;
end;
$$;

revoke execute on function public.force_advance_phase(uuid) from public, anon;
grant execute on function public.force_advance_phase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Mafia: block friendly-fire kills, loud host transitions, lock start
-- ---------------------------------------------------------------------------
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

  if p_action_type = 'kill' and exists (
    select 1 from game_players
    where game_id = p_game_id and user_id = p_target_id and role = 'mafia'
  ) then raise exception 'cannot kill a mafia member'; end if;

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

create or replace function public.begin_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from games where id=p_game_id and host_id=auth.uid())
    then raise exception 'only the host'; end if;
  update games set
      status='night',
      current_round = current_round + (case when status='lynch_result' then 1 else 0 end)
    where id=p_game_id and status in ('role_reveal','lynch_result');
  if not found then raise exception 'invalid phase for begin_night'; end if;
end; $$;

create or replace function public.begin_day_vote(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from games where id=p_game_id and host_id=auth.uid())
    then raise exception 'only the host'; end if;
  update games set status='day_vote' where id=p_game_id and status='day_result';
  if not found then raise exception 'invalid phase for begin_day_vote'; end if;
end; $$;

create or replace function public.start_mafia_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host uuid; v_status game_status; v_mode text; v_mafia int; v_sheriff bool; v_angel bool;
  v_n int; v_need int; v_max_mafia int; v_ids uuid[]; v_i int;
begin
  select host_id, status, game_mode, mafia_count, sheriff_enabled, angel_enabled
    into v_host, v_status, v_mode, v_mafia, v_sheriff, v_angel
  from games where id = p_game_id for update;

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

  v_max_mafia := (v_n - 1) / 2;
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
