-- Production-readiness hardening pass:
--   1) close RLS gaps that let a client bypass SECURITY DEFINER functions via direct
--      table writes on games/game_players
--   2) add the missing games DELETE policy (host "End game" has never worked)
--   3) lock the games row before counting in the chameleon triggers, matching the
--      `for update` pattern already used everywhere in mafia mode, to close a
--      concurrent-insert race that can permanently stall a game
--   4) lock the games row in start_game/start_mafia_game to prevent a double-start race
--   5) stamp an authoritative night_victim_id so clients don't need a client-side
--      sessionStorage heuristic to know who died last night

-- ---------------------------------------------------------------------------
-- 1a. game_players: the client never legitimately UPDATEs this table directly —
-- role/is_outsider/is_eliminated/join_order are only ever mutated by SECURITY DEFINER
-- functions. The previous "update by host or self" policy was row-scoped only, so any
-- player could UPDATE their own role/is_outsider/is_eliminated directly via the client
-- SDK, bypassing every game-logic guard (self-promote to mafia, un-eliminate self,
-- reveal the secret word early by flipping is_outsider). Drop it: there is no
-- legitimate client write path to this table left to preserve.
drop policy if exists "game_players update by host or self" on game_players;

-- 1b. game_players insert: restrict to lobby phase so a client can't join (or be
-- upserted into) a game that's already in progress — that desynced cast_day_vote's
-- alive-count / win-check math and could stall day-vote resolution forever.
--
-- Checking games.status directly in this policy's WITH CHECK would recurse: reading
-- `games` re-triggers "games readable by participants", whose own USING clause queries
-- `game_players` (the table currently being inserted into), and Postgres detects that
-- as infinite RLS recursion. Route the status lookup through a SECURITY DEFINER helper
-- so it runs as the function owner and bypasses game_players/games RLS entirely,
-- breaking the cycle — the standard fix for this well-known Supabase RLS pattern.
create or replace function public._game_status(p_game_id uuid)
returns game_status
language sql stable security definer set search_path = public as $$
  select status from games where id = p_game_id
$$;
revoke execute on function public._game_status(uuid) from public, anon;
grant execute on function public._game_status(uuid) to authenticated;

drop policy if exists "game_players insert self" on game_players;
create policy "game_players insert self" on game_players
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and public._game_status(game_players.game_id) = 'lobby'
  );

-- 1c. games: same class of bug as 1a. "update by host" was row-scoped only, letting the
-- host UPDATE status/winner/word_id/current_round/mafia_count/etc. directly, bypassing
-- every phase-transition function (force game_over to reveal the word early, replay
-- night after seeing the outcome, desync round-scoped uniqueness by rewinding status).
-- The only legitimate direct-table write the client made was updateGameSettings()
-- (mafia_count/show_categories/sheriff_enabled/angel_enabled from the lobby); move that
-- behind a SECURITY DEFINER RPC (host + lobby-phase + mafia-count bounds checked) and
-- drop direct UPDATE access entirely.
drop policy if exists "games update by host" on games;

