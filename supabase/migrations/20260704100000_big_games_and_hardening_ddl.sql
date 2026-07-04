-- Mafia hardening + big games, part 1/2 (DDL only).
-- The new game_status value must be committed before any function body runs with
-- it, so this file carries the enum/columns/policies and
-- 20260704100100_big_games_and_hardening_functions.sql carries the functions
-- (same split as 20260701020000/20260701020100).

-- New phase between day_vote and the next night: announces the lynch outcome
-- (or the tie) instead of dumping everyone straight into night. The round
-- counter now increments on the lynch_result -> night transition (begin_night)
-- rather than inside resolve_day.
alter type game_status add value if not exists 'lynch_result';

-- Who the town voted out (null = tie / no votes). Mirrors last_night_victim:
-- recorded authoritatively so reloads and late joiners see the same morning news.
alter table games add column if not exists last_lynch_victim uuid references users(id) on delete set null;

-- Big games: mafia rooms now hold up to 25 players (join_game gains a per-mode
-- cap in part 2). With 17+ players the old 3-mafia ceiling made town a
-- near-guaranteed win, so allow up to 8; start_mafia_game still enforces
-- mafia < half the table, so small games are unaffected.
alter table games drop constraint if exists games_mafia_count_check;
alter table games add constraint games_mafia_count_check check (mafia_count between 1 and 8);

-- Leaving was allowed at any phase (the UI only offers it in the lobby, but the
-- policy is the boundary). A mid-game self-delete corrupted engine state: the
-- leaver vanished from _mafia_win_check and cast_day_vote's alive count while
-- their already-cast ballot kept counting, and a mafia member could dodge a
-- lynch entirely. Scope it to the lobby, like the insert policy.
drop policy if exists "game_players delete own row" on game_players;
create policy "game_players delete own row in lobby" on game_players
  for delete to authenticated using (
    user_id = (select auth.uid())
    and public._game_status(game_id) = 'lobby'
  );

-- The host's UPDATE on games was row-scoped but not phase-scoped: the grants
-- limit it to lobby-settings columns, but nothing stopped edits mid-game
-- (e.g. max_rounds during a running chameleon round). Settings are lobby-only.
drop policy if exists "games update by host" on games;
create policy "games update by host in lobby" on games
  for update to authenticated
  using (host_id = (select auth.uid()) and status = 'lobby')
  with check (host_id = (select auth.uid()) and status = 'lobby');
