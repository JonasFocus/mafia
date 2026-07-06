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
