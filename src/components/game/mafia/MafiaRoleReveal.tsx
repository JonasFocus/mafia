"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { MafiaRoleCard } from "@/components/game/mafia/MafiaRoleCard";
import type { Game, MafiaPlayerView, PlayerRole } from "@/lib/game/types";

export function MafiaRoleReveal({
  game,
  players,
  me,
  myRole,
  fellowMafia,
  isHost,
  onBeginNight,
}: {
  game: Game;
  players: MafiaPlayerView[];
  me: MafiaPlayerView;
  myRole: PlayerRole;
  fellowMafia: MafiaPlayerView[];
  isHost: boolean;
  onBeginNight: () => Promise<void>;
}) {
  void game;
  void me;
  const [beginning, setBeginning] = useState(false);

  async function handleBeginNight() {
    if (beginning) return;
    setBeginning(true);
    try {
      await onBeginNight();
    } catch {
      setBeginning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-8 safe-top safe-bottom w-full max-w-sm mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <span className="text-xs tracking-[0.2em] uppercase text-foreground-muted">Your secret role</span>
        <h1 className="font-display text-2xl font-bold text-foreground">Keep it to yourself</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.08, type: "spring", stiffness: 380, damping: 24 }}
        className="flex w-full flex-1 items-center justify-center py-6"
      >
        <MafiaRoleCard role={myRole} fellowMafia={fellowMafia} />
      </motion.div>

      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <p className="text-center text-xs text-foreground-muted">
          {players.length} players in this game.
        </p>
        {isHost ? (
          <Button className="w-full" onClick={handleBeginNight} disabled={beginning}>
            {beginning ? "Starting…" : "Begin night"}
          </Button>
        ) : (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            className="text-center text-sm text-foreground-muted"
          >
            Waiting for the host to begin the night…
          </motion.p>
        )}
      </div>
    </div>
  );
}
