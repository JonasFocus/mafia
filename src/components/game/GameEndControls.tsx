"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

export function GameEndControls({
  isHost,
  canRecoverHost = false,
  onRematch,
  onClose,
  onRecoverHost,
}: {
  isHost: boolean;
  canRecoverHost?: boolean;
  onRematch: () => Promise<void>;
  onClose: () => Promise<void>;
  onRecoverHost?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"rematch" | "close" | "recover" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "rematch" | "close" | "recover", action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action();
      if (kind === "recover") setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the room. Try again.");
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex w-full flex-col gap-3">
        {isHost ? (
          <>
            <Button onClick={() => run("rematch", onRematch)} disabled={busy !== null} className="w-full">
              {busy === "rematch" ? "Preparing rematch..." : "Play again in this room"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClose(true)} disabled={busy !== null} className="w-full">
              Close room
            </Button>
          </>
        ) : canRecoverHost && onRecoverHost ? (
          <Button onClick={() => run("recover", onRecoverHost)} disabled={busy !== null} className="w-full">
            {busy === "recover" ? "Recovering room controls..." : "Recover room controls"}
          </Button>
        ) : (
          <p className="text-center text-sm text-foreground-muted">The host can start a rematch without sending a new code.</p>
        )}

        <Link
          href="/"
          className="flex min-h-12 items-center justify-center rounded-[14px] px-4 text-sm font-semibold text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Back to home
        </Link>
        {error && <p className="text-center text-sm text-outsider-glow">{error}</p>}
      </div>

      <BottomSheet open={confirmClose} onClose={() => !busy && setConfirmClose(false)} ariaLabel="Close room confirmation">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-semibold">Close this room?</h2>
            <p className="text-sm leading-6 text-foreground-muted">
              Everyone will be sent out of the room. This cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={() => run("close", onClose)} disabled={busy !== null} className="w-full">
              {busy === "close" ? "Closing room..." : "Yes, close room"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmClose(false)} disabled={busy !== null} className="w-full">
              Keep room open
            </Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
