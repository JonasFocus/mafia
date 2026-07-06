"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { PlayerGrid } from "./PlayerGrid";
import { MafiaSettings } from "./mafia/MafiaSettings";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Stepper } from "@/components/ui/Stepper";
import { Toggle } from "@/components/ui/Toggle";
import { startGame, startMafiaGame, updateGameSettings, deleteGame, leaveGame } from "@/lib/game/actions";
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
  const [shared, setShared] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mafiaCountOverride, setMafiaCountOverride] = useState<number | null>(null);
  const [showCategoriesOverride, setShowCategoriesOverride] = useState<boolean | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInviteUrl(`${window.location.origin}/join?code=${game.room_code}`);
  }, [game.room_code]);

  const minPlayers = isMafia ? 5 : 4;
  const maxPlayers = isMafia ? 25 : 8;
  const canStart = players.length >= minPlayers && players.length <= maxPlayers;
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

  async function handleLeave() {
    setError(null);
    try {
      if (isHost) await deleteGame(game.id);
      else await leaveGame(game.id);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isHost
            ? "Could not end the game"
            : "Could not leave the game",
      );
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(game.room_code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleShare() {
    const url = `${window.location.origin}/join?code=${game.room_code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my Mafia game", text: `Join my game - room code ${game.room_code}`, url });
        return;
      } catch {
        // User cancelled or share unavailable. Copy the link instead.
      }
    }
    navigator.clipboard?.writeText(url).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    });
  }

  async function handleMafiaCountChange(value: number) {
    setMafiaCountOverride(value);
    setSettingsError(null);
    try {
      await updateGameSettings(game.id, { mafiaCount: value });
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
    } catch (err) {
      setShowCategoriesOverride(null);
      setSettingsError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isMafia
            ? "radial-gradient(88% 46% at 50% 0%, color-mix(in srgb, var(--outsider-glow) 16%, transparent), transparent 72%)"
            : "radial-gradient(88% 46% at 50% 0%, color-mix(in srgb, var(--civilian-glow) 12%, transparent), transparent 72%)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-5 py-5 safe-top safe-bottom">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground-muted">
              {isMafia ? "Classic Mafia" : "Chameleon"}
            </p>
            <h1 className="font-display text-4xl font-semibold leading-none">Lobby</h1>
          </div>

          {isHost && (
            <motion.button
              onClick={() => setSettingsOpen(true)}
              aria-label="Game settings"
              whileTap={{ scale: 0.92, y: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-surface-border-strong bg-surface/80 outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ boxShadow: "var(--elevation-2)" }}
            >
              <SettingsIcon />
            </motion.button>
          )}
        </header>

        <motion.button
          onClick={handleCopy}
          whileTap={{ scale: 0.985, y: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="noir-panel relative flex flex-col items-center gap-2 rounded-[22px] px-7 py-6 text-center outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground-muted">
            {copied ? "Copied" : "Room code - tap to copy"}
          </span>
          <span
            className="room-code-text font-display font-semibold tracking-[0.12em] whitespace-nowrap"
            style={{ fontSize: "clamp(3.35rem, 18vw, 5.75rem)" }}
          >
            {game.room_code}
          </span>
          {categoryName && (
            <span className="rounded-full border border-surface-border bg-surface px-3 py-1 text-sm text-foreground-muted">
              {categoryName}
            </span>
          )}
        </motion.button>

        <div className="mt-4 flex flex-col gap-3">
          <motion.button
            onClick={handleShare}
            whileTap={{ scale: 0.98, y: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-surface-border-strong bg-surface/75 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{ boxShadow: "var(--elevation-2)" }}
          >
            <ShareIcon />
            {shared ? "Link copied" : "Invite players"}
          </motion.button>

          {inviteUrl && (
            <div className="flex items-center justify-center">
              <div
                className="flex flex-col items-center gap-2 rounded-[16px] bg-white p-3"
                style={{ boxShadow: "var(--elevation-2)" }}
              >
                <QRCodeSVG value={inviteUrl} size={124} />
                <span
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--background-deep)" }}
                >
                  Scan to join
                </span>
              </div>
            </div>
          )}
        </div>

        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground-muted">Players</span>
            <span className="rounded-full border border-surface-border bg-surface px-2.5 py-1 font-mono text-sm text-foreground-muted">
              {players.length}/{maxPlayers}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <PlayerGrid players={players} meId={userId} hostUserId={game.host_id} />
          </div>
        </section>

        {error && <p className="mt-4 text-center text-sm text-outsider-glow">{error}</p>}

        <div className="mt-6 flex flex-col gap-3">
          {isHost ? (
            <Button onClick={handleStart} disabled={!canStart || starting} className="w-full">
              {starting
                ? "Starting..."
                : canStart
                  ? "Start game"
                  : players.length < minPlayers
                    ? `Need ${minPlayers - players.length} more player${minPlayers - players.length === 1 ? "" : "s"}`
                    : `Too many players (max ${maxPlayers})`}
            </Button>
          ) : (
            <p className="text-center text-sm text-foreground-muted">Waiting for the host to start.</p>
          )}

          <button
            type="button"
            onClick={handleLeave}
            className="rounded-[12px] px-3 py-2 text-sm font-medium text-foreground-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isHost ? "End game" : "Leave game"}
          </button>
        </div>
      </div>

      {isHost && (
        <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-3xl font-semibold leading-none">Game settings</h2>

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
                    label="Show categories to Mafia"
                  />
                  <span className="text-xs text-foreground-muted">
                    Mafia will see the category, just not the word.
                  </span>
                </div>
              </>
            )}

            {settingsError && <p className="text-sm text-outsider-glow">{settingsError}</p>}

            <Button onClick={() => setSettingsOpen(false)} className="w-full">
              Done
            </Button>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.85l.04.04a2 2 0 1 1-2.83 2.83l-.04-.04a1.7 1.7 0 0 0-1.85-.34 1.7 1.7 0 0 0-1.03 1.56V22a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.85.34l-.04.04a2 2 0 1 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.85l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 8.94 4.6 1.7 1.7 0 0 0 10 3.05V3a2 2 0 0 1 4 0v.05A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.85-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.25.62.84 1 1.55 1H21a2 2 0 0 1 0 4h-.05a1.7 1.7 0 0 0-1.55 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
