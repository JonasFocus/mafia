import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke-test config. This project has no Supabase backend available in CI/sandboxes
 * (no .env, no live project, no network to Supabase), so these tests only verify that
 * pages boot and render their initial UI without crashing — not full user flows
 * (e.g. actually creating/joining a room).
 *
 * Tests run against a production build (`next build` + `next start`) rather than
 * `next dev`, since that's more representative of real behavior. Playwright's
 * `webServer` below builds and starts the app automatically before the test run.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The sandbox's pre-installed browser (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers)
        // is an older revision than what this @playwright/test version expects by
        // default, so the bundled-browser lookup fails ("Executable doesn't exist at
        // .../chromium_headless_shell-1228/..."). Point at the known-good binary
        // directly rather than running `playwright install` (not permitted here).
        launchOptions: {
          executablePath: "/opt/pw-browsers/chromium",
        },
      },
    },
  ],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
