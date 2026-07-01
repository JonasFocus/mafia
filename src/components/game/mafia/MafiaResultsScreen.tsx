"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Confetti } from "@/components/game/Confetti";
import { ROLE_LABEL, roleGlow, MAFIA_GLOW, TOWN_GLOW } from "./shared";
import type { Game, MafiaPlayerView } from "@/lib/game/types";

export function MafiaResultsScreen({
  game,
  players,
  winner,
}: {
  game: Game;
  players: MafiaPlayerView[];
  winner: "town" | "mafia";
}) {
  void game;
  const townWon = winner === "town";
  const glow = townWon ? TOWN_GLOW : MAFIA_GLOW;
  const roster = [...players].sort((a, b) => a.joinOrder - b.joinOrder);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${glow}45, transparent 60%)`,
        }}
      />
      <Confetti variant={townWon ? "civilian" : "mafia"} />

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto text-center">
        <div
          className="animate-pop-in relative w-full rounded-[32px] py-14 px-6 flex flex-col items-center gap-3 overflow-hidden shrink-0"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${glow}3d, var(--surface-overlay) 70%)`,
            boxShadow: `var(--elevation-3), 0 0 60px ${glow}30`,
          }}
        >
          <span className="text-xs tracking-widest uppercase text-foreground-muted">
            {townWon ? "The mafia was wiped out" : "The mafia reached parity"}
          </span>
          <span
            className="font-display text-5xl font-bold leading-none"
            style={{ color: glow, textShadow: `0 0 32px ${glow}70` }}
          >
            {townWon ? "Town Wins" : "Mafia Wins"}
          </span>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <span className="text-xs tracking-widest uppercase text-foreground-muted">
            Roles revealed
          </span>
          {roster.map((p) => {
            const isMafia = p.role === "mafia";
            const rowGlow = roleGlow(p.role);
            return (
              <div
                key={p.userId}
                className="flex items-center gap-3 rounded-2xl px-4 h-16 shrink-0"
                style={{
                  background: "var(--surface)",
                  boxShadow: "var(--elevation-2)",
                  opacity: p.isEliminated ? 0.78 : 1,
                }}
              >
                <Avatar
                  name={p.displayName}
                  index={p.joinOrder}
                  size={40}
                  variant={isMafia ? "mafia" : "civilian"}
                />
                <div className="flex flex-1 flex-col items-start min-w-0">
                  <span
                    className="font-medium truncate max-w-full"
                    style={p.isEliminated ? { textDecoration: "line-through" } : undefined}
                  >
                    {p.displayName}
                  </span>
                  <span className="text-[11px] text-foreground-muted">
                    {p.isEliminated ? "Out" : "Survived"}
                  </span>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
                  style={{ color: rowGlow, background: `${rowGlow}1f` }}
                >
                  {p.role ? ROLE_LABEL[p.role] : "Unknown"}
                </span>
              </div>
            );
          })}
        </div>

        <Link
          href="/"
          className="mt-2 flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-surface-raised text-foreground font-display font-semibold text-base outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.4), 0 4px 0 rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.4)" }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
