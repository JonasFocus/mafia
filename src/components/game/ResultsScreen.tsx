import { Avatar } from "@/components/ui/Avatar";
import { Confetti } from "./Confetti";
import { GameEndControls } from "./GameEndControls";
import type { PlayerView } from "@/lib/game/types";

export function ResultsScreen({
  players,
  word,
  category,
  winner,
  guessCorrect,
  isHost,
  canRecoverHost,
  onRematch,
  onClose,
  onRecoverHost,
}: {
  players: PlayerView[];
  word: string | null;
  category: string;
  winner: "players" | "chameleon";
  guessCorrect: boolean | null;
  isHost: boolean;
  canRecoverHost: boolean;
  onRematch: () => Promise<void>;
  onClose: () => Promise<void>;
  onRecoverHost: () => Promise<void>;
}) {
  const chameleonWon = winner === "chameleon";
  const glow = chameleonWon ? "var(--outsider-glow)" : "var(--civilian-glow)";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${glow}45, transparent 60%)`,
        }}
      />
      <Confetti variant={chameleonWon ? "mafia" : "civilian"} />

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-10 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto text-center">
        <div
          className="animate-pop-in relative w-full rounded-[32px] py-14 px-6 flex flex-col items-center gap-3 overflow-hidden shrink-0"
          style={{
            background: `radial-gradient(circle at 50% 20%, ${glow}3d, var(--surface-overlay) 70%)`,
            boxShadow: `var(--elevation-3), 0 0 60px ${glow}30`,
          }}
        >
          <span className="text-xs tracking-widest uppercase text-foreground-muted">
            {guessCorrect === true
              ? "The Chameleon guessed the word"
              : chameleonWon
                ? "The Chameleon escaped the vote"
                : "The Chameleon was caught"}
          </span>
          <span
            className="font-display text-5xl font-bold leading-none"
            style={{ color: glow, textShadow: `0 0 32px ${glow}70` }}
          >
            {chameleonWon ? "Chameleon Wins" : "Players Win"}
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
                {p.isOutsider ? "Chameleon" : "Player"}
              </span>
            </div>
          ))}
        </div>

        <GameEndControls
          isHost={isHost}
          canRecoverHost={canRecoverHost}
          onRematch={onRematch}
          onClose={onClose}
          onRecoverHost={onRecoverHost}
        />
      </div>
    </div>
  );
}
