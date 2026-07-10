"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "./PlayerGrid";
import { Button } from "@/components/ui/Button";
import type { PlayerView } from "@/lib/game/types";

export function ChameleonTieBreakScreen({
  players,
  tiedPlayerIds,
  dealerId,
  userId,
  currentChoiceId = null,
  onVote,
}: {
  players: PlayerView[];
  tiedPlayerIds: string[];
  dealerId: string | null;
  userId: string;
  currentChoiceId?: string | null;
  onVote: (targetId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(currentChoiceId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(
    () => players.filter((player) => tiedPlayerIds.includes(player.userId) && !player.isEliminated),
    [players, tiedPlayerIds],
  );
  const selectedName = candidates.find((player) => player.userId === selected)?.displayName;
  const choiceChanged = !!selected && selected !== currentChoiceId;
  const isDealer = dealerId === userId;
  const dealerName = players.find((player) => player.userId === dealerId)?.displayName ?? "The dealer";

  async function handleVote() {
    if (!selected || busy || !choiceChanged) return;
    setBusy(true);
    setError(null);
    try {
      await onVote(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the tie-break vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(100% 60% at 50% 0%, color-mix(in srgb, var(--gold-glow) 16%, transparent), transparent 68%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-8 safe-top safe-bottom">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-glow">Dealer decision</span>
          <h1 className="font-display text-3xl font-semibold">The vote is tied</h1>
          <p className="max-w-xs text-sm leading-6 text-foreground-muted">
            {isDealer
              ? "As dealer, choose between the tied players. Your decision sends one player to the final word guess."
              : `${dealerName} is breaking the tie. Keep the discussion at the table while they decide.`}
          </p>
        </motion.div>

        <div className="w-full">
          <PlayerGrid
            players={candidates}
            selectedUserId={selected}
            onSelect={isDealer ? setSelected : undefined}
            meId={userId}
          />
        </div>

        {isDealer && selectedName && (
          <p className="text-center text-sm text-foreground-muted" role="status" aria-live="polite">
            Current choice: <span className="font-semibold text-foreground">{selectedName}</span>
          </p>
        )}
        {error && <p className="text-center text-sm text-outsider-glow">{error}</p>}

        {isDealer ? (
          <Button onClick={handleVote} disabled={!choiceChanged || busy} className="mt-auto w-full">
            {busy ? "Submitting..." : currentChoiceId ? "Change dealer choice" : "Break the tie"}
          </Button>
        ) : (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="mt-auto text-center text-sm text-foreground-muted"
            role="status"
          >
            Waiting for the dealer...
          </motion.p>
        )}
      </div>
    </div>
  );
}
