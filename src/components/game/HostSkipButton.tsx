"use client";

import { useState } from "react";
import { advanceGamePhase } from "@/lib/game/actions";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";

/** Server-authorized escape hatch shown after a phase recovery timeout. Resolves
 * with submitted choices so any connected participant can recover the table. */
export function HostSkipButton({
  gameId,
  onAdvanced,
  description = "The server will resolve using the choices already submitted. Use this only when the table is stalled.",
  confirmLabel = "Resolve submitted choices",
}: {
  gameId: string;
  onAdvanced?: () => void | Promise<void>;
  description?: string;
  confirmLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await advanceGamePhase(gameId);
      await onAdvanced?.();
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not recover this phase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={busy}
        className="fixed right-3 z-40 min-h-11 rounded-full px-4 py-2 text-xs font-semibold text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        style={{
          top: "max(0.75rem, var(--safe-top))",
          background: "var(--surface-overlay)",
          boxShadow: "var(--elevation-2)",
        }}
      >
        Recover phase
      </button>

      {error && (
        <p className="fixed inset-x-4 top-20 z-40 mx-auto max-w-sm rounded-[14px] border border-outsider-glow/40 bg-background px-4 py-3 text-center text-sm text-outsider-glow">
          {error}
        </p>
      )}

      <BottomSheet open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} ariaLabel="Recover stalled phase">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-semibold">Recover this phase?</h2>
            <p className="text-sm leading-6 text-foreground-muted">{description}</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handle} disabled={busy} className="w-full">
              {busy ? "Recovering..." : confirmLabel}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy} className="w-full">
              Keep waiting
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
