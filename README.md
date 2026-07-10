# Mafia & Chameleon

A phone-first party game for friends in the same room. One player hosts, everyone joins with a four-character code, and each phone privately shows the role, word, vote, or night action that belongs to its player.

The app includes two modes:

- **Classic Mafia:** 5 to 25 players, hidden Mafia, optional Sheriff and Angel roles, night actions, discussion, and secret day votes.
- **Chameleon:** 3 to 8 players, one hidden Chameleon, spoken clues, a dealer tie-break, and a final word guess when the Chameleon is caught.

## Requirements

- Node.js 24 LTS
- pnpm 11.7.0
- PostgreSQL 16 or newer for the isolated database-engine suite
- A Supabase project with anonymous authentication enabled
- The migrations in `supabase/migrations/` applied to that project

## Local setup

Install dependencies:

```bash
pnpm install
```

Create `.env.local` with your project values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`DATABASE_URL` is optional for Drizzle tooling. Keep it local and never commit it. Browser CI starts an isolated Supabase stack and supplies its own local keys.

Start the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) on the host phone or computer. Other players can join from the room QR code, the shared link, or the four-character code.

## Commands

```bash
pnpm dev          # Start the local Next.js server
pnpm lint         # Run ESLint and accessibility checks
pnpm typecheck    # Validate the TypeScript contract
pnpm test         # Run fast repository and schema-contract tests
pnpm test:db      # Run every SQL engine, security, simulation, and race test
pnpm test:e2e     # Run mobile multi-context Playwright games against a running app
pnpm build        # Create a production build
pnpm audit:prod   # Fail on high or critical production dependency advisories
pnpm start        # Serve the production build
```

On macOS with Homebrew PostgreSQL 17, run the engine suite with:

```bash
PGBIN=/opt/homebrew/opt/postgresql@17/bin pnpm test:db
```

The runner creates a temporary database, applies every migration, runs `t01` through `t11`, exercises concurrent day votes and night actions, and removes the database when finished. It never connects to production.

## How a game works

1. The host chooses Mafia or Chameleon and creates a room.
2. Friends join from their phones using the QR code or room code.
3. The host configures the game in the lobby and starts when the minimum player count is met.
4. Each phone reads one participant-authorized snapshot. Private roles and the selected Chameleon word never come from generally readable tables.
5. Realtime invalidates that snapshot; bounded reconnect catch-up replaces lobby polling.
6. Readiness acknowledgements and two-minute recovery deadlines let any participant finish a stalled phase.

If a realtime channel drops, the client reports the connection state, retries with bounded backoff, and catches up when the tab becomes visible again.

## Project structure

```text
src/app/                 Next.js App Router pages, metadata, and install icons
src/components/game/     Shared Chameleon and lobby screens
src/components/game/mafia/  Classic Mafia phases and roles
src/components/ui/       Mobile controls and modal surfaces
src/hooks/               Safe snapshots, realtime recovery, and stale-host detection
src/lib/game/            Client actions, authentication, and game types
supabase/migrations/     Database schema, policies, and game engine functions
supabase/tests/          SQL flow, security, simulation, and concurrency tests
tests/e2e/               Multi-device browser playthroughs and secrecy assertions
tests/                   Fast repository and schema contract checks
```

## Database and security model

- Anonymous Supabase Auth identities are real authenticated participants, not the public `anon` database role.
- Room creation, join, leave, settings, start, phase changes, votes, night actions, rematch, host recovery, and closure use row-locking RPCs.
- `get_game_snapshot` returns the roster plus only the current participant's authorized role, word, vote, and action data.
- The selected Chameleon word lives in `game_secrets`; direct word reads and direct lifecycle table writes are revoked.
- Public room discovery returns only room code, mode, host name, player count, capacity, and creation time.
- Opportunistic cleanup removes stale lobbies after 6 hours, completed games after 24 hours, and orphan guest identities after 7 days.

## Migrations and generated types

Create migrations with the Supabase CLI, apply them to a disposable database first, and keep these files synchronized in the same change:

- `supabase/migrations/*.sql`
- `src/lib/supabase/database.types.ts`
- `src/lib/db/schema.ts`

Regenerate linked types after a successful migration:

```bash
supabase db push --linked
supabase gen types --linked --schema public > src/lib/supabase/database.types.ts
supabase db lint --linked --schema public --level error
```

Never hand-edit production migration history. Verify `supabase migration list --linked` before and after a release.

## Recovery behavior

- A visible game screen sends a participant heartbeat every 30 seconds.
- If the lobby or game-over host is absent for 120 seconds, another participant sees **Recover room controls** and can claim the room deterministically.
- Role and result phases advance after everyone acknowledges them. After 120 seconds, any participant can recover a stalled phase; missing votes or actions become abstentions.
- Realtime channel errors show a banner, retry with bounded backoff, and refetch the authorized snapshot after reconnecting.
- A same-room rematch preserves the room code, players, settings, and join order while clearing roles, secrets, actions, votes, deaths, and results.

## Production checklist

- Apply every checked-in Supabase migration in order.
- Enable anonymous sign-in in Supabase Auth.
- Set the public Supabase URL and anonymous key in the deployment environment.
- Set `NEXT_PUBLIC_SITE_URL` to the production origin for correct share metadata.
- Run lint, typecheck, fast tests, the PostgreSQL engine suite, browser tests, build, and the production dependency audit.
- Confirm generated Supabase types and migration history match the target project.
- Promote a validated frontend artifact immediately after the database migration, then verify the production alias and logs.
- Complete fresh-session Chameleon and Mafia playthroughs on production after database or realtime changes.
- Keep connected game screens free of polling traffic and verify hidden tabs stop directory refreshes.

The web manifest and generated icons support installation to a phone home screen. The game still requires a network connection to create, join, and progress a room.
