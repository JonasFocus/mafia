"use client";

import { motion } from "framer-motion";

/** The vote "chip" that drops from a selected player's cell toward the tally.
 * Shared by the chameleon and mafia vote screens. */
export function ChipDrop({ index, playerCount }: { index: number; playerCount: number }) {
  const columns = Math.min(playerCount, 4);
  const col = index % columns;
  const row = Math.floor(index / columns);
  const originX = `calc(${(col + 0.5) * (100 / columns)}% - 50%)`;
  // Row pitch of the PlayerGrid (cell + gap); names can wrap to two lines.
  const originY = row * 128;

  return (
    <motion.div
      initial={{ x: originX, y: originY, scale: 1, opacity: 1 }}
      animate={{ x: "calc(50% - 50%)", y: -12, scale: [1, 1.3, 0.9, 1], opacity: [1, 1, 1, 0] }}
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
