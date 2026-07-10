-- Production-readiness database API. Browser clients are untrusted; every
-- lifecycle mutation locks the game row and validates identity, phase, mode,
-- capacity, and target state inside the same transaction.

create or replace function private.game_error(
  p_code text,
  p_sqlstate text default 'P0001'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = p_sqlstate, message = p_code;
end;
$$;
revoke execute on function private.game_error(text, text)
  from public, anon, authenticated;

create or replace function private.is_game_participant(
  p_game_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.user_id = p_user_id
  );
$$;
revoke execute on function private.is_game_participant(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.is_alive_player(
  p_game_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id
      and gp.user_id = p_user_id
      and gp.is_eliminated = false
  );
$$;
revoke execute on function private.is_alive_player(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.phase_is_ready(
  p_game_id uuid,
  p_round_number integer,
  p_phase public.game_status
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.game_players gp where gp.game_id = p_game_id)
    > 0
    and
    (select count(*) from public.game_phase_acknowledgements a
      where a.game_id = p_game_id
        and a.round_number = p_round_number
        and a.phase = p_phase)
    >=
    (select count(*) from public.game_players gp where gp.game_id = p_game_id);
$$;
revoke execute on function private.phase_is_ready(uuid, integer, public.game_status)
  from public, anon, authenticated;

create or replace function private.maybe_cleanup_expired_games()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.maintenance_state
  set last_run_at = clock_timestamp()
  where task_name = 'game_retention'
    and last_run_at < clock_timestamp() - interval '1 hour';

  if not found then
    return;
  end if;

  delete from public.games g
  where (g.status = 'lobby'::public.game_status
         and g.created_at < clock_timestamp() - interval '6 hours')
     or (g.status = 'game_over'::public.game_status
         and g.ended_at < clock_timestamp() - interval '24 hours')
     or (g.status not in ('lobby'::public.game_status, 'game_over'::public.game_status)
         and g.expires_at < clock_timestamp());

  -- Anonymous identities have no recovery path. Remove only old identities with
  -- no remaining game/category references, so the public.users cascade is safe.
  delete from auth.users au
  where au.is_anonymous = true
    and au.created_at < clock_timestamp() - interval '7 days'
    and not exists (select 1 from public.games g where g.host_id = au.id or g.dealer_id = au.id)
    and not exists (select 1 from public.game_players gp where gp.user_id = au.id)
    and not exists (select 1 from public.categories c where c.created_by = au.id);
end;
$$;
revoke execute on function private.maybe_cleanup_expired_games()
  from public, anon, authenticated;

create or replace function private.next_room_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
           1 + floor(random() * 32)::integer, 1),
    ''
  )
  from generate_series(1, 4);
$$;
revoke execute on function private.next_room_code()
  from public, anon, authenticated;

create or replace function public.create_game(
  p_game_mode text,
  p_category_id uuid default null
)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_room_code text;
  v_attempt integer;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  if not exists (select 1 from public.users u where u.id = v_uid) then
    perform private.game_error('PROFILE_REQUIRED');
  end if;
  if p_game_mode not in ('chameleon', 'mafia') then
    perform private.game_error('INVALID_GAME_MODE');
  end if;
  if p_game_mode = 'chameleon' and not exists (
    select 1 from public.categories c where c.id = p_category_id
  ) then
    perform private.game_error('CATEGORY_REQUIRED');
  end if;

  perform private.maybe_cleanup_expired_games();

  for v_attempt in 1..32 loop
    v_room_code := private.next_room_code();
    begin
      insert into public.games (
        room_code, host_id, dealer_id, category_id, game_mode,
        mafia_count, phase_started_at, expires_at, updated_at
      ) values (
        v_room_code, v_uid, v_uid,
        case when p_game_mode = 'mafia' then null else p_category_id end,
        p_game_mode, 1, clock_timestamp(),
        clock_timestamp() + interval '6 hours', clock_timestamp()
      ) returning * into v_game;
      exit;
    exception when unique_violation then
      if v_attempt = 32 then
        perform private.game_error('ROOM_CODE_EXHAUSTED');
      end if;
    end;
  end loop;

  insert into public.game_players (
    game_id, user_id, join_order, last_seen_at
  ) values (v_game.id, v_uid, 0, clock_timestamp());

  return query select v_game.id, v_game.room_code, v_game.game_mode;
end;
$$;
revoke execute on function public.create_game(text, uuid) from public, anon;
grant execute on function public.create_game(text, uuid) to authenticated;

create or replace function public.join_game(p_room_code text)
returns table (id uuid, room_code text, game_mode text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_count integer;
  v_cap integer;
  v_join_order integer;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;

  select * into v_game
  from public.games g
  where g.room_code = upper(trim(p_room_code))
  for update;

  if not found then
    perform private.game_error('ROOM_NOT_FOUND', 'P0002');
  end if;
  if v_game.expires_at < clock_timestamp() then
    perform private.game_error('ROOM_EXPIRED');
  end if;

  if exists (
    select 1 from public.game_players gp
    where gp.game_id = v_game.id and gp.user_id = v_uid
  ) then
    update public.game_players
    set last_seen_at = clock_timestamp()
    where game_id = v_game.id and user_id = v_uid;
    return query select v_game.id, v_game.room_code, v_game.game_mode;
    return;
  end if;

  if v_game.status <> 'lobby'::public.game_status then
    perform private.game_error('GAME_ALREADY_STARTED');
  end if;

  v_cap := case when v_game.game_mode = 'mafia' then 25 else 8 end;
  select count(*), coalesce(max(gp.join_order), -1) + 1
    into v_count, v_join_order
  from public.game_players gp
  where gp.game_id = v_game.id;

  if v_count >= v_cap then
    perform private.game_error('ROOM_FULL');
  end if;

  insert into public.game_players (
    game_id, user_id, join_order, last_seen_at
  ) values (v_game.id, v_uid, v_join_order, clock_timestamp());

  update public.games
  set updated_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '6 hours'
  where games.id = v_game.id;

  return query select v_game.id, v_game.room_code, v_game.game_mode;
end;
$$;
revoke execute on function public.join_game(text) from public, anon;
grant execute on function public.join_game(text) to authenticated;

create or replace function public.leave_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_next_host uuid;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;

  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_game.status <> 'lobby'::public.game_status then
    perform private.game_error('LEAVE_NOT_ALLOWED_AFTER_START');
  end if;
  if not private.is_game_participant(p_game_id, v_uid) then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;

  delete from public.game_players
  where game_id = p_game_id and user_id = v_uid;

  select gp.user_id into v_next_host
  from public.game_players gp
  where gp.game_id = p_game_id
  order by gp.join_order
  limit 1;

  if v_next_host is null then
    delete from public.games where games.id = p_game_id;
  elsif v_uid in (v_game.host_id, v_game.dealer_id) then
    update public.games
    set host_id = v_next_host,
        dealer_id = v_next_host,
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games set updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
end;
$$;
revoke execute on function public.leave_game(uuid) from public, anon;
grant execute on function public.leave_game(uuid) to authenticated;

create or replace function public.update_game_settings(
  p_game_id uuid,
  p_category_id uuid default null,
  p_mafia_count integer default null,
  p_show_categories boolean default null,
  p_sheriff_enabled boolean default null,
  p_angel_enabled boolean default null,
  p_reveal_role_on_death boolean default null,
  p_max_rounds integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_category uuid;
  v_mafia_count integer;
  v_max_rounds integer;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    perform private.game_error('ONLY_ROOM_HOST', '42501');
  end if;
  if v_game.status <> 'lobby'::public.game_status then
    perform private.game_error('SETTINGS_LOCKED');
  end if;

  v_category := case
    when v_game.game_mode = 'mafia' then null
    else coalesce(p_category_id, v_game.category_id)
  end;
  if v_game.game_mode = 'chameleon' and not exists (
    select 1 from public.categories c where c.id = v_category
  ) then
    perform private.game_error('CATEGORY_REQUIRED');
  end if;

  v_mafia_count := case
    when v_game.game_mode = 'chameleon' then 1
    else coalesce(p_mafia_count, v_game.mafia_count)
  end;
  if v_mafia_count not between 1 and 8 then
    perform private.game_error('INVALID_MAFIA_COUNT');
  end if;

  v_max_rounds := coalesce(p_max_rounds, v_game.max_rounds);
  if v_max_rounds not between 1 and 10 then
    perform private.game_error('INVALID_MAX_ROUNDS');
  end if;

  update public.games
  set category_id = v_category,
      mafia_count = v_mafia_count,
      show_categories = coalesce(p_show_categories, show_categories),
      sheriff_enabled = coalesce(p_sheriff_enabled, sheriff_enabled),
      angel_enabled = coalesce(p_angel_enabled, angel_enabled),
      reveal_role_on_death = coalesce(p_reveal_role_on_death, reveal_role_on_death),
      max_rounds = v_max_rounds,
      updated_at = clock_timestamp()
  where games.id = p_game_id;
end;
$$;
revoke execute on function public.update_game_settings(
  uuid, uuid, integer, boolean, boolean, boolean, boolean, integer
) from public, anon;
grant execute on function public.update_game_settings(
  uuid, uuid, integer, boolean, boolean, boolean, boolean, integer
) to authenticated;

create or replace function public.close_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    perform private.game_error('ONLY_ROOM_HOST', '42501');
  end if;
  if v_game.status not in ('lobby'::public.game_status, 'game_over'::public.game_status) then
    perform private.game_error('CLOSE_NOT_ALLOWED_DURING_GAME');
  end if;
  delete from public.games where games.id = p_game_id;
end;
$$;
revoke execute on function public.close_game(uuid) from public, anon;
grant execute on function public.close_game(uuid) to authenticated;

create or replace function public.reset_game_for_rematch(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    perform private.game_error('ONLY_ROOM_HOST', '42501');
  end if;
  if v_game.status <> 'game_over'::public.game_status then
    perform private.game_error('REMATCH_REQUIRES_GAME_OVER');
  end if;

  delete from public.rounds where game_id = p_game_id;
  delete from public.night_actions where game_id = p_game_id;
  delete from public.day_votes where game_id = p_game_id;
  delete from public.game_phase_acknowledgements where game_id = p_game_id;
  delete from public.game_secrets where game_id = p_game_id;

  update public.game_players
  set is_outsider = false,
      is_eliminated = false,
      role = null,
      last_seen_at = clock_timestamp()
  where game_id = p_game_id;

  update public.games
  set host_id = v_uid,
      dealer_id = v_uid,
      word_id = null,
      status = 'lobby',
      current_round = 0,
      winner = null,
      ended_at = null,
      last_night_victim = null,
      last_lynch_victim = null,
      chameleon_vote_stage = 1,
      chameleon_tied_player_ids = '{}',
      chameleon_caught_id = null,
      phase_started_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '6 hours',
      updated_at = clock_timestamp()
  where games.id = p_game_id;
end;
$$;
revoke execute on function public.reset_game_for_rematch(uuid) from public, anon;
grant execute on function public.reset_game_for_rematch(uuid) to authenticated;

create or replace function public.heartbeat_game(p_game_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  perform 1 from public.games g where g.id = p_game_id;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  update public.game_players
  set last_seen_at = v_now
  where game_id = p_game_id and user_id = v_uid;
  if not found then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;
  return v_now;
end;
$$;
revoke execute on function public.heartbeat_game(uuid) from public, anon;
grant execute on function public.heartbeat_game(uuid) to authenticated;

create or replace function public.claim_room_host(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_host_seen timestamptz;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if not private.is_game_participant(p_game_id, v_uid) then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;
  if v_game.status not in ('lobby'::public.game_status, 'game_over'::public.game_status) then
    perform private.game_error('HOST_CLAIM_NOT_ALLOWED_DURING_GAME');
  end if;

  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;

  if coalesce(v_game.dealer_id, v_game.host_id) = v_uid then
    return v_uid;
  end if;

  select gp.last_seen_at into v_host_seen
  from public.game_players gp
  where gp.game_id = p_game_id
    and gp.user_id = coalesce(v_game.dealer_id, v_game.host_id);

  if v_host_seen is not null
     and v_host_seen >= clock_timestamp() - interval '120 seconds' then
    perform private.game_error('ROOM_HOST_ACTIVE');
  end if;

  update public.games
  set host_id = v_uid,
      dealer_id = v_uid,
      updated_at = clock_timestamp()
  where games.id = p_game_id;
  return v_uid;
end;
$$;
revoke execute on function public.claim_room_host(uuid) from public, anon;
grant execute on function public.claim_room_host(uuid) to authenticated;

drop function if exists public.list_open_games();
create function public.list_open_games()
returns table (
  room_code text,
  host_name text,
  player_count integer,
  capacity integer,
  game_mode text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.maybe_cleanup_expired_games();
  return query
  select g.room_code,
         u.display_name,
         (select count(*)::integer from public.game_players gp where gp.game_id = g.id),
         case when g.game_mode = 'mafia' then 25 else 8 end,
         g.game_mode,
         g.created_at
  from public.games g
  join public.users u on u.id = coalesce(g.dealer_id, g.host_id)
  where g.status = 'lobby'::public.game_status
    and g.created_at > clock_timestamp() - interval '6 hours'
    and g.expires_at > clock_timestamp()
  order by g.created_at desc
  limit 50;
end;
$$;
revoke execute on function public.list_open_games() from public;
grant execute on function public.list_open_games() to anon, authenticated;

-- Shared readiness transitions. A participant can advance a result/reveal phase
-- only after everybody acknowledges it or the server-side deadline has elapsed.
create or replace function public.advance_game_phase(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_deadline timestamptz;
  v_ready boolean;
  v_round_id uuid;
  v_active_count integer;
  v_vote_count integer;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if not private.is_game_participant(p_game_id, v_uid) then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;

  v_deadline := v_game.phase_started_at + interval '120 seconds';
  v_ready := case when v_game.status in (
    'role_reveal'::public.game_status,
    'day_result'::public.game_status,
    'lynch_result'::public.game_status
  ) then private.phase_is_ready(
    p_game_id, v_game.current_round, v_game.status
  ) else false end;

  if v_game.status in (
    'role_reveal'::public.game_status,
    'day_result'::public.game_status,
    'lynch_result'::public.game_status
  ) and not v_ready and clock_timestamp() < v_deadline then
    perform private.game_error('PHASE_NOT_READY');
  elsif v_game.status not in (
    'role_reveal'::public.game_status,
    'day_result'::public.game_status,
    'lynch_result'::public.game_status
  ) and clock_timestamp() < v_deadline then
    perform private.game_error('RECOVERY_NOT_AVAILABLE');
  end if;

  if v_game.status = 'role_reveal'::public.game_status then
    delete from public.game_phase_acknowledgements a
    where a.game_id = p_game_id and a.round_number = v_game.current_round
      and a.phase = v_game.status;
    update public.games
    set status = case when v_game.game_mode = 'mafia'
                      then 'night'::public.game_status
                      else 'hint_phase'::public.game_status end,
        phase_started_at = clock_timestamp(),
        expires_at = clock_timestamp() + interval '6 hours',
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'day_result'::public.game_status then
    delete from public.game_phase_acknowledgements a
    where a.game_id = p_game_id and a.round_number = v_game.current_round
      and a.phase = v_game.status;
    update public.games
    set status = 'day_vote',
        phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'lynch_result'::public.game_status then
    delete from public.game_phase_acknowledgements a
    where a.game_id = p_game_id and a.round_number = v_game.current_round
      and a.phase = v_game.status;
    update public.games
    set status = 'night',
        current_round = current_round + 1,
        phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'hint_phase'::public.game_status then
    update public.games
    set status = 'voting', chameleon_vote_stage = 1,
        chameleon_tied_player_ids = '{}',
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'voting'::public.game_status then
    select r.id into v_round_id from public.rounds r
    where r.game_id = p_game_id and r.round_number = v_game.current_round;
    select count(*) into v_active_count from public.game_players gp
    where gp.game_id = p_game_id and gp.is_eliminated = false;
    select count(*) into v_vote_count from public.votes v
    where v.round_id = v_round_id and v.vote_stage = 1;
    if v_vote_count <= v_active_count / 2 then
      update public.games
      set status = 'game_over', winner = 'chameleon',
          ended_at = clock_timestamp(), phase_started_at = clock_timestamp(),
          updated_at = clock_timestamp()
      where games.id = p_game_id;
    else
      perform private.resolve_chameleon_vote(p_game_id, true);
    end if;
  elsif v_game.status = 'chameleon_tie_break'::public.game_status then
    update public.games
    set dealer_id = v_uid, phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'chameleon_guess'::public.game_status then
    update public.games
    set status = 'game_over', winner = 'players',
        ended_at = clock_timestamp(), phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  elsif v_game.status = 'night'::public.game_status then
    perform public.resolve_night(p_game_id);
  elsif v_game.status = 'day_vote'::public.game_status then
    perform public.resolve_day(p_game_id);
  else
    perform private.game_error('PHASE_NOT_ADVANCEABLE');
  end if;
end;
$$;
revoke execute on function public.advance_game_phase(uuid) from public, anon;
grant execute on function public.advance_game_phase(uuid) to authenticated;

create or replace function public.mark_phase_ready(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if not private.is_game_participant(p_game_id, v_uid) then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;
  if v_game.status not in (
    'role_reveal'::public.game_status,
    'day_result'::public.game_status,
    'lynch_result'::public.game_status
  ) then
    perform private.game_error('PHASE_NOT_ACKNOWLEDGEABLE');
  end if;

  insert into public.game_phase_acknowledgements (
    game_id, user_id, round_number, phase, acknowledged_at
  ) values (
    p_game_id, v_uid, v_game.current_round, v_game.status, clock_timestamp()
  ) on conflict (game_id, user_id, round_number, phase)
    do update set acknowledged_at = excluded.acknowledged_at;

  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;
  update public.games set updated_at = clock_timestamp()
  where games.id = p_game_id;

  if private.phase_is_ready(p_game_id, v_game.current_round, v_game.status) then
    perform public.advance_game_phase(p_game_id);
  end if;
end;
$$;
revoke execute on function public.mark_phase_ready(uuid) from public, anon;
grant execute on function public.mark_phase_ready(uuid) to authenticated;

-- Chameleon setup keeps the answer outside participant-readable tables. Three
-- player games get two controlled guesses; larger games get one.
create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_player_count integer;
  v_word_id uuid;
  v_candidates uuid[];
  v_hint_order uuid[];
  v_guesses integer;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    perform private.game_error('ONLY_ROOM_HOST', '42501');
  end if;
  if v_game.status <> 'lobby'::public.game_status then
    perform private.game_error('GAME_ALREADY_STARTED');
  end if;
  if v_game.game_mode <> 'chameleon' then
    perform private.game_error('NOT_A_CHAMELEON_GAME');
  end if;

  select count(*) into v_player_count
  from public.game_players gp where gp.game_id = p_game_id;
  if v_player_count < 3 then
    perform private.game_error('CHAMELEON_NEEDS_THREE_PLAYERS');
  end if;
  if v_player_count > 8 then
    perform private.game_error('CHAMELEON_PLAYER_LIMIT');
  end if;

  select w.id into v_word_id
  from public.words w
  where w.category_id = v_game.category_id
  order by random()
  limit 1;
  if v_word_id is null then
    perform private.game_error('CATEGORY_HAS_NO_WORDS');
  end if;

  select array_agg(w.id order by w.text) into v_candidates
  from public.words w
  where w.category_id = v_game.category_id;
  v_guesses := case when v_player_count = 3 then 2 else 1 end;

  update public.game_players
  set is_outsider = false,
      is_eliminated = false,
      role = null
  where game_id = p_game_id;
  update public.game_players
  set is_outsider = true
  where id = (
    select gp.id from public.game_players gp
    where gp.game_id = p_game_id
    order by random()
    limit 1
  );

  select array_agg(gp.user_id order by gp.join_order) into v_hint_order
  from public.game_players gp where gp.game_id = p_game_id;
  insert into public.rounds (game_id, round_number, hint_order)
  values (p_game_id, 1, v_hint_order);

  insert into public.game_secrets (
    game_id, word_id, guess_candidate_ids, guess_attempt_ids,
    guesses_remaining, updated_at
  ) values (
    p_game_id, v_word_id, v_candidates, '{}', v_guesses, clock_timestamp()
  ) on conflict (game_id) do update
    set word_id = excluded.word_id,
        guess_candidate_ids = excluded.guess_candidate_ids,
        guess_attempt_ids = '{}',
        guesses_remaining = excluded.guesses_remaining,
        updated_at = excluded.updated_at;

  delete from public.game_phase_acknowledgements where game_id = p_game_id;
  update public.games
  set word_id = null,
      status = 'role_reveal',
      current_round = 1,
      mafia_count = 1,
      winner = null,
      ended_at = null,
      last_night_victim = null,
      last_lynch_victim = null,
      chameleon_vote_stage = 1,
      chameleon_tied_player_ids = '{}',
      chameleon_caught_id = null,
      phase_started_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '6 hours',
      updated_at = clock_timestamp()
  where games.id = p_game_id;
end;
$$;
revoke execute on function public.start_game(uuid) from public, anon;
grant execute on function public.start_game(uuid) to authenticated;

create or replace function public.check_hints_complete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
  v_round_number integer;
  v_active_count integer;
  v_hint_count integer;
begin
  select r.game_id, r.round_number into v_game_id, v_round_number
  from public.rounds r where r.id = new.round_id;
  perform 1 from public.games g
  where g.id = v_game_id
    and g.game_mode = 'chameleon'
    and g.status = 'hint_phase'::public.game_status
    and g.current_round = v_round_number
  for update;
  if not found then
    return new;
  end if;

  select count(*) into v_active_count from public.game_players gp
  where gp.game_id = v_game_id and gp.is_eliminated = false;
  select count(*) into v_hint_count from public.hints_given h
  where h.round_id = new.round_id;
  if v_hint_count >= v_active_count then
    update public.games
    set status = 'voting',
        chameleon_vote_stage = 1,
        chameleon_tied_player_ids = '{}',
        phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = v_game_id
      and status = 'hint_phase'::public.game_status;
  end if;
  return new;
end;
$$;
revoke execute on function public.check_hints_complete()
  from public, anon, authenticated;

drop policy if exists "hints insert by living player in hint phase"
  on public.hints_given;
create policy "hints insert by living player in hint phase"
  on public.hints_given for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1
      from public.rounds r
      join public.games g on g.id = r.game_id
      where r.id = round_id
        and r.round_number = g.current_round
        and g.game_mode = 'chameleon'
        and g.status = 'hint_phase'::public.game_status
        and exists (
          select 1 from public.game_players gp
          where gp.game_id = g.id
            and gp.user_id = (select auth.uid())
            and gp.is_eliminated = false
        )
    )
  );

create or replace function private.resolve_chameleon_vote(
  p_game_id uuid,
  p_allow_partial boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_round_id uuid;
  v_active_count integer;
  v_vote_count integer;
  v_top_voted uuid;
  v_top_count integer;
  v_tie_ids uuid[];
  v_is_outsider boolean;
begin
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found or v_game.game_mode <> 'chameleon' then
    return;
  end if;
  if v_game.status not in (
    'voting'::public.game_status,
    'chameleon_tie_break'::public.game_status
  ) then
    return;
  end if;

  select r.id into v_round_id from public.rounds r
  where r.game_id = p_game_id and r.round_number = v_game.current_round;
  select count(*) into v_active_count from public.game_players gp
  where gp.game_id = p_game_id and gp.is_eliminated = false;
  select count(*) into v_vote_count from public.votes v
  where v.round_id = v_round_id and v.vote_stage = v_game.chameleon_vote_stage;
  if not p_allow_partial and v_vote_count < v_active_count then
    return;
  end if;

  select ballot.voted_for_id, ballot.vote_count
  into v_top_voted, v_top_count
  from (
    select v.voted_for_id, count(*)::integer as vote_count
    from public.votes v
    where v.round_id = v_round_id
      and v.vote_stage = v_game.chameleon_vote_stage
    group by v.voted_for_id
    order by count(*) desc, v.voted_for_id
    limit 1
  ) ballot;

  if v_top_voted is null then
    update public.games
    set status = 'game_over', winner = 'chameleon', ended_at = clock_timestamp(),
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
    return;
  end if;

  select array_agg(ballot.voted_for_id order by ballot.voted_for_id)
  into v_tie_ids
  from (
    select v.voted_for_id
    from public.votes v
    where v.round_id = v_round_id
      and v.vote_stage = v_game.chameleon_vote_stage
    group by v.voted_for_id
    having count(*) = v_top_count
  ) ballot;

  if cardinality(v_tie_ids) > 1 then
    update public.games
    set status = 'chameleon_tie_break',
        chameleon_vote_stage = 2,
        chameleon_tied_player_ids = v_tie_ids,
        phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
    return;
  end if;

  select gp.is_outsider into v_is_outsider
  from public.game_players gp
  where gp.game_id = p_game_id and gp.user_id = v_top_voted;
  if v_is_outsider then
    update public.game_players set is_eliminated = true
    where game_id = p_game_id and user_id = v_top_voted;
    update public.games
    set status = 'chameleon_guess',
        chameleon_caught_id = v_top_voted,
        chameleon_tied_player_ids = '{}',
        phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games
    set status = 'game_over', winner = 'chameleon', ended_at = clock_timestamp(),
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
end;
$$;
revoke execute on function private.resolve_chameleon_vote(uuid, boolean)
  from public, anon, authenticated;

create or replace function public.cast_chameleon_vote(
  p_game_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_round_id uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_game.game_mode <> 'chameleon'
     or v_game.status <> 'voting'::public.game_status then
    perform private.game_error('NOT_CHAMELEON_VOTING');
  end if;
  if not private.is_alive_player(p_game_id, v_uid) then
    perform private.game_error('NOT_AN_ACTIVE_PLAYER', '42501');
  end if;
  if not private.is_alive_player(p_game_id, p_target_id) then
    perform private.game_error('INVALID_VOTE_TARGET');
  end if;
  select r.id into v_round_id from public.rounds r
  where r.game_id = p_game_id and r.round_number = v_game.current_round;
  insert into public.votes (
    round_id, voter_id, voted_for_id, vote_stage, cast_at
  ) values (
    v_round_id, v_uid, p_target_id, 1,
    clock_timestamp()
  ) on conflict (round_id, vote_stage, voter_id)
    do update set voted_for_id = excluded.voted_for_id,
                  cast_at = excluded.cast_at;

  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;
  update public.games set updated_at = clock_timestamp()
  where games.id = p_game_id;
  perform private.resolve_chameleon_vote(p_game_id, false);
end;
$$;
revoke execute on function public.cast_chameleon_vote(uuid, uuid)
  from public, anon;
grant execute on function public.cast_chameleon_vote(uuid, uuid)
  to authenticated;

create or replace function public.break_chameleon_tie(
  p_game_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_is_outsider boolean;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_game.game_mode <> 'chameleon'
     or v_game.status <> 'chameleon_tie_break'::public.game_status then
    perform private.game_error('NOT_CHAMELEON_TIE_BREAK');
  end if;
  if not private.is_alive_player(p_game_id, v_uid) then
    perform private.game_error('NOT_AN_ACTIVE_PLAYER', '42501');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    if clock_timestamp() < v_game.phase_started_at + interval '120 seconds' then
      perform private.game_error('ONLY_DEALER_CAN_BREAK_TIE', '42501');
    end if;
    update public.games set dealer_id = v_uid, updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
  if not p_target_id = any(v_game.chameleon_tied_player_ids)
     or not private.is_alive_player(p_game_id, p_target_id) then
    perform private.game_error('TARGET_NOT_IN_TIE_BREAK');
  end if;

  select gp.is_outsider into v_is_outsider from public.game_players gp
  where gp.game_id = p_game_id and gp.user_id = p_target_id;
  if v_is_outsider then
    update public.game_players set is_eliminated = true
    where game_id = p_game_id and user_id = p_target_id;
    update public.games
    set status = 'chameleon_guess', chameleon_caught_id = p_target_id,
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games
    set status = 'game_over', winner = 'chameleon',
        ended_at = clock_timestamp(),
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
end;
$$;
revoke execute on function public.break_chameleon_tie(uuid, uuid)
  from public, anon;
grant execute on function public.break_chameleon_tie(uuid, uuid)
  to authenticated;

-- Keep the legacy insert trigger inert for direct callers. All ballots now go
-- through cast_chameleon_vote, which also handles editable upserts.
create or replace function public.resolve_votes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_id uuid;
begin
  select r.game_id into v_game_id
  from public.rounds r where r.id = new.round_id;
  perform private.resolve_chameleon_vote(v_game_id, false);
  return new;
end;
$$;
revoke execute on function public.resolve_votes()
  from public, anon, authenticated;

create or replace function public.round_voter_ids(p_round_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select v.voter_id
  from public.votes v
  join public.rounds r on r.id = v.round_id
  join public.games g on g.id = r.game_id
  where v.round_id = p_round_id
    and v.vote_stage = g.chameleon_vote_stage
    and private.is_game_participant(g.id, auth.uid());
$$;
revoke execute on function public.round_voter_ids(uuid) from public, anon;
grant execute on function public.round_voter_ids(uuid) to authenticated;

create or replace function public.submit_chameleon_guess(
  p_game_id uuid,
  p_word_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_secret public.game_secrets%rowtype;
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_winner text;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_game.game_mode <> 'chameleon'
     or v_game.status <> 'chameleon_guess'::public.game_status then
    perform private.game_error('NOT_CHAMELEON_GUESS_PHASE');
  end if;
  if v_game.chameleon_caught_id <> v_uid then
    perform private.game_error('ONLY_CAUGHT_CHAMELEON_CAN_GUESS', '42501');
  end if;

  select * into v_secret from public.game_secrets s
  where s.game_id = p_game_id for update;
  if v_secret.guesses_remaining <= 0 then
    perform private.game_error('NO_GUESSES_REMAINING');
  end if;
  if not p_word_id = any(v_secret.guess_candidate_ids) then
    perform private.game_error('INVALID_GUESS_CANDIDATE');
  end if;
  if p_word_id = any(v_secret.guess_attempt_ids) then
    perform private.game_error('WORD_ALREADY_GUESSED');
  end if;

  v_correct := p_word_id = v_secret.word_id;
  update public.game_secrets
  set guess_attempt_ids = array_append(guess_attempt_ids, p_word_id),
      guesses_remaining = guesses_remaining - 1,
      updated_at = clock_timestamp()
  where game_id = p_game_id;

  if v_correct then
    v_winner := 'chameleon';
  elsif v_secret.guesses_remaining - 1 = 0 then
    v_winner := 'players';
  end if;

  if v_winner is not null then
    update public.games
    set status = 'game_over', winner = v_winner,
        ended_at = clock_timestamp(), phase_started_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games set updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;

  return jsonb_build_object(
    'correct', v_correct,
    'winner', v_winner,
    'guesses_remaining', v_secret.guesses_remaining - 1,
    'word_id', case when v_winner is not null then v_secret.word_id end,
    'guessed_word_id', p_word_id
  );
end;
$$;
revoke execute on function public.submit_chameleon_guess(uuid, uuid)
  from public, anon;
grant execute on function public.submit_chameleon_guess(uuid, uuid)
  to authenticated;

-- Mafia engine. Every submit/cast and resolution locks the game row so retries
-- and simultaneous devices serialize against one authoritative round state.
create or replace function public._mafia_win_check(p_game_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with alive as (
    select gp.role
    from public.game_players gp
    where gp.game_id = p_game_id
      and gp.is_eliminated = false
      and gp.role is not null
  )
  select case
    when (select count(*) from alive where role = 'mafia'::public.player_role) = 0
      then 'town'
    when (select count(*) from alive where role = 'mafia'::public.player_role)
       >= (select count(*) from alive where role <> 'mafia'::public.player_role)
      then 'mafia'
    else null
  end;
$$;
revoke execute on function public._mafia_win_check(uuid)
  from public, anon, authenticated;

create or replace function public.start_mafia_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_player_count integer;
  v_required integer;
  v_max_mafia integer;
  v_player_ids uuid[];
  v_index integer;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.id = p_game_id for update;
  if not found then
    perform private.game_error('GAME_NOT_FOUND', 'P0002');
  end if;
  if v_uid <> coalesce(v_game.dealer_id, v_game.host_id) then
    perform private.game_error('ONLY_ROOM_HOST', '42501');
  end if;
  if v_game.status <> 'lobby'::public.game_status then
    perform private.game_error('GAME_ALREADY_STARTED');
  end if;
  if v_game.game_mode <> 'mafia' then
    perform private.game_error('NOT_A_MAFIA_GAME');
  end if;

  select count(*) into v_player_count
  from public.game_players gp where gp.game_id = p_game_id;
  if v_player_count < 5 then
    perform private.game_error('MAFIA_NEEDS_FIVE_PLAYERS');
  end if;
  if v_player_count > 25 then
    perform private.game_error('MAFIA_PLAYER_LIMIT');
  end if;
  v_required := v_game.mafia_count
    + case when v_game.sheriff_enabled then 1 else 0 end
    + case when v_game.angel_enabled then 1 else 0 end
    + 1;
  if v_player_count < v_required then
    perform private.game_error('NOT_ENOUGH_PLAYERS_FOR_ROLES');
  end if;
  v_max_mafia := (v_player_count - 1) / 2;
  if v_game.mafia_count > v_max_mafia then
    perform private.game_error('TOO_MANY_MAFIA');
  end if;

  select array_agg(gp.user_id order by random()) into v_player_ids
  from public.game_players gp where gp.game_id = p_game_id;
  update public.game_players
  set role = 'faithful', is_outsider = false, is_eliminated = false
  where game_id = p_game_id;
  update public.game_players
  set role = 'mafia'
  where game_id = p_game_id
    and user_id = any(v_player_ids[1:v_game.mafia_count]);
  v_index := v_game.mafia_count + 1;
  if v_game.sheriff_enabled then
    update public.game_players set role = 'sheriff'
    where game_id = p_game_id and user_id = v_player_ids[v_index];
    v_index := v_index + 1;
  end if;
  if v_game.angel_enabled then
    update public.game_players set role = 'angel'
    where game_id = p_game_id and user_id = v_player_ids[v_index];
  end if;

  delete from public.game_secrets where game_id = p_game_id;
  delete from public.game_phase_acknowledgements where game_id = p_game_id;
  update public.games
  set word_id = null,
      status = 'role_reveal',
      current_round = 1,
      winner = null,
      ended_at = null,
      last_night_victim = null,
      last_lynch_victim = null,
      chameleon_caught_id = null,
      phase_started_at = clock_timestamp(),
      expires_at = clock_timestamp() + interval '6 hours',
      updated_at = clock_timestamp()
  where games.id = p_game_id;
end;
$$;
revoke execute on function public.start_mafia_game(uuid) from public, anon;
grant execute on function public.start_mafia_game(uuid) to authenticated;

create or replace function public.resolve_night(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer;
  v_target uuid;
  v_target_count integer;
  v_live_mafia integer;
  v_winner text;
  v_killed boolean := false;
begin
  select g.current_round into v_round from public.games g
  where g.id = p_game_id
    and g.game_mode = 'mafia'
    and g.status = 'night'::public.game_status
  for update;
  if not found then
    return;
  end if;

  select count(*) into v_live_mafia from public.game_players gp
  where gp.game_id = p_game_id
    and gp.is_eliminated = false
    and gp.role = 'mafia'::public.player_role;
  select tally.target_id, tally.vote_count into v_target, v_target_count
  from (
    select na.target_id, count(*)::integer as vote_count
    from public.night_actions na
    where na.game_id = p_game_id
      and na.round_number = v_round
      and na.action_type = 'kill'::public.night_action_type
    group by na.target_id
    order by count(*) desc, na.target_id
    limit 1
  ) tally;
  if v_target is not null
     and v_target_count > v_live_mafia / 2
     and not exists (
    select 1 from public.night_actions protection
    where protection.game_id = p_game_id
      and protection.round_number = v_round
      and protection.action_type = 'protect'::public.night_action_type
      and protection.target_id = v_target
  ) then
    update public.game_players set is_eliminated = true
    where game_id = p_game_id and user_id = v_target;
    v_killed := found;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update public.games
    set status = 'game_over', winner = v_winner, ended_at = clock_timestamp(),
        last_night_victim = case when v_killed then v_target end,
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games
    set status = 'day_result',
        last_night_victim = case when v_killed then v_target end,
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
end;
$$;
revoke execute on function public.resolve_night(uuid)
  from public, anon, authenticated;

create or replace function public._maybe_resolve_night(
  p_game_id uuid,
  p_round integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sheriff_enabled boolean;
  v_angel_enabled boolean;
  v_live_mafia integer;
  v_kills integer;
  v_need_inspect integer;
  v_have_inspect integer;
  v_need_protect integer;
  v_have_protect integer;
begin
  select g.sheriff_enabled, g.angel_enabled
  into v_sheriff_enabled, v_angel_enabled
  from public.games g where g.id = p_game_id;
  select count(*) into v_live_mafia from public.game_players gp
  where gp.game_id = p_game_id
    and gp.role = 'mafia'::public.player_role
    and gp.is_eliminated = false;
  select count(distinct na.actor_id) into v_kills
  from public.night_actions na
  where na.game_id = p_game_id and na.round_number = p_round
    and na.action_type = 'kill'::public.night_action_type;

  select count(*) into v_need_inspect from public.game_players gp
  where gp.game_id = p_game_id
    and gp.role = 'sheriff'::public.player_role
    and gp.is_eliminated = false and v_sheriff_enabled;
  select count(distinct na.actor_id) into v_have_inspect
  from public.night_actions na
  where na.game_id = p_game_id and na.round_number = p_round
    and na.action_type = 'inspect'::public.night_action_type;

  select count(*) into v_need_protect from public.game_players gp
  where gp.game_id = p_game_id
    and gp.role = 'angel'::public.player_role
    and gp.is_eliminated = false and v_angel_enabled;
  select count(distinct na.actor_id) into v_have_protect
  from public.night_actions na
  where na.game_id = p_game_id and na.round_number = p_round
    and na.action_type = 'protect'::public.night_action_type;

  if v_kills >= v_live_mafia
     and v_have_inspect >= v_need_inspect
     and v_have_protect >= v_need_protect then
    perform public.resolve_night(p_game_id);
  end if;
end;
$$;
revoke execute on function public._maybe_resolve_night(uuid, integer)
  from public, anon, authenticated;

create or replace function public.submit_night_action(
  p_game_id uuid,
  p_action_type public.night_action_type,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer;
  v_role public.player_role;
  v_result text;
  v_previous_target uuid;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select g.current_round into v_round from public.games g
  where g.id = p_game_id
    and g.game_mode = 'mafia'
    and g.status = 'night'::public.game_status
  for update;
  if not found then
    perform private.game_error('NOT_NIGHT_PHASE');
  end if;
  select gp.role into v_role from public.game_players gp
  where gp.game_id = p_game_id and gp.user_id = v_uid
    and gp.is_eliminated = false;
  if v_role is null then
    perform private.game_error('NOT_AN_ACTIVE_PLAYER', '42501');
  end if;
  if (p_action_type = 'kill' and v_role <> 'mafia'::public.player_role)
     or (p_action_type = 'inspect' and v_role <> 'sheriff'::public.player_role)
     or (p_action_type = 'protect' and v_role <> 'angel'::public.player_role) then
    perform private.game_error('ROLE_CANNOT_PERFORM_ACTION', '42501');
  end if;
  if not private.is_alive_player(p_game_id, p_target_id) then
    perform private.game_error('INVALID_ACTION_TARGET');
  end if;
  if p_action_type = 'kill' and exists (
    select 1 from public.game_players target
    where target.game_id = p_game_id and target.user_id = p_target_id
      and target.role = 'mafia'::public.player_role
  ) then
    perform private.game_error('MAFIA_FRIENDLY_FIRE_BLOCKED');
  end if;

  if p_action_type = 'inspect' then
    select na.target_id into v_previous_target
    from public.night_actions na
    where na.game_id = p_game_id and na.round_number = v_round
      and na.actor_id = v_uid
      and na.action_type = 'inspect'::public.night_action_type;
    if v_previous_target is not null and v_previous_target <> p_target_id then
      perform private.game_error('INSPECTION_ALREADY_LOCKED');
    end if;
    select case when gp.role = 'mafia'::public.player_role
                then 'mafia' else 'not_mafia' end
    into v_result
    from public.game_players gp
    where gp.game_id = p_game_id and gp.user_id = p_target_id;
  end if;

  insert into public.night_actions (
    game_id, round_number, actor_id, action_type, target_id, result, created_at
  ) values (
    p_game_id, v_round, v_uid, p_action_type, p_target_id,
    v_result, clock_timestamp()
  ) on conflict (game_id, round_number, actor_id, action_type)
    do update set target_id = excluded.target_id,
                  result = excluded.result,
                  created_at = excluded.created_at;
  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;
  update public.games set updated_at = clock_timestamp()
  where games.id = p_game_id;
  perform public._maybe_resolve_night(p_game_id, v_round);
end;
$$;
revoke execute on function public.submit_night_action(
  uuid, public.night_action_type, uuid
) from public, anon;
grant execute on function public.submit_night_action(
  uuid, public.night_action_type, uuid
) to authenticated;

create or replace function public.resolve_day(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer;
  v_target uuid;
  v_top_count integer;
  v_tie_count integer;
  v_winner text;
  v_lynched boolean := false;
  v_alive_count integer;
  v_vote_count integer;
begin
  select g.current_round into v_round from public.games g
  where g.id = p_game_id
    and g.game_mode = 'mafia'
    and g.status = 'day_vote'::public.game_status
  for update;
  if not found then
    return;
  end if;
  select count(*) into v_alive_count from public.game_players gp
  where gp.game_id = p_game_id and gp.is_eliminated = false;
  select count(*) into v_vote_count from public.day_votes dv
  where dv.game_id = p_game_id and dv.round_number = v_round;
  select tally.target_id, tally.vote_count into v_target, v_top_count
  from (
    select dv.target_id, count(*)::integer as vote_count
    from public.day_votes dv
    where dv.game_id = p_game_id and dv.round_number = v_round
    group by dv.target_id
    order by count(*) desc, dv.target_id
    limit 1
  ) tally;
  select count(*) into v_tie_count from (
    select dv.target_id from public.day_votes dv
    where dv.game_id = p_game_id and dv.round_number = v_round
    group by dv.target_id having count(*) = v_top_count
  ) ties;
  if v_target is not null
     and v_vote_count > v_alive_count / 2
     and v_tie_count = 1 then
    update public.game_players set is_eliminated = true
    where game_id = p_game_id and user_id = v_target;
    v_lynched := found;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update public.games
    set status = 'game_over', winner = v_winner, ended_at = clock_timestamp(),
        last_lynch_victim = case when v_lynched then v_target end,
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  else
    update public.games
    set status = 'lynch_result',
        last_lynch_victim = case when v_lynched then v_target end,
        phase_started_at = clock_timestamp(), updated_at = clock_timestamp()
    where games.id = p_game_id;
  end if;
end;
$$;
revoke execute on function public.resolve_day(uuid)
  from public, anon, authenticated;

create or replace function public.cast_day_vote(
  p_game_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round integer;
  v_alive_count integer;
  v_vote_count integer;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select g.current_round into v_round from public.games g
  where g.id = p_game_id
    and g.game_mode = 'mafia'
    and g.status = 'day_vote'::public.game_status
  for update;
  if not found then
    perform private.game_error('NOT_DAY_VOTE_PHASE');
  end if;
  if not private.is_alive_player(p_game_id, v_uid) then
    perform private.game_error('NOT_AN_ACTIVE_PLAYER', '42501');
  end if;
  if not private.is_alive_player(p_game_id, p_target_id) then
    perform private.game_error('INVALID_VOTE_TARGET');
  end if;

  insert into public.day_votes (
    game_id, round_number, voter_id, target_id, created_at
  ) values (
    p_game_id, v_round, v_uid, p_target_id, clock_timestamp()
  ) on conflict (game_id, round_number, voter_id)
    do update set target_id = excluded.target_id,
                  created_at = excluded.created_at;
  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = p_game_id and user_id = v_uid;
  update public.games set updated_at = clock_timestamp()
  where games.id = p_game_id;

  select count(*) into v_alive_count from public.game_players gp
  where gp.game_id = p_game_id and gp.is_eliminated = false;
  select count(*) into v_vote_count from public.day_votes dv
  where dv.game_id = p_game_id and dv.round_number = v_round;
  if v_vote_count >= v_alive_count then
    perform public.resolve_day(p_game_id);
  end if;
end;
$$;
revoke execute on function public.cast_day_vote(uuid, uuid)
  from public, anon;
grant execute on function public.cast_day_vote(uuid, uuid)
  to authenticated;

-- Compatibility phase wrappers remain for the current client. New clients use
-- mark_phase_ready/advance_game_phase so no single device is required.
create or replace function public.begin_night(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.advance_game_phase(p_game_id);
end;
$$;
revoke execute on function public.begin_night(uuid) from public, anon;
grant execute on function public.begin_night(uuid) to authenticated;

create or replace function public.begin_day_vote(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.advance_game_phase(p_game_id);
end;
$$;
revoke execute on function public.begin_day_vote(uuid) from public, anon;
grant execute on function public.begin_day_vote(uuid) to authenticated;

create or replace function public.force_advance_phase(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.advance_game_phase(p_game_id);
end;
$$;
revoke execute on function public.force_advance_phase(uuid) from public, anon;
grant execute on function public.force_advance_phase(uuid) to authenticated;

-- One participant-gated read contract replaces multi-table client joins. It is
-- the only API that exposes secret words or other players' role information.
create or replace function public.get_game_snapshot(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_viewer_outsider boolean;
  v_viewer_role public.player_role;
  v_round_id uuid;
  v_secret_word jsonb;
  v_guess_candidates jsonb := '[]'::jsonb;
  v_players jsonb;
  v_night_actions jsonb;
  v_result jsonb;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.room_code = upper(trim(p_room_code));
  if not found then
    perform private.game_error('ROOM_NOT_FOUND', 'P0002');
  end if;
  select gp.is_outsider, gp.role
  into v_viewer_outsider, v_viewer_role
  from public.game_players gp
  where gp.game_id = v_game.id and gp.user_id = v_uid;
  if not found then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;

  update public.game_players set last_seen_at = clock_timestamp()
  where game_id = v_game.id and user_id = v_uid;

  select r.id into v_round_id from public.rounds r
  where r.game_id = v_game.id and r.round_number = v_game.current_round;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', gp.id,
      'user_id', gp.user_id,
      'display_name', u.display_name,
      'is_eliminated', gp.is_eliminated,
      'join_order', gp.join_order,
      'joined_at', gp.joined_at,
      'last_seen_at', gp.last_seen_at,
      'is_outsider', case
        when gp.user_id = v_uid then gp.is_outsider
        when v_game.status = 'game_over'::public.game_status then gp.is_outsider
        else null::boolean end,
      'role', case
        when gp.user_id = v_uid then gp.role
        when v_game.status = 'game_over'::public.game_status then gp.role
        when v_viewer_role = 'mafia'::public.player_role
             and gp.role = 'mafia'::public.player_role then gp.role
        else null::public.player_role end
    ) order by gp.join_order
  ), '[]'::jsonb) into v_players
  from public.game_players gp
  join public.users u on u.id = gp.user_id
  where gp.game_id = v_game.id;

  if v_game.game_mode = 'chameleon'
     and (not v_viewer_outsider
          or v_game.status = 'game_over'::public.game_status) then
    select jsonb_build_object('id', w.id, 'text', w.text)
    into v_secret_word
    from public.game_secrets s
    join public.words w on w.id = s.word_id
    where s.game_id = v_game.id;
  end if;

  if v_game.game_mode = 'chameleon'
     and v_game.status = 'chameleon_guess'::public.game_status
     and v_game.chameleon_caught_id = v_uid then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', w.id,
        'text', w.text,
        'attempted', w.id = any(s.guess_attempt_ids)
      ) order by w.text
    ), '[]'::jsonb)
    into v_guess_candidates
    from public.game_secrets s
    cross join lateral unnest(s.guess_candidate_ids) as candidate(candidate_id)
    join public.words w on w.id = candidate.candidate_id
    where s.game_id = v_game.id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'actor_id', na.actor_id,
      'action_type', na.action_type,
      'target_id', na.target_id,
      'result', case when na.actor_id = v_uid then na.result end
    ) order by na.created_at
  ), '[]'::jsonb)
  into v_night_actions
  from public.night_actions na
  where na.game_id = v_game.id
    and na.round_number = v_game.current_round
    and (
      na.actor_id = v_uid
      or (v_viewer_role = 'mafia'::public.player_role
          and na.action_type = 'kill'::public.night_action_type)
    );

  v_result := jsonb_build_object(
    'game', jsonb_build_object(
      'id', v_game.id,
      'room_code', v_game.room_code,
      'game_mode', v_game.game_mode,
      'status', v_game.status,
      'host_id', v_game.host_id,
      'dealer_id', v_game.dealer_id,
      'category_id', v_game.category_id,
      'category_name', (
        select c.name from public.categories c where c.id = v_game.category_id
      ),
      'current_round', v_game.current_round,
      'max_rounds', v_game.max_rounds,
      'mafia_count', v_game.mafia_count,
      'show_categories', v_game.show_categories,
      'sheriff_enabled', v_game.sheriff_enabled,
      'angel_enabled', v_game.angel_enabled,
      'reveal_role_on_death', v_game.reveal_role_on_death,
      'winner', v_game.winner,
      'last_night_victim', v_game.last_night_victim,
      'last_lynch_victim', v_game.last_lynch_victim,
      'chameleon_vote_stage', v_game.chameleon_vote_stage,
      'chameleon_tied_player_ids', v_game.chameleon_tied_player_ids,
      'chameleon_caught_id', v_game.chameleon_caught_id,
      'phase_started_at', v_game.phase_started_at,
      'expires_at', v_game.expires_at,
      'created_at', v_game.created_at,
      'updated_at', v_game.updated_at,
      'ended_at', v_game.ended_at
    ),
    'players', v_players,
    'round', case when v_round_id is null then null else (
      select jsonb_build_object(
        'id', r.id,
        'round_number', r.round_number,
        'hint_order', r.hint_order
      ) from public.rounds r where r.id = v_round_id
    ) end,
    'hinted_player_ids', coalesce((
      select jsonb_agg(h.player_id order by h.given_at)
      from public.hints_given h where h.round_id = v_round_id
    ), '[]'::jsonb),
    'voter_ids', coalesce((
      select jsonb_agg(v.voter_id order by v.cast_at)
      from public.votes v
      where v.round_id = v_round_id
        and v.vote_stage = v_game.chameleon_vote_stage
    ), '[]'::jsonb),
    'ready_user_ids', coalesce((
      select jsonb_agg(a.user_id order by a.acknowledged_at)
      from public.game_phase_acknowledgements a
      where a.game_id = v_game.id
        and a.round_number = v_game.current_round
        and a.phase = v_game.status
    ), '[]'::jsonb),
    'night_actions', v_night_actions,
    'day_vote_target_id', (
      select dv.target_id from public.day_votes dv
      where dv.game_id = v_game.id
        and dv.round_number = v_game.current_round
        and dv.voter_id = v_uid
    ),
    'day_voter_ids', coalesce((
      select jsonb_agg(dv.voter_id order by dv.created_at)
      from public.day_votes dv
      where dv.game_id = v_game.id
        and dv.round_number = v_game.current_round
    ), '[]'::jsonb),
    'secret_word', v_secret_word,
    'guess_candidates', v_guess_candidates,
    'guesses_remaining', case
      when v_game.chameleon_caught_id = v_uid
        and v_game.status = 'chameleon_guess'::public.game_status
      then (select s.guesses_remaining from public.game_secrets s
            where s.game_id = v_game.id)
      else null end
  );
  return v_result;
end;
$$;
revoke execute on function public.get_game_snapshot(text) from public, anon;
grant execute on function public.get_game_snapshot(text) to authenticated;

-- Final UI payload. Keep this definition last so every client reads the same
-- safe, mode-aware projection from one RPC.
create or replace function public.get_game_snapshot(p_room_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game public.games%rowtype;
  v_uid uuid := auth.uid();
  v_viewer_outsider boolean;
  v_viewer_role public.player_role;
  v_round_id uuid;
  v_chameleon_id uuid;
  v_word_text text;
  v_guess_word_options jsonb := '[]'::jsonb;
  v_players jsonb;
  v_night_actions jsonb;
  v_day_votes jsonb;
  v_phase_deadline timestamptz;
  v_recovery_available boolean := false;
  v_can_advance boolean := false;
  v_guess_correct boolean;
begin
  if v_uid is null then
    perform private.game_error('UNAUTHENTICATED', '28000');
  end if;
  select * into v_game from public.games g
  where g.room_code = upper(trim(p_room_code));
  if not found then
    perform private.game_error('ROOM_NOT_FOUND', 'P0002');
  end if;
  select gp.is_outsider, gp.role
  into v_viewer_outsider, v_viewer_role
  from public.game_players gp
  where gp.game_id = v_game.id and gp.user_id = v_uid;
  if not found then
    perform private.game_error('NOT_A_PARTICIPANT', '42501');
  end if;

  select r.id into v_round_id from public.rounds r
  where r.game_id = v_game.id and r.round_number = v_game.current_round;
  select gp.user_id into v_chameleon_id from public.game_players gp
  where gp.game_id = v_game.id and gp.is_outsider = true limit 1;

  if v_game.status not in (
    'lobby'::public.game_status, 'game_over'::public.game_status
  ) then
    v_phase_deadline := v_game.phase_started_at + interval '120 seconds';
    v_recovery_available := clock_timestamp() >= v_phase_deadline;
  end if;
  v_can_advance := case
    when v_game.status in (
      'role_reveal'::public.game_status,
      'day_result'::public.game_status,
      'lynch_result'::public.game_status
    ) then private.phase_is_ready(
      v_game.id, v_game.current_round, v_game.status
    ) or v_recovery_available
    when v_game.status = 'chameleon_tie_break'::public.game_status
      then v_uid = coalesce(v_game.dealer_id, v_game.host_id)
        or v_recovery_available
    else v_recovery_available
  end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', gp.id,
      'game_id', gp.game_id,
      'user_id', gp.user_id,
      'display_name', u.display_name,
      'is_eliminated', gp.is_eliminated,
      'join_order', gp.join_order,
      'joined_at', gp.joined_at,
      'last_seen_at', gp.last_seen_at,
      'is_outsider', case
        when gp.user_id = v_uid then gp.is_outsider
        when v_game.status = 'game_over'::public.game_status then gp.is_outsider
        else null::boolean end,
      'role', case
        when gp.user_id = v_uid then gp.role
        when v_game.status = 'game_over'::public.game_status then gp.role
        when v_viewer_role = 'mafia'::public.player_role
             and gp.role = 'mafia'::public.player_role then gp.role
        else null::public.player_role end
    ) order by gp.join_order
  ), '[]'::jsonb) into v_players
  from public.game_players gp
  join public.users u on u.id = gp.user_id
  where gp.game_id = v_game.id;

  if v_game.game_mode = 'chameleon'
     and v_game.status <> 'lobby'::public.game_status then
    select coalesce(jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'id', w.id,
        'text', w.text,
        'attempted', case
          when v_game.chameleon_caught_id = v_uid
          then w.id = any(s.guess_attempt_ids)
          else null::boolean end
      )) order by w.text
    ), '[]'::jsonb)
    into v_guess_word_options
    from public.game_secrets s
    cross join lateral unnest(s.guess_candidate_ids) as candidate(candidate_id)
    join public.words w on w.id = candidate.candidate_id
    where s.game_id = v_game.id;
  end if;

  if v_game.game_mode = 'chameleon'
     and (not v_viewer_outsider
          or v_game.status = 'game_over'::public.game_status) then
    select w.text into v_word_text
    from public.game_secrets s
    join public.words w on w.id = s.word_id
    where s.game_id = v_game.id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', na.id,
      'game_id', na.game_id,
      'round_number', na.round_number,
      'actor_id', na.actor_id,
      'action_type', na.action_type,
      'target_id', na.target_id,
      'result', case when na.actor_id = v_uid then na.result end,
      'created_at', na.created_at
    ) order by na.created_at
  ), '[]'::jsonb)
  into v_night_actions
  from public.night_actions na
  where na.game_id = v_game.id
    and na.round_number = v_game.current_round
    and (
      na.actor_id = v_uid
      or (v_viewer_role = 'mafia'::public.player_role
          and na.action_type = 'kill'::public.night_action_type)
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', dv.id,
      'game_id', dv.game_id,
      'round_number', dv.round_number,
      'voter_id', dv.voter_id,
      'target_id', dv.target_id,
      'created_at', dv.created_at
    ) order by dv.created_at
  ), '[]'::jsonb)
  into v_day_votes
  from public.day_votes dv
  where dv.game_id = v_game.id
    and dv.round_number = v_game.current_round
    and dv.voter_id = v_uid;

  if v_game.status = 'game_over'::public.game_status then
    select case
      when cardinality(s.guess_attempt_ids) = 0 then null
      else s.guess_attempt_ids[cardinality(s.guess_attempt_ids)] = s.word_id
    end into v_guess_correct
    from public.game_secrets s where s.game_id = v_game.id;
  end if;

  return jsonb_build_object(
    'game', jsonb_build_object(
      'id', v_game.id,
      'room_code', v_game.room_code,
      'game_mode', v_game.game_mode,
      'status', v_game.status,
      'host_id', v_game.host_id,
      'category_id', v_game.category_id,
      'category_name', (
        select c.name from public.categories c where c.id = v_game.category_id
      ),
      'current_round', v_game.current_round,
      'max_rounds', v_game.max_rounds,
      'mafia_count', v_game.mafia_count,
      'show_categories', v_game.show_categories,
      'sheriff_enabled', v_game.sheriff_enabled,
      'angel_enabled', v_game.angel_enabled,
      'reveal_role_on_death', v_game.reveal_role_on_death,
      'winner', v_game.winner,
      'last_night_victim', v_game.last_night_victim,
      'last_lynch_victim', v_game.last_lynch_victim,
      'phase_started_at', v_game.phase_started_at,
      'expires_at', v_game.expires_at,
      'created_at', v_game.created_at,
      'updated_at', v_game.updated_at,
      'ended_at', v_game.ended_at
    ),
    'players', v_players,
    'round', case when v_round_id is null then null else (
      select jsonb_build_object(
        'id', r.id, 'game_id', r.game_id,
        'round_number', r.round_number, 'hint_order', r.hint_order
      ) from public.rounds r where r.id = v_round_id
    ) end,
    'hinted_player_ids', coalesce((
      select jsonb_agg(h.player_id order by h.given_at)
      from public.hints_given h where h.round_id = v_round_id
    ), '[]'::jsonb),
    'voted_player_ids', coalesce((
      select jsonb_agg(v.voter_id order by v.cast_at)
      from public.votes v where v.round_id = v_round_id and v.vote_stage = 1
    ), '[]'::jsonb),
    'ready_player_ids', coalesce((
      select jsonb_agg(a.user_id order by a.acknowledged_at)
      from public.game_phase_acknowledgements a
      where a.game_id = v_game.id
        and a.round_number = v_game.current_round
        and a.phase = v_game.status
    ), '[]'::jsonb),
    'tied_player_ids', v_game.chameleon_tied_player_ids,
    'guess_word_options', v_guess_word_options,
    'word_text', v_word_text,
    'chameleon_id', case
      when v_viewer_outsider
        or v_game.status in (
          'chameleon_guess'::public.game_status,
          'game_over'::public.game_status
        ) then v_chameleon_id
      else null end,
    'dealer_id', v_game.dealer_id,
    'my_vote_target_id', (
      select v.voted_for_id from public.votes v
      where v.round_id = v_round_id and v.vote_stage = 1 and v.voter_id = v_uid
    ),
    'my_day_vote_target_id', (
      select dv.target_id from public.day_votes dv
      where dv.game_id = v_game.id
        and dv.round_number = v_game.current_round and dv.voter_id = v_uid
    ),
    'night_actions', v_night_actions,
    'day_votes', v_day_votes,
    'can_advance', v_can_advance,
    'recovery_available', v_recovery_available,
    'phase_deadline', v_phase_deadline,
    'guesses_remaining', case
      when v_game.chameleon_caught_id = v_uid
        or v_game.status = 'game_over'::public.game_status
      then (select s.guesses_remaining from public.game_secrets s
            where s.game_id = v_game.id)
      else null end,
    'guess_correct', v_guess_correct,
    'winner', v_game.winner
  );
end;
$$;
revoke execute on function public.get_game_snapshot(text) from public, anon;
grant execute on function public.get_game_snapshot(text) to authenticated;

-- Secret words are no longer selectable directly. The legacy base-column copy
-- was completed in the schema migration, so clear it after all replacements.
revoke select on public.words from anon, authenticated;
drop policy if exists "words readable by non-outsider players post-reveal"
  on public.words;
update public.games set word_id = null where word_id is not null;

-- Revoke old browser-facing helpers that expose internal engine details.
revoke execute on function public._game_status(uuid)
  from public, anon, authenticated;
revoke execute on function public._is_alive_player(uuid, uuid)
  from public, anon, authenticated;
