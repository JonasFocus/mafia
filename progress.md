Original prompt: lets use these to give the web game a whole new dark mode design; also build out a 1 page landing/splash page for a website, super aesthetic and buttery smooth, using subagents.

Progress:
- Read AGENTS.md/CLAUDE.md and relevant local Next 16 docs before edits.
- Spawned explorer agents for app surface mapping, shadcn-inspired design references, tooling/docs, and game-state styling risks.
- Generated a noir landing/game UI concept and a separate hero background image.
- Copied the selected hero image to public/landing/mafia-noir-table.png.
- Implemented a new one-page splash route, refreshed dark tokens, updated shared controls, redesigned the lobby shell, and rethemed reveal/vote surfaces without changing Supabase game logic.
- Verified desktop/mobile landing, host, join, and actual temporary lobby screenshots. Removed temporary QA screenshots.
- Ran pnpm run lint, pnpm run test, pnpm run build, and the web-game Playwright client. The DB-backed test skipped because DATABASE_URL is absent.
- Created and deleted temporary live QA rooms; verified no open rooms remain.

Current TODO:
- No known follow-up from this pass.

---

Original prompt: Implement the Mafia & Chameleon production-readiness plan, including CI, Supabase hardening, canonical Chameleon rules, host-independent progression, mobile/realtime UX, and multiplayer QA.

Progress:
- Confirmed `main` is clean and matches `origin/main` at `92d0258`.
- Read the Supabase, Next.js 16, and web-game implementation skills plus relevant local Next.js docs.
- Verified current Supabase changelog constraints, including explicit Data API grants for new public tables.
- Fixed the CI package-manager ordering, pinned Node 24/pnpm 11.7.0, split quality/database jobs, and added typecheck/database/e2e/audit scripts.
- Added a lean local Supabase configuration with anonymous auth enabled for isolated browser testing.
- Installed PostgreSQL 17 locally so the SQL engine suite can run against the same major version as production.

Current TODO:
- No known implementation or production follow-up remains.
- The only unperformed release step is committing/pushing these local changes so GitHub-hosted checks can run; no commit was requested.

Completed implementation:
- Added transactional lifecycle RPCs, participant-safe snapshots, protected Chameleon secrets, phase acknowledgements, dealer/host recovery, rematches, retention cleanup, and stable client error mapping.
- Replaced direct lifecycle/gameplay writes, including the final clue-completion insert, with row-locking server functions.
- Implemented strict-majority Mafia nights, majority-participation day votes, canonical 3-8 player Chameleon rules, dealer tie-breaks, one/two controlled word guesses, and two-minute recovery semantics.
- Regenerated linked Supabase types and synchronized the Drizzle schema after applying all production migrations.
- Added snapshot-driven realtime state, debounced invalidations, bounded reconnect backoff, visible-session heartbeats, host-only shared freshness, stale-host takeover UI, and terminal room-close handling.
- Added accessible dialogs, selection semantics, 44px touch targets, safe-area sizing, PWA metadata/icons, reduced-motion handling, and corrected mobile player-count copy.
- Split CI into quality, PostgreSQL 16 engine, and isolated Supabase/Playwright browser jobs; removed the skipped DB contract and fixed the numbered SQL glob.
- Added complete four-device Chameleon and five-device Mafia browser games with concurrent joins, start/leave racing, refresh/reentry, action revisions, secrecy assertions, tie-break, spectator state, recovery, rematch, and room closure.
- Verified PostgreSQL 16 and 17 migrations plus t01-t11 and 16 concurrency races, TypeScript, ESLint, fast tests, production build, dependency audit, schema lint, migration parity, PWA endpoints, and production mobile layouts.
- Completed four-device Chameleon and five-device Mafia production-backed browser games, then closed all known QA rooms through public lifecycle RPCs.
- Added an expected terminal snapshot tombstone after production QA exposed closed-room catch-up requests surfacing as HTTP 500; verified the close race now has zero console errors.
- Promoted deployment `dpl_8LzR4VjAvwAvF4kMsDfp2v8V7d2n` to `mafia.krevo.io` and verified iPhone SE, modern iPhone, 360px Android, landscape, reduced motion, touch targets, route health, console output, and runtime logs.
