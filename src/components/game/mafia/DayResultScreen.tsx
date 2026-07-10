"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { PhaseProgressControls } from "@/components/game/PhaseProgressControls";
import { toPlayerView, phaseSpring as spring } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

export function DayResultScreen({
  game,
  players,
  userId,
  readyPlayerIds,
  canAdvance,
  recoveryAvailable,
  onReady,
  onBeginVote,
}: {
  game: Game;
  players: MafiaPlayerView[];
  userId: string;
  readyPlayerIds: string[];
  canAdvance: boolean;
  recoveryAvailable: boolean;
  onReady: () => Promise<void>;
  onBeginVote: () => Promise<void>;
}) {
  const eliminated = useMemo(
    () => players.filter((p) => p.isEliminated),
    [players],
  );
  const living = useMemo(
    () => players.filter((p) => !p.isEliminated).map(toPlayerView),
    [players],
  );

  // resolve_night records the victim on the games row (null = saved/no kill),
  // so this survives reloads and lost sessionStorage.
  const victims = useMemo(
    () => eliminated.filter((p) => p.userId === game.last_night_victim),
    [eliminated, game.last_night_victim],
  );

  const noOneDied = victims.length === 0;

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
          role="status"
          aria-live="polite"
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
          <PhaseProgressControls
            players={players.map(toPlayerView)}
            readyPlayerIds={readyPlayerIds}
            userId={userId}
            readyLabel="I saw the morning result"
            readyMessage="Ready to discuss and vote."
            advanceLabel="Start the vote"
            canAdvance={canAdvance}
            recoveryAvailable={recoveryAvailable}
            onReady={onReady}
            onAdvance={onBeginVote}
          />
        </div>
      </div>
    </div>
  );
}
