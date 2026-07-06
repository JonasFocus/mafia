"use client";

import { PlayerGrid } from "@/components/game/PlayerGrid";
import type { PlayerView } from "@/lib/game/types";

/** Read-only view shown to eliminated players during interactive phases,
 * shared by both game modes. Filters the roster down to the living itself. */
export function SpectatorScreen({
  phase,
  message,
  players,
}: {
  phase: "day" | "night";
  message: string;
  players: PlayerView[];
}) {
  const living = players.filter((p) => !p.isEliminated);
  const tone = phase === "day" ? "text-gold-glow" : "text-outsider-glow";
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto text-center">
      <span className={`role-mark h-16 w-16 ${tone}`} />
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-3xl font-semibold leading-none">You&rsquo;re out</h2>
        <p className="text-sm text-foreground-muted">{message}</p>
      </div>
      <div className="w-full">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Still in the game
        </p>
        <PlayerGrid players={living} />
      </div>
    </div>
  );
}
