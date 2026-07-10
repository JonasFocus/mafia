"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerGrid } from "./PlayerGrid";
import { ChipDrop } from "./ChipDrop";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { castChameleonVote } from "@/lib/game/actions";
import type { PlayerView } from "@/lib/game/types";

export function VotingScreen({
  userId,
  gameId,
  players,
  votedIds,
  myVoteCast,
  currentVoteTargetId = null,
}: {
  userId: string;
  gameId: string;
  players: PlayerView[];
  votedIds: string[];
  myVoteCast: boolean;
  currentVoteTargetId?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipDrop, setChipDrop] = useState(false);
  const submittingRef = useRef(false);

  const votable = players.filter((p) => !p.isEliminated);

  const votedCount = votedIds.length;
  const totalCount = votable.length;
  const voteFraction = totalCount > 0 ? votedCount / totalCount : 0;
  const effectiveSelection = selected ?? currentVoteTargetId;
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
      await castChameleonVote(gameId, effectiveSelection);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cast vote");
      setChipDrop(false);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  const vignetteOpacity = 0.06 * Math.max(voteFraction, myVoteCast ? 1 / Math.max(totalCount, 1) : 0);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{
          background: `radial-gradient(ellipse at center, transparent 40%, var(--outsider-glow) 150%)`,
          opacity: vignetteOpacity,
        }}
      />

      <AnimatePresence mode="wait">
          <motion.div
            key="voting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto"
          >
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="font-display text-2xl font-bold">Who is the Chameleon?</h2>
              <p className="text-sm text-foreground-muted">Choose carefully. A tied vote goes to one final ballot.</p>
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

            <VoteCounterCard players={votable} votedIds={votedIds} meId={userId} compact />

            {myVoteCast && currentChoiceName && (
              <p className="text-center text-sm text-foreground-muted" role="status" aria-live="polite">
                Current choice: <span className="font-semibold text-foreground">{currentChoiceName}</span>. Select another player to change it.
              </p>
            )}

            {error && <p className="text-sm text-outsider-glow">{error}</p>}
            <Button onClick={handleVote} disabled={!choiceChanged || submitting} className="w-full mt-auto">
              {submitting ? "Saving vote..." : myVoteCast ? "Change vote" : "Cast vote"}
            </Button>
          </motion.div>
      </AnimatePresence>
    </div>
  );
}

function VoteCounterCard({
  players,
  votedIds,
  meId,
  compact = false,
}: {
  players: PlayerView[];
  votedIds: string[];
  meId: string;
  compact?: boolean;
}) {
  const votedSet = new Set(votedIds);
  const votedCount = players.filter((p) => votedSet.has(p.userId)).length;

  return (
    <div
      className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl px-5 py-4"
      style={{ background: "var(--surface-raised)", boxShadow: "var(--elevation-3)" }}
    >
      <span className="font-display text-lg font-bold">
        {votedCount} <span className="text-foreground-muted font-normal">of</span> {players.length}{" "}
        <span className="text-foreground-muted font-normal">voted</span>
      </span>
      {!compact && (
        <p className="text-sm text-foreground-muted">Waiting for everyone else to lock in their vote...</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {players.map((p) => {
          const hasVoted = votedSet.has(p.userId);
          return (
            <div key={p.userId} className="relative">
              <Avatar name={p.displayName} index={p.joinOrder} size={36} dimmed={!hasVoted} />
              {hasVoted && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: "var(--civilian-glow)", color: "var(--background)" }}
                >
                  ✓
                </span>
              )}
              {p.userId === meId && (
                <span
                  className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full px-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: "var(--gold-glow)", color: "var(--background-deep)" }}
                >
                  you
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
