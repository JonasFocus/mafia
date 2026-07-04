@AGENTS.md

# Mafia — project notes

Party game (Chameleon/Outsider-style + a Classic Mafia mode). Solo mobile-first web app.

## Stack (actual, not the default)
- Next.js 16.2.9 (App Router), React 19, TypeScript, Tailwind v4
- **Supabase** for everything backend: Postgres DB, Auth (anonymous/guest users), Realtime. No separate API layer — client talks to Supabase directly (`src/lib/supabase/client.ts`, `server.ts`) plus Postgres functions (RPCs) for game logic.
- Drizzle (`drizzle-orm`, `drizzle-kit`) is used **only** as a schema/migration authoring tool — `drizzle.config.ts` points `out` at `supabase/migrations`. There is no Drizzle client at runtime; the app reads/writes via `@supabase/supabase-js`. Game logic (dealing roles, resolving votes, phase transitions) lives in Postgres functions under `supabase/migrations/*.sql`, not in TypeScript.
- State/UI: Zustand, Framer Motion.
- Deployed on **Vercel**, project name `mafia` (prod: mafia-ashy-beta.vercel.app), auto-deploys from GitHub `main` (`JonasFocus/mafia`).
- Supabase project ref: `svjbvxxllxlxhykkbowe`.

## Non-standard structure (see AGENTS.md warning)
- Middleware file is `src/proxy.ts`, not `middleware.ts` — this Next.js version renamed it. It refreshes the Supabase session on every request.
- Two game modes share the app: Chameleon (`src/components/game/*`, `use-game.ts`, `ChameleonGame.tsx`) and Classic Mafia (`src/components/game/mafia/*`, `use-mafia-game.ts`). `GameMode = "chameleon" | "mafia"` in `src/lib/game/types.ts`.
- Routes: `/host` (create game), `/join` (join by room code), `/game/[roomCode]` (play). The game page resolves `game_mode` + user with one light query, then mounts exactly ONE data hook (`ChameleonGame` or `MafiaGame`) — never both.

## Database
- Schema/migrations in `supabase/migrations/`, applied in filename (timestamp) order.
- Key tables: `users`, `categories`, `games`, `game_players` (+ redacted `game_players_public` view), `rounds`, `hints_given`, `votes`, plus Mafia-mode: `night_actions`, `day_votes` (`player_role`: faithful/mafia/sheriff/angel).
- Mafia phase loop (2026-07-04): `role_reveal → night → day_result → day_vote → lynch_result → night …`. `resolve_day` lands on `lynch_result` (outcome on `games.last_lynch_victim`, null = tie); `begin_night` owns the round increment and only accepts `role_reveal`/`lynch_result` — never `day_result` (same-round re-entry replayed the previous night's actions). Caps: mafia rooms 25 players / chameleon 8 (`join_game`), `mafia_count` 1–8. Sheriff inspects lock to their first target each night (same-target re-submit is idempotent, retarget errors) — don't restore the blind upsert, it let a sheriff scan the whole table pre-resolution. Player self-DELETE on `game_players` and host settings UPDATE on `games` are lobby-only policies.
- Engine test suite: `supabase/tests/run.sh` spins up a throwaway local PG16, applies all migrations in order, and runs full-game scenarios, RLS checks, and two-connection concurrency races. Run it after touching any game-logic SQL.
- Generated TS types: `src/lib/supabase/database.types.ts` (regenerate with the Supabase MCP `generate_typescript_types` tool or `supabase gen types` after any schema change).

### Security model (hardened 2026-07-01 — don't loosen without thought)
- RLS is the ONLY trust boundary; clients are anonymous-auth and fully untrusted.
- `game_players`: clients have NO UPDATE path at all (policy dropped + column-level grants — INSERT allowed only for `(game_id, user_id, join_order)` into lobby games). `role`/`is_outsider`/`is_eliminated` are engine-owned, written only by SECURITY DEFINER functions.
- `games`: host UPDATE is column-scoped to lobby settings (`category_id`, `mafia_count`, `show_categories`, `sheriff_enabled`, `angel_enabled`, `reveal_role_on_death`, `max_rounds`). `status`/`winner`/`word_id`/`current_round` are engine-owned. Host has DELETE.
- `hints_given`/`votes` INSERTs are gated on alive + correct phase (+ living vote target) via `_is_alive_player`/`_game_status` definer helpers.
- ⚠️ RLS policies on `game_players` can't subquery `games` directly (and vice versa) — Postgres reports infinite recursion (42P17) because their policies reference each other. Use a SECURITY DEFINER helper (`_game_status`, `_is_alive_player`) instead.
- All phase-advancing SQL (`resolve_votes`, `check_hints_complete`, `resolve_night`, `resolve_day`, `cast_day_vote`, `submit_night_action`) locks the `games` row `FOR UPDATE` before counting submissions — required to prevent a permanent round stall when the last two players submit simultaneously. Keep this pattern in any new resolution logic.

### Realtime gotchas
- `postgres_changes` delivers only rows the subscriber's SELECT RLS allows. `game_players` is own-row-only and `votes` is own-ballot-only, so other players' inserts are NEVER delivered. The workaround: triggers touch `games.updated_at` (using `clock_timestamp()`, since `now()` is frozen per-transaction) on player join/leave and on hint/vote inserts; clients subscribe to the filtered `games` listener and refetch. Don't add unscoped `.on(...)` listeners.
- Aggregates clients can't read directly go through definer RPCs: `round_voter_ids(round_id)` (who voted, never for whom), `count_game_players`, `list_open_games`, `join_game` (join must be an RPC — a non-participant can't SELECT the game row by room code).
- `resolve_night` records the kill on `games.last_night_victim` (null = angel save/no kill); the morning screen reads that, not client-side diffing.

### Migration workflow (live DB is source of truth for versions)
1. Apply via Supabase MCP `apply_migration` (records a version in `supabase_migrations.schema_migrations`).
2. Read back the recorded version, then check in `supabase/migrations/<version>_<name>.sql` with the SAME version number so `supabase db push` treats it as applied.
3. Regenerate `database.types.ts`.
- ⚠️ 2026-07-01 incident: two sessions worked from different checkouts; one applied migrations out-of-band and pushed client code to GitHub while the other checkout was stale. **Always `git pull` and diff live `schema_migrations` against `supabase/migrations/` before DB work.**

## Environment variables
Runtime code only reads two: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (used in `src/lib/supabase/client.ts`, `server.ts`, and `src/proxy.ts`). `DATABASE_URL` is only needed locally for `drizzle-kit` to generate migrations — not read by the app itself.

Both are set on Vercel as of 2026-07-01, **but `NEXT_PUBLIC_SUPABASE_URL` is Production-only** — add it to Preview (`vercel env add NEXT_PUBLIC_SUPABASE_URL preview`) before relying on preview deploys.

⚠️ `vercel link` / `vercel env pull` will **overwrite `.env.local`** with whatever is set on Vercel. Back up `.env.local` before running either.
