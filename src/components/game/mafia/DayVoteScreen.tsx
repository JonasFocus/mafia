"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { Button } from "@/components/ui/Button";
import { toPlayerView, phaseSpring as spring } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

export function DayVoteScreen({
  game,
  players,
  me,
  userId,
  myDayVoteCast,
  onVote,
}: {
  game: Game;
  players: MafiaPlayerView[];
  me: MafiaPlayerView;
  userId: string;
  myDayVoteCast: boolean;
  onVote: (targetId: string) => Promise<void>;
}) {
  void game;
  void me;

  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chipDrop, setChipDrop] = useState(false);

  const votable = useMemo(
    () => players.filter((p) => !p.isEliminated).map(toPlayerView),
    [players],
  );

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setChipDrop(true);
    try {
      await onVote(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cast vote");
      setSubmitting(false);
      setChipDrop(false);
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

      <AnimatePresence mode="wait">
        {myDayVoteCast ? (
          <motion.div
            key="waiting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={spring}
            className="relative flex flex-1 flex-col items-center justify-center px-6 gap-6 text-center safe-top safe-bottom"
          >
            <motion.span
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="text-4xl"
            >
              🗳️
            </motion.span>
            <div
              className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl px-6 py-6 text-center"
              style={{ background: "var(--surface-raised)", boxShadow: "var(--elevation-3)" }}
            >
              <span className="font-display text-lg font-bold">Your vote is in</span>
              <p className="text-sm text-foreground-muted">
                Waiting for the town to finish voting…
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="voting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={spring}
            className="relative flex flex-1 flex-col items-center px-6 py-8 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto"
          >
            <div className="flex flex-col items-center gap-1 text-center">
              <h2 className="font-display text-2xl font-bold">Who do you vote out?</h2>
              <p className="text-sm text-foreground-muted">Your vote is secret. A tie means no one.</p>
            </div>

            <div className="relative w-full">
              <PlayerGrid players={votable} selectedUserId={selected} onSelect={setSelected} meId={userId} />
              <AnimatePresence>
                {chipDrop && selected && (
                  <ChipDrop
                    key="chip"
                    index={votable.findIndex((p) => p.userId === selected)}
                    playerCount={votable.length}
                  />
                )}
              </AnimatePresence>
            </div>

            {error && <p className="text-sm text-outsider-glow">{error}</p>}

            <Button onClick={handleVote} disabled={!selected || submitting} className="w-full mt-auto">
              {submitting ? "Casting vote…" : "Cast Vote"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipDrop({ index, playerCount }: { index: number; playerCount: number }) {
  const columns = Math.min(playerCount, 4);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const originX = `calc(${(col + 0.5) * (100 / columns)}% - 50%)`;
  const originY = row * 96;

  return (
    <motion.div
      initial={{ x: originX, y: originY, scale: 1, opacity: 1 }}
      animate={{
        x: "calc(50% - 50%)",
        y: -12,
        scale: [1, 1.3, 0.9, 1],
        opacity: [1, 1, 1, 0],
      }}
      transition={{ duration: 0.55, times: [0, 0.5, 0.85, 1], ease: [0.2, 0, 0.4, 1] }}
      className="pointer-events-none absolute left-1/2 top-1/2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
      style={{
        background: "var(--gold-glow)",
        color: "var(--background-deep)",
        boxShadow: "var(--elevation-3)",
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      ●
    </motion.div>
  );
}
