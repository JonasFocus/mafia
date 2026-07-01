@AGENTS.md

# Mafia — project notes

Party game (Chameleon/Outsider-style + a Classic Mafia mode). Solo mobile-first web app.

## Stack (actual, not the default)
- Next.js 16.2.9 (App Router), React 19, TypeScript, Tailwind v4
- **Supabase** for everything backend: Postgres DB, Auth (anonymous/guest users), Realtime. No separate API layer — client talks to Supabase directly (`src/lib/supabase/client.ts`, `server.ts`) plus Postgres functions (RPCs) for game logic.
- Drizzle (`drizzle-orm`, `drizzle-kit`) is used **only** as a schema/migration authoring tool — `drizzle.config.ts` points `out` at `supabase/migrations`. There is no Drizzle client at runtime; the app reads/writes via `@supabase/supabase-js`. Game logic (dealing roles, resolving votes, phase transitions) lives in Postgres functions under `supabase/migrations/*_functions.sql`, not in TypeScript.
- State/UI: Zustand, Framer Motion.
- Deployed on **Vercel**, project name `mafia` (prod: mafia-ashy-beta.vercel.app).

## Non-standard structure (see AGENTS.md warning)
- Middleware file is `src/proxy.ts`, not `middleware.ts` — this Next.js version renamed it. It refreshes the Supabase session on every request.
- Two game modes share the app: the original mode (`src/components/game/*`, `use-game.ts`) and Classic Mafia (`src/components/game/mafia/*`, `use-mafia-game.ts`). `GameMode = "chameleon" | "mafia"` in `src/lib/game/types.ts`.
- Routes: `/host` (create game), `/join` (join by room code), `/game/[roomCode]` (play).

## Database
- Schema/migrations in `supabase/migrations/`, applied in filename (timestamp) order.
- Key tables: `users`, `categories`, `games`, `game_players_public`, `rounds`, plus Mafia-mode additions: `night_actions`, `day_votes`, mafia settings/enums (`player_role`: faithful/mafia/sheriff/angel).
- RLS is on (`*_rls_policies.sql`) — most reads/writes go through policies, not a trusted backend.
- Generated TS types: `src/lib/supabase/database.types.ts` (regenerate with the Supabase MCP `generate_typescript_types` tool or `supabase gen types` after any schema change).

## Environment variables
Runtime code only reads two: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (used in `src/lib/supabase/client.ts`, `server.ts`, and `src/proxy.ts`). `DATABASE_URL` is only needed locally for `drizzle-kit` to generate migrations — not read by the app itself.

**As of 2026-07-01, the Vercel project (`mafia`) had zero environment variables configured** despite being deployed live — meaning production requests to Supabase would fail. Needed on Vercel (Production + Preview):
- `NEXT_PUBLIC_SUPABASE_URL` = `https://svjbvxxllxlxhykkbowe.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon/publishable key from the Supabase `mafia` project

Add via `vercel env add NEXT_PUBLIC_SUPABASE_URL production` (repeat per var/environment), or in the Vercel dashboard → Project → Settings → Environment Variables. After adding, redeploy for it to take effect.

⚠️ `vercel link` / `vercel env pull` will **overwrite `.env.local`** with whatever is set on Vercel — if Vercel has no vars, it wipes local Supabase keys. Back up `.env.local` before running either.
