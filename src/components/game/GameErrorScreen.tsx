"use client";

import Link from "next/link";

/** Shared error screen for the game route: retry for recoverable errors, always
 * a way back home. Retry is hidden for a missing or ended game. */
export function GameErrorScreen({ error }: { error: string }) {
  const canRetry = !/room not found|no longer exists|room has expired|not a player/i.test(error);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center safe-top safe-bottom">
      <p className="text-foreground-muted">{error}</p>
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        {canRetry && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex h-12 w-full items-center justify-center rounded-full font-display font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{
              background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
              boxShadow: "inset 0 -3px 0 var(--accent-deep), 0 4px 0 var(--accent-deep), 0 6px 14px rgba(0,0,0,0.4)",
            }}
          >
            Try again
          </button>
        )}
        <Link href="/" className="text-sm font-medium text-foreground-muted">
          Back to home
        </Link>
      </div>
    </main>
  );
}
