"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { Button } from "@/components/ui/Button";
import { toPlayerView, phaseSpring as spring } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

export function DayResultScreen({
  game,
  players,
  isHost,
  onBeginVote,
}: {
  game: Game;
  players: MafiaPlayerView[];
  isHost: boolean;
  onBeginVote: () => Promise<void>;
}) {
  const submittingRef = useRef(false);

  const eliminated = useMemo(
    () => players.filter((p) => p.isEliminated),
    [players],
  );
  const living = useMemo(
    () => players.filter((p) => !p.isEliminated).map(toPlayerView),
    [players],
  );

  // Read the "already seen dead" snapshot ONCE via a lazy state initializer. The
  // previous code *wrote* sessionStorage during render (inside useMemo), which can
  // double-fire under StrictMode/refresh — the second pass reads back the ids it
  // just wrote, computes an empty diff, and silently flips a death to "No one
  // died". The write now lives in an effect after commit.
  const [prevSeen] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(sessionStorage.getItem(`mafia:${game.id}:deadSeen`) ?? "[]") as string[];
    } catch {
      return [];
    }
  });

  const victims = useMemo(() => {
    const seededBefore = prevSeen.length > 0;
    const fresh = eliminated.filter((p) => !prevSeen.includes(p.userId));
    // Only trust the diff once we've observed a prior snapshot in this browser.
    return seededBefore ? fresh : fresh.length === 1 ? fresh : [];
  }, [eliminated, prevSeen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        `mafia:${game.id}:deadSeen`,
        JSON.stringify(eliminated.map((p) => p.userId)),
      );
    } catch {
      // sessionStorage unavailable; best-effort
    }
  }, [eliminated, game.id]);

  const noOneDied = victims.length === 0;

  async function handleBeginVote() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onBeginVote();
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--gold-glow) 22%, transparent), transparent 60%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-7 w-full max-w-sm mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="flex flex-col items-center gap-2 text-center"
        >
          <span className="text-4xl">🌅</span>
          <h2 className="font-display text-2xl font-bold">Morning breaks</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="flex w-full flex-col items-center gap-2 rounded-3xl px-6 py-6 text-center"
          style={{ background: "var(--surface-raised)", boxShadow: "var(--elevation-3)" }}
        >
          {noOneDied ? (
            <p className="font-display text-lg font-semibold">No one died last night.</p>
          ) : (
            <>
              <p className="text-sm text-foreground-muted">Found dead this morning</p>
              <div className="flex flex-col items-center gap-1">
                {victims.map((v) => (
                  <span key={v.userId} className="font-display text-xl font-bold text-outsider-glow">
                    {v.displayName}
                  </span>
                ))}
              </div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.16 }}
          className="flex w-full flex-col items-center gap-3"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            Still standing
          </p>
          <PlayerGrid players={living} />
        </motion.div>

        <div className="mt-auto w-full">
          {isHost ? (
            <Button onClick={handleBeginVote} className="w-full">
              Start the vote
            </Button>
          ) : (
            <p className="text-center text-sm text-foreground-muted">Waiting for the host…</p>
          )}
        </div>
      </div>
    </div>
  );
}