create or replace function public.update_game_settings(
  p_game_id uuid,
  p_mafia_count int default null,
  p_show_categories boolean default null,
  p_sheriff_enabled boolean default null,
  p_angel_enabled boolean default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host_id uuid;
  v_status game_status;
  v_player_count int;
  v_max_mafia int;
begin
  select host_id, status into v_host_id, v_status from games where id = p_game_id for update;
  if v_host_id is null then raise exception 'game not found'; end if;
  if v_host_id <> auth.uid() then raise exception 'only the host can change settings'; end if;
  if v_status <> 'lobby' then raise exception 'settings can only change before the game starts'; end if;

  if p_mafia_count is not null then
    select count(*) into v_player_count from game_players where game_id = p_game_id;
    v_max_mafia := greatest(1, (greatest(v_player_count, 1) - 1) / 2);
    if p_mafia_count < 1 or p_mafia_count > v_max_mafia then
      raise exception 'invalid mafia count for % players (max %)', v_player_count, v_max_mafia;
    end if;
  end if;

  update games set
    mafia_count = coalesce(p_mafia_count, mafia_count),
    show_categories = coalesce(p_show_categories, show_categories),
    sheriff_enabled = coalesce(p_sheriff_enabled, sheriff_enabled),
    angel_enabled = coalesce(p_angel_enabled, angel_enabled)
  where id = p_game_id;
end; $$;
revoke execute on function public.update_game_settings(uuid, int, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_game_settings(uuid, int, boolean, boolean, boolean) to authenticated;

-- 2. games: add the missing DELETE policy. LobbyScreen's "End game" button (mafia mode,
-- host-only, lobby-only UI) calls deleteGame(), but no DELETE policy has ever existed on
-- `games` — RLS default-denies DELETE with no permissive policy, so this button has
-- never actually worked (host gets "Could not end the game" every time).
create policy "games delete by host in lobby" on games
  for delete to authenticated using (
    host_id = (select auth.uid()) and status = 'lobby'
  );

-- ---------------------------------------------------------------------------
-- 3. Lock the games row before counting in check_hints_complete/resolve_votes
-- (chameleon mode), matching the `for update` pattern every mafia-mode phase function
-- already uses. Without this, two concurrent inserts (the last two hints/votes landing
-- at nearly the same instant) can both read a stale undercount under READ COMMITTED and
-- both skip the phase transition, permanently stalling the game with no client retry.
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
  perform 1 from games where id = v_game_id for update;

  select count(*) into v_active_count from game_players where game_id = v_game_id and is_eliminated = false;
  select count(*) into v_hint_count from hints_given where round_id = new.round_id;

  if v_hint_count >= v_active_count then
    update games set status = 'voting' where id = v_game_id and status = 'hint_phase';
  end if;
  return new;
end;
$$;

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
  perform 1 from games where id = v_game_id for update;

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

-- ---------------------------------------------------------------------------
-- 4. Lock the games row in start_game/start_mafia_game before reading status, to
-- prevent a double-start race (two concurrent calls both observing status='lobby' and
-- both running independent random role/word assignment, the second silently
-- overwriting the first after players may have already seen it via realtime).
create or replace function public.start_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_id uuid;
  v_category_id uuid;
  v_status game_status;
  v_word_id uuid;
  v_player_count int;
  v_mafia_count int;
  v_max_mafia int;
  v_hint_order uuid[];
begin
  select host_id, category_id, mafia_count, status
    into v_host_id, v_category_id, v_mafia_count, v_status
    from games where id = p_game_id for update;

  if v_host_id is null then
    raise exception 'game not found';
  end if;
  if v_host_id != auth.uid() then
    raise exception 'only the host can start the game';
  end if;
  if v_status <> 'lobby' then
    raise exception 'game already started';
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

create or replace function public.start_mafia_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_host uuid; v_status game_status; v_mafia int; v_sheriff bool; v_angel bool;
  v_n int; v_need int; v_max_mafia int; v_ids uuid[]; v_i int;
begin
  select host_id, status, mafia_count, sheriff_enabled, angel_enabled
    into v_host, v_status, v_mafia, v_sheriff, v_angel from games where id = p_game_id for update;
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

-- ---------------------------------------------------------------------------
-- 5. Record who died each night so clients can render "who died" from an authoritative
-- server value instead of a client-side sessionStorage heuristic diffing the eliminated
-- list (which broke on a new device / cleared storage, since it had no prior snapshot
-- to diff against, and was also an impure render-phase side effect).
alter table games add column if not exists night_victim_id uuid references users(id);

create or replace function public.resolve_night(p_game_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_round int; v_target uuid; v_winner text; v_killed uuid;
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
    v_killed := v_target;
  end if;

  v_winner := public._mafia_win_check(p_game_id);
  if v_winner is not null then
    update games set status='game_over', winner=v_winner, ended_at=now(), night_victim_id=v_killed
      where id=p_game_id;
  else
    update games set status='day_result', night_victim_id=v_killed where id=p_game_id;
  end if;
end; $$;
