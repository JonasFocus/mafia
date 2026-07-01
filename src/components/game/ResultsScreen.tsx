import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Confetti } from "./Confetti";
import type { PlayerView } from "@/lib/game/types";

export function ResultsScreen({
  players,
  word,
  category,
}: {
  players: PlayerView[];
  word: string | null;
  category: string;
}) {
  const mafiaPlayers = players.filter((p) => p.isOutsider);
  const mafiaSurvived = mafiaPlayers.some((p) => !p.isEliminated);
  const winner = mafiaSurvived ? "outsider" : "civilians";
  const glow = winner === "outsider" ? "var(--outsider-glow)" : "var(--civilian-glow)";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${glow}45, transparent 60%)`,
        }}
      />
      <Confetti variant={winner === "outsider" ? "mafia" : "civilian"} />

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto text-center">
        <div
          className="animate-pop-in relative w-full rounded-[32px] py-14 px-6 flex flex-col items-center gap-3 overflow-hidden shrink-0"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${glow}3d, var(--surface-overlay) 70%)`,
            boxShadow: `var(--elevation-3), 0 0 60px ${glow}30`,
          }}
        >
          <span className="text-xs tracking-widest uppercase text-foreground-muted">
            {winner === "outsider" ? "The Mafia survived" : "The Mafia was caught"}
          </span>
          <span
            className="font-display text-5xl font-bold leading-none"
            style={{ color: glow, textShadow: `0 0 32px ${glow}70` }}
          >
            {winner === "outsider" ? "Mafia Wins" : "Town Wins"}
          </span>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-xs tracking-widest uppercase text-foreground-muted">{category}</span>
          <span className="font-display text-3xl font-bold">{word}</span>
        </div>

        <div className="w-full flex flex-col gap-2">
          {players.map((p, i) => (
            <div
              key={p.userId}
              className="flex items-center gap-3 rounded-2xl px-4 h-14 shrink-0"
              style={{ background: "var(--surface)", boxShadow: "var(--elevation-2)" }}
            >
              <Avatar
                name={p.displayName}
                index={i}
                size={40}
                variant={p.isOutsider ? "mafia" : "civilian"}
              />
              <span className="font-medium flex-1 text-left truncate">{p.displayName}</span>
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                style={{
                  color: p.isOutsider ? "var(--outsider-glow)" : "var(--civilian-glow)",
                  background: `${p.isOutsider ? "var(--outsider-glow)" : "var(--civilian-glow)"}1f`,
                }}
              >
                {p.isOutsider ? "Mafia" : "Town"}
              </span>
            </div>
          ))}
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
