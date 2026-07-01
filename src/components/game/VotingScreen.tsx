"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "./PlayerGrid";
import { Button } from "@/components/ui/Button";
import { castVote } from "@/lib/game/actions";
import type { PlayerView, Round } from "@/lib/game/types";

export function VotingScreen({
  userId,
  players,
  round,
  myVoteCast,
}: {
  userId: string;
  players: PlayerView[];
  round: Round;
  myVoteCast: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const votable = players.filter((p) => !p.isEliminated);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await castVote(round.id, userId, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cast vote");
      setSubmitting(false);
    }
  }

  if (myVoteCast) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 gap-3 text-center safe-top safe-bottom">
        <motion.span
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-4xl"
        >
          🗳️
        </motion.span>
        <p className="text-foreground-muted">Vote cast — waiting for everyone else…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-8 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto">
      <h2 className="font-display text-2xl font-bold text-center">Who&apos;s the Mafia?</h2>
      <PlayerGrid players={votable} selectedUserId={selected} onSelect={setSelected} meId={userId} />
      {error && <p className="text-sm text-outsider-glow">{error}</p>}
      <Button onClick={handleVote} disabled={!selected || submitting} className="w-full mt-auto">
        {submitting ? "Casting vote…" : "Cast Vote"}
      </Button>
    </div>
  );
}
