"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PlayerGrid } from "./PlayerGrid";
import { MafiaSettings } from "./mafia/MafiaSettings";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Stepper } from "@/components/ui/Stepper";
import { Toggle } from "@/components/ui/Toggle";
import { startGame, startMafiaGame, updateGameSettings, deleteGame } from "@/lib/game/actions";
import type { Game, GameMode, PlayerView } from "@/lib/game/types";

export function LobbyScreen({
  game,
  players,
  isHost,
  categoryName,
  userId,
  mode = "chameleon",
}: {
  game: Game;
  players: PlayerView[];
  isHost: boolean;
  categoryName: string;
  userId: string;
  mode?: GameMode;
}) {
  const router = useRouter();
  const isMafia = mode === "mafia";
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mafiaCountOverride, setMafiaCountOverride] = useState<number | null>(null);
  const [showCategoriesOverride, setShowCategoriesOverride] = useState<boolean | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const minPlayers = isMafia ? 5 : 4;
  const canStart = players.length >= minPlayers && players.length <= 8;
  const maxMafia = Math.max(1, Math.floor((players.length - 1) / 2));
  const mafiaCount = mafiaCountOverride ?? game.mafia_count;
  const showCategories = showCategoriesOverride ?? game.show_categories;

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      if (isMafia) {
        await startMafiaGame(game.id);
      } else {
        await startGame(game.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the game");
      setStarting(false);
    }
  }

  async function handleEndGame() {
    try {
      await deleteGame(game.id);
      router.push("/");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Could not end the game");
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(game.room_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleMafiaCountChange(value: number) {
    setMafiaCountOverride(value);
    setSettingsError(null);
    try {
      await updateGameSettings(game.id, { mafiaCount: value });
      setMafiaCountOverride(null);
    } catch (err) {
      setMafiaCountOverride(null);
      setSettingsError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  async function handleShowCategoriesChange(value: boolean) {
    setShowCategoriesOverride(value);
    setSettingsError(null);
    try {
      await updateGameSettings(game.id, { showCategories: value });
      setShowCategoriesOverride(null);
    } catch (err) {
      setShowCategoriesOverride(null);
      setSettingsError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="spotlight-pulse pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)" }}
      />

      {isHost && (
        <motion.button
          onClick={() => setSettingsOpen(true)}
          aria-label="Game settings"
          whileTap={{ scale: 0.9, y: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="absolute right-4 top-4 z-10 flex items-center justify-center rounded-2xl"
          style={{
            width: 40,
            height: 40,
            background: "linear-gradient(180deg, var(--surface-raised), var(--surface))",
            boxShadow: "var(--elevation-2)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </motion.button>
      )}

      <div className="relative flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 safe-top safe-bottom gap-8 w-full max-w-sm mx-auto">
      <motion.button
        onClick={handleCopy}
        whileTap={{ scale: 0.97, y: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative flex flex-col items-center gap-2 rounded-3xl px-8 py-6"
        style={{
          background: "linear-gradient(180deg, var(--surface-raised), var(--surface))",
          boxShadow: "var(--elevation-3)",
        }}
      >
        <span className="text-xs font-semibold tracking-[0.2em] uppercase text-foreground-muted">
          {copied ? "Copied!" : "Room code · tap to copy"}
        </span>
        <span
          className="font-display text-7xl font-bold tracking-[0.12em]"
          style={{
            background: "linear-gradient(180deg, var(--foreground), var(--accent-bright))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 2px 24px color-mix(in srgb, var(--accent) 45%, transparent)",
          }}
        >
          {game.room_code}
        </span>
        {categoryName && (
          <span
            className="text-sm font-medium px-3 py-1 rounded-full mt-1"
            style={{ color: "var(--foreground-muted)", background: "var(--surface)", boxShadow: "var(--elevation-1)" }}
          >
            {categoryName}
          </span>
        )}
      </motion.button>

      <div className="relative w-full flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-foreground-muted">Players</span>
          <span
            className="text-sm text-foreground-muted font-mono px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface)", boxShadow: "var(--elevation-1)" }}
          >
            {players.length}/8
          </span>
        </div>
        <PlayerGrid players={players} meId={userId} hostUserId={game.host_id} />
      </div>

      {error && <p className="relative text-sm text-outsider-glow">{error}</p>}

      {isHost ? (
        <Button onClick={handleStart} disabled={!canStart || starting} className="relative w-full">
          {starting
            ? "Starting…"
            : canStart
              ? "Start Game"
              : isMafia
                ? "Need 5–8 players"
                : `Need ${4 - players.length > 0 ? "4-8" : "≤8"} players`}
        </Button>
      ) : (
        <p className="relative text-sm text-foreground-muted">Waiting for the host to start…</p>
      )}
      </div>

      {isHost && (
        <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-xl font-bold">Game Settings</h2>

            {isMafia ? (
              <MafiaSettings game={game} playerCount={players.length} />
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[15px] font-medium text-foreground">Mafia count</span>
                  <Stepper
                    value={mafiaCount}
                    onChange={handleMafiaCountChange}
                    min={1}
                    max={maxMafia}
                    options={[1, 2, 3]}
                    disabledCaption={(o) => `Need ${o * 2 + 1}+ players`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Toggle
                    checked={showCategories}
                    onChange={handleShowCategoriesChange}
                    label="Show Categories to Mafia"
                  />
                  <span className="text-xs text-foreground-muted">
                    Mafia will see the category, just not the word.
                  </span>
                </div>
              </>
            )}

            {settingsError && <p className="text-sm text-outsider-glow">{settingsError}</p>}

            <Button onClick={() => setSettingsOpen(false)} className="w-full">
              Save
            </Button>

            {isMafia && (
              <Button onClick={handleEndGame} variant="ghost" className="w-full">
                End game
              </Button>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
