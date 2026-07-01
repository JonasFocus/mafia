import { Avatar, ringColorFor } from "@/components/ui/Avatar";
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
  const outsider = players.find((p) => p.isOutsider);
  const outsiderSurvived = outsider && !outsider.isEliminated;
  const winner = outsiderSurvived ? "outsider" : "civilians";
  const glow = winner === "outsider" ? "var(--outsider-glow)" : "var(--civilian-glow)";

  return (
    <div className="relative flex flex-1 flex-col items-center px-6 py-10 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto text-center overflow-hidden">
      <Confetti />

      <div
        className="animate-pop-in relative w-full rounded-[32px] py-12 px-6 flex flex-col items-center gap-2 overflow-hidden"
        style={{
          background: `radial-gradient(circle at 50% 20%, ${glow}3d, var(--surface-raised) 70%)`,
          boxShadow: `inset 0 0 0 1px ${glow}40`,
        }}
      >
        <span className="text-xs tracking-widest uppercase text-foreground-muted">
          {winner === "outsider" ? "The Mafia survived" : "The Mafia was caught"}
        </span>
        <span className="font-display text-4xl font-bold" style={{ color: glow }}>
          {winner === "outsider" ? "Mafia Wins" : "Civilians Win"}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs tracking-widest uppercase text-foreground-muted">{category}</span>
        <span className="font-display text-3xl font-bold">{word}</span>
      </div>

      <div className="w-full flex flex-col gap-2">
        {players.map((p, i) => (
          <div
            key={p.userId}
            className="flex items-center gap-3 rounded-2xl bg-surface px-4 h-16"
            style={{ boxShadow: "inset 0 0 0 1px var(--surface-border)" }}
          >
            <Avatar name={p.displayName} index={i} size={40} ring={false} />
            <span className="font-medium flex-1 text-left">{p.displayName}</span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                color: p.isOutsider ? "var(--outsider-glow)" : "var(--civilian-glow)",
                background: `${p.isOutsider ? ringColorFor(2) : ringColorFor(1)}1f`,
              }}
            >
              {p.isOutsider ? "Mafia" : "Civilian"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
