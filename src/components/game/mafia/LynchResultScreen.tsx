"use client";

import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { Button } from "@/components/ui/Button";
import { toPlayerView, phaseSpring as spring } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

/** Shown after the day vote resolves: who the town voted out (or that the vote
 * tied), before the host sends everyone into the next night. resolve_day
 * records the outcome on games.last_lynch_victim (null = tie / no votes). */
export function LynchResultScreen({
  game,
  players,
  userId,
  isHost,
  onBeginNight,
}: {
  game: Game;
  players: MafiaPlayerView[];
  userId: string;
  isHost: boolean;
  onBeginNight: () => Promise<void>;
}) {
  const submittingRef = useRef(false);

  const victim = useMemo(
    () => players.find((p) => p.userId === game.last_lynch_victim) ?? null,
    [players, game.last_lynch_victim],
  );
  const living = useMemo(
    () => players.filter((p) => !p.isEliminated).map(toPlayerView),
    [players],
  );
  const victimIsMe = victim?.userId === userId;

  async function handleBeginNight() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await onBeginNight();
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
            "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--outsider-glow) 16%, transparent), transparent 60%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-7 w-full max-w-sm mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="flex flex-col items-center gap-2 text-center"
        >
          <span className="role-mark h-14 w-14 text-gold-glow" />
          <h2 className="font-display text-2xl font-bold">The town has spoken</h2>
        </motion.div>

        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...spring, delay: 0.08 }}
          className="flex w-full flex-col items-center gap-2 rounded-3xl px-6 py-6 text-center"
          style={{ background: "var(--surface-raised)", boxShadow: "var(--elevation-3)" }}
        >
          {victim ? (
            <>
              <p className="text-sm text-foreground-muted">Voted out</p>
              <span className="font-display text-xl font-bold text-outsider-glow">
                {victim.displayName}
              </span>
              {victimIsMe && (
                <p className="text-xs text-foreground-muted">
                  That&rsquo;s you. You can keep watching from the afterlife.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="font-display text-lg font-semibold">The vote tied.</p>
              <p className="text-sm text-foreground-muted">No one was voted out today.</p>
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
            <Button onClick={handleBeginNight} className="w-full">
              Begin the night
            </Button>
          ) : (
            <p className="text-center text-sm text-foreground-muted">Waiting for the host...</p>
          )}
        </div>
      </div>
    </div>
  );
}
