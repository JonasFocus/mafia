"use client";

import { motion } from "framer-motion";
import { RoleCard } from "./RoleCard";
import { PhaseProgressControls } from "./PhaseProgressControls";
import type { PlayerView } from "@/lib/game/types";
import type { GuessWordOption } from "./ChameleonGuessScreen";

export function ChameleonRoleRevealScreen({
  userId,
  players,
  readyPlayerIds,
  isChameleon,
  word,
  wordOptions,
  category,
  canAdvance,
  recoveryAvailable,
  onReady,
  onAdvance,
}: {
  userId: string;
  players: PlayerView[];
  readyPlayerIds: string[];
  isChameleon: boolean;
  word: string | null;
  wordOptions: GuessWordOption[];
  category: string;
  canAdvance: boolean;
  recoveryAvailable: boolean;
  onReady: () => Promise<void>;
  onAdvance: () => Promise<void>;
}) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-5 overflow-y-auto px-6 py-8 safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground-muted">Secret setup</span>
        <h1 className="font-display text-3xl font-semibold">Reveal privately</h1>
        <p className="text-sm text-foreground-muted">Tap the card, remember what you see, then mark yourself ready.</p>
      </motion.div>

      <div className="w-full flex-1 py-2">
        <RoleCard
          isChameleon={isChameleon}
          word={word}
          wordOptions={wordOptions}
          category={category}
        />
      </div>

      <PhaseProgressControls
        players={players}
        readyPlayerIds={readyPlayerIds}
        userId={userId}
        readyLabel="I saw my role"
        readyMessage="Role saved. Keep the screen private."
        advanceLabel="Start spoken clues"
        canAdvance={canAdvance}
        recoveryAvailable={recoveryAvailable}
        onReady={onReady}
        onAdvance={onAdvance}
      />
    </div>
  );
}
