"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { ChipDrop } from "@/components/game/ChipDrop";
import { Button } from "@/components/ui/Button";
import { toPlayerView, phaseSpring as spring } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

export function DayVoteScreen({
  game,
  players,
  me,
  userId,
  myDayVoteCast,
  currentVoteTargetId = null,
  onVote,
}: {
  game: Game;
  players: MafiaPlayerView[];
  me: MafiaPlayerView;
  userId: string;
  myDayVoteCast: boolean;
  currentVoteTargetId?: string | null;
  onVote: (targetId: string) => Promise<void>;
}) {
  void game;
  void me;

  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipDrop, setChipDrop] = useState(false);
  const submittingRef = useRef(false);

  const votable = useMemo(
    () => players.filter((p) => !p.isEliminated).map(toPlayerView),
    [players],
  );
  const effectiveSelection = selected ?? currentVoteTargetId;
  const hasRecordedVote = myDayVoteCast || currentVoteTargetId != null;
  const choiceChanged = !!effectiveSelection && effectiveSelection !== currentVoteTargetId;
  const currentChoiceName = currentVoteTargetId
    ? players.find((player) => player.userId === currentVoteTargetId)?.displayName ?? "Unknown player"
    : null;

  async function handleVote() {
    if (!effectiveSelection || !choiceChanged || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    setChipDrop(true);
    try {
      await onVote(effectiveSelection);
      setSelected(null);
      setChipDrop(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cast vote");
      setSubmitting(false);
      setChipDrop(false);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 50% -10%, color-mix(in srgb, var(--gold-glow) 14%, transparent), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, var(--outsider-glow) 160%)",
          opacity: 0.05,
        }}
      />

      <motion.div
        key="voting"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto"
      >
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="font-display text-2xl font-bold">Who do you vote out?</h2>
              <p className="text-sm text-foreground-muted">Your vote is secret. A tie means no one.</p>
            </div>

            <div className="relative w-full">
              <PlayerGrid players={votable} selectedUserId={effectiveSelection} onSelect={setSelected} meId={userId} />
              <AnimatePresence>
                {chipDrop && effectiveSelection && (
                  <ChipDrop
                    key="chip"
                    index={votable.findIndex((p) => p.userId === effectiveSelection)}
                    playerCount={votable.length}
                  />
                )}
              </AnimatePresence>
            </div>

            {hasRecordedVote && currentChoiceName && (
              <p className="text-center text-sm text-foreground-muted" role="status" aria-live="polite">
                Current choice: <span className="font-semibold text-foreground">{currentChoiceName}</span>. Select another player to change it.
              </p>
            )}

            {error && <p className="text-sm text-outsider-glow">{error}</p>}

            <Button onClick={handleVote} disabled={!choiceChanged || submitting} className="w-full mt-auto">
              {submitting ? "Saving vote..." : hasRecordedVote ? "Change vote" : "Cast vote"}
            </Button>
      </motion.div>
    </div>
  );
}
