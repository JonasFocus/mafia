"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PlayerView } from "@/lib/game/types";

export function PhaseProgressControls({
  players,
  readyPlayerIds,
  userId,
  readyLabel = "I’m ready",
  readyMessage = "Ready. Waiting for the table...",
  advanceLabel = "Continue",
  canAdvance = false,
  recoveryAvailable = false,
  requireEveryone = true,
  onReady,
  onAdvance,
}: {
  players: PlayerView[];
  readyPlayerIds: string[];
  userId: string;
  readyLabel?: string;
  readyMessage?: string;
  advanceLabel?: string;
  canAdvance?: boolean;
  recoveryAvailable?: boolean;
  requireEveryone?: boolean;
  onReady: () => Promise<void>;
  onAdvance?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"ready" | "advance" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const participants = players;
  const readySet = new Set(readyPlayerIds);
  const readyCount = participants.filter((player) => readySet.has(player.userId)).length;
  const everyoneReady = participants.length > 0 && readyCount >= participants.length;
  const myReady = readySet.has(userId);

  async function run(kind: "ready" | "advance", action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the phase. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        className="flex items-center justify-between gap-3 rounded-[16px] border border-surface-border bg-surface/70 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <span className="text-sm text-foreground-muted">Table readiness</span>
        <span className="font-mono text-sm font-semibold text-foreground">
          {readyCount}/{participants.length}
        </span>
      </div>

      {!myReady ? (
        <Button onClick={() => run("ready", onReady)} disabled={busy !== null} className="w-full">
          {busy === "ready" ? "Marking ready..." : readyLabel}
        </Button>
      ) : (
        <p className="min-h-6 text-center text-sm text-foreground-muted">{readyMessage}</p>
      )}

      {onAdvance && (canAdvance || recoveryAvailable) && (
        <Button
          variant="secondary"
          onClick={() => run("advance", onAdvance)}
          disabled={busy !== null || (!recoveryAvailable && requireEveryone && !everyoneReady)}
          className="w-full"
        >
          {busy === "advance"
            ? "Continuing..."
            : recoveryAvailable && !everyoneReady
              ? "Recover stalled phase"
              : advanceLabel}
        </Button>
      )}

      {error && <p className="text-center text-sm text-outsider-glow">{error}</p>}
    </div>
  );
}
