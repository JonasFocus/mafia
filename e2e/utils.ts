import type { Page } from "@playwright/test";

/**
 * Attaches listeners that record uncaught page errors (thrown exceptions / unhandled
 * rejections) and console.error messages. Call `.assertNone()` at the end of a test to
 * fail with a readable message if anything was captured.
 *
 * Network errors for Supabase calls are expected in this sandbox (no backend is
 * configured) and are NOT treated as failures by themselves — those show up as
 * rejected fetches/console warnings from Supabase client code, not as uncaught
 * `pageerror` exceptions or React error-boundary crashes. We only care about the
 * latter: this suite's job is to catch actual page crashes, not backend outages.
 */
export function collectPageErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  return {
    pageErrors,
    consoleErrors,
    /** Throws if any uncaught exception occurred on the page. Console.error is reported but not fatal by default. */
    assertNone({ allowConsoleErrors = true }: { allowConsoleErrors?: boolean } = {}) {
      if (pageErrors.length > 0) {
        throw new Error(`Uncaught page error(s):\n${pageErrors.join("\n")}`);
      }
      if (!allowConsoleErrors && consoleErrors.length > 0) {
        throw new Error(`Console error(s):\n${consoleErrors.join("\n")}`);
      }
    },
  };
}
