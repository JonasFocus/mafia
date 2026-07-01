"use client";

import { useState } from "react";
import { forceAdvancePhase } from "@/lib/game/actions";

/** Host-only escape hatch shown during phases that wait on all players. Resolves
 * the phase with whatever has been submitted, recovering from an abandoned player. */
export function HostSkipButton({ gameId }: { gameId: string }) {
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    setBusy(true);
    try {
      await forceAdvancePhase(gameId);
    } catch {
      // best-effort; the phase may have already resolved
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="fixed right-3 z-40 rounded-full px-3 py-1.5 text-[11px] font-semibold text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
      style={{
        top: "max(0.75rem, var(--safe-top))",
        background: "var(--surface-overlay)",
        boxShadow: "var(--elevation-2)",
      }}
    >
      {busy ? "Skipping…" : "Skip phase ›"}
    </button>
  );
}
