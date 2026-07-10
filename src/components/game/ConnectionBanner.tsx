"use client";

import type { GameConnectionState } from "@/hooks/use-realtime-connection";

const COPY: Record<Exclude<GameConnectionState, "connected">, string> = {
  connecting: "Connecting to the table...",
  reconnecting: "Reconnecting to the table...",
  offline: "You’re offline. Choices will not update until you reconnect.",
  error: "Live updates are unavailable.",
};

export function ConnectionBanner({
  state,
  onRetry,
}: {
  state: GameConnectionState;
  onRetry: () => void;
}) {
  if (state === "connected") return null;
  const retryable = state === "offline" || state === "error";

  return (
    <div
      className="fixed inset-x-3 z-50 mx-auto flex min-h-12 max-w-sm items-center justify-between gap-3 rounded-[14px] border border-surface-border-strong bg-surface-overlay px-4 py-2 text-sm shadow-2xl"
      style={{ top: "max(0.75rem, var(--safe-top))" }}
      role={retryable ? "alert" : "status"}
      aria-live={retryable ? "assertive" : "polite"}
    >
      <span className="leading-5 text-foreground-muted">{COPY[state]}</span>
      {retryable && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold text-accent-bright outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Retry
        </button>
      )}
    </div>
  );
}
