"use client";

import { useState } from "react";
import { PlayerGrid } from "./PlayerGrid";
import { Button } from "@/components/ui/Button";
import { startGame } from "@/lib/game/actions";
import type { Game, PlayerView } from "@/lib/game/types";

export function LobbyScreen({
  game,
  players,
  isHost,
  categoryName,
  userId,
}: {
  game: Game;
  players: PlayerView[];
  isHost: boolean;
  categoryName: string;
  userId: string;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canStart = players.length >= 4 && players.length <= 8;

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await startGame(game.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the game");
      setStarting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(game.room_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="relative flex flex-1 flex-col items-center px-6 py-8 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto overflow-hidden">
      <div
        className="spotlight-pulse pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%)" }}
      />

      <button
        onClick={handleCopy}
        className="relative flex flex-col items-center gap-1 active:scale-[0.97] transition-transform"
      >
        <span className="text-xs tracking-widest uppercase text-foreground-muted">
          {copied ? "Copied!" : "Room code · tap to copy"}
        </span>
        <span className="font-display text-6xl font-bold tracking-[0.15em]">{game.room_code}</span>
        <span className="text-sm text-foreground-muted mt-1">{categoryName}</span>
      </button>

      <div className="relative w-full flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-foreground-muted">Players</span>
          <span className="text-sm text-foreground-muted font-mono">{players.length}/8</span>
        </div>
        <PlayerGrid players={players} meId={userId} />
      </div>

      {error && <p className="relative text-sm text-outsider-glow">{error}</p>}

      {isHost ? (
        <Button onClick={handleStart} disabled={!canStart || starting} className="relative w-full">
          {starting ? "Starting…" : canStart ? "Start Game" : `Need ${4 - players.length > 0 ? "4-8" : "≤8"} players`}
        </Button>
      ) : (
        <p className="relative text-sm text-foreground-muted">Waiting for the host to start…</p>
      )}
    </div>
  );
}
