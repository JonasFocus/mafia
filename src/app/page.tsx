"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ensureGuestSession, getStoredName, setStoredName } from "@/lib/game/auth";
import { joinGame, listOpenGames, type OpenGame } from "@/lib/game/actions";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";

const MotionLink = motion.create(Link);

const PREVIEW_PLAYERS = [
  { name: "Avery", role: "Detective", color: "var(--civilian-glow)" },
  { name: "Blake", role: "Mafia", color: "var(--outsider-glow)" },
  { name: "Casey", role: "Doctor", color: "var(--civilian-glow)" },
  { name: "Devon", role: "Civilian", color: "var(--gold-glow)" },
  { name: "Emery", role: "Chameleon", color: "var(--civilian-glow)" },
  { name: "Gray", role: "Mafia", color: "var(--outsider-glow)" },
];

const MODE_CARDS = [
  {
    title: "Classic Mafia",
    copy: "Mafia knows each other. The town has to read the room before night takes over.",
    tone: "var(--outsider-glow)",
  },
  {
    title: "Chameleon",
    copy: "Everyone knows the word except one player. Blend in, ask carefully, and catch the fake.",
    tone: "var(--civilian-glow)",
  },
];

const STEPS = [
  "Create a room",
  "Pass the phone",
  "Reveal the lie",
];

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(8);
  }
}

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<OpenGame[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingHost, setPendingHost] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setNameDraft(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      listOpenGames()
        .then((open) => {
          if (!cancelled) setGames(open);
        })
        .catch(() => {
          if (!cancelled) setGames((prev) => prev ?? []);
        });
    };
    load();
    const interval = setInterval(load, 4000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  async function doJoin(code: string, name: string) {
    setJoiningCode(code);
    setError(null);
    try {
      setStoredName(name.trim());
      await ensureGuestSession(name.trim());
      const game = await joinGame(code);
      router.push(`/game/${game.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join that game");
      setJoiningCode(null);
      listOpenGames()
        .then(setGames)
        .catch(() => {});
    }
  }

  function handleCardTap(g: OpenGame) {
    if (joiningCode) return;
    vibrate();
    const stored = getStoredName().trim();
    if (!stored) {
      setPendingCode(g.room_code);
      setPendingHost(g.host_name);
      setError(null);
      setSheetOpen(true);
      return;
    }
    void doJoin(g.room_code, stored);
  }

  function handleSheetSubmit() {
    const name = nameDraft.trim();
    if (!name || !pendingCode) return;
    setSheetOpen(false);
    void doJoin(pendingCode, name);
  }

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65, ease: "easeOut" }}
      className="relative flex flex-1 flex-col overflow-hidden"
    >
      <HeroSection games={games} joiningCode={joiningCode} onJoinGame={handleCardTap} />

      <section id="modes" className="relative border-t border-surface-border bg-background px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-4xl font-semibold leading-none text-foreground sm:text-5xl">
              Choose your deception
            </h2>
            <p className="max-w-md text-sm leading-6 text-foreground-muted sm:text-base">
              Two social deduction modes, built for one phone at the table and fast rounds that stay tense.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {MODE_CARDS.map((card) => (
              <div key={card.title} className="noir-panel-soft group overflow-hidden rounded-[18px] p-5">
                <div
                  className="mb-5 flex h-28 items-center justify-center rounded-[14px]"
                  style={{
                    color: card.tone,
                    background: `radial-gradient(circle at 50% 20%, color-mix(in srgb, ${card.tone} 22%, transparent), transparent 65%), var(--surface)`,
                    border: "1px solid var(--surface-border)",
                  }}
                >
                  <span className="role-mark h-16 w-16" />
                </div>
                <h3 className="font-display text-2xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground-muted">{card.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="relative border-t border-surface-border px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center font-display text-4xl font-semibold leading-none sm:text-5xl">
            How it works
          </h2>
          <div className="mt-9 grid gap-3 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step} className="noir-panel-soft rounded-[18px] p-5">
                <span className="room-code-text font-display text-4xl font-semibold">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step}</h3>
                <p className="mt-2 text-sm leading-6 text-foreground-muted">
                  {index === 0 && "Pick a mode, set a room code, and invite everyone at the table."}
                  {index === 1 && "Players join on their own phones or from a QR code in the lobby."}
                  {index === 2 && "Secret roles, hints, votes, and night actions move the room forward."}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-outsider-glow/40 bg-background px-4 py-3 text-center text-sm text-outsider-glow shadow-2xl">
          {error}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-3xl font-semibold leading-none">What is your name?</h3>
            <p className="text-sm text-foreground-muted">
              {pendingHost ? `Joining ${pendingHost}'s game.` : "So the table knows who just sat down."}
            </p>
          </div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSheetSubmit();
            }}
            maxLength={20}
            placeholder="Your name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            spellCheck={false}
            autoFocus
            className="h-14 rounded-[14px] border border-surface-border bg-surface px-5 text-base outline-none transition-shadow focus:ring-2 focus:ring-accent"
          />
          <Button onClick={handleSheetSubmit} disabled={!nameDraft.trim()} className="w-full">
            Join game
          </Button>
        </div>
      </BottomSheet>
    </motion.main>
  );
}

function HeroSection({
  games,
  joiningCode,
  onJoinGame,
}: {
  games: OpenGame[] | null;
  joiningCode: string | null;
  onJoinGame: (game: OpenGame) => void;
}) {
  return (
    <section className="relative min-h-[92svh] overflow-hidden px-5 pb-10 pt-5 safe-top sm:px-8 lg:px-12">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(3,2,2,0.94) 0%, rgba(3,2,2,0.76) 38%, rgba(3,2,2,0.34) 72%, rgba(3,2,2,0.82) 100%), linear-gradient(180deg, rgba(3,2,2,0.38), rgba(3,2,2,0.9)), url('/landing/mafia-noir-table.png')",
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between rounded-[20px] border border-surface-border-strong bg-background/45 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="font-display text-3xl font-semibold leading-none text-foreground">
          Mafia
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-foreground-muted md:flex">
          <a className="transition-colors hover:text-foreground" href="#how">
            How it works
          </a>
          <a className="transition-colors hover:text-foreground" href="#modes">
            Modes
          </a>
          <Link className="transition-colors hover:text-foreground" href="/join">
            Join
          </Link>
        </nav>
        <MotionLink
          href="/host"
          onClick={vibrate}
          whileTap={{ y: 1, scale: 0.99 }}
          className="action-glint rounded-[12px] px-4 py-2 text-sm font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{
            background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 10px 28px rgba(184,32,43,0.28)",
          }}
        >
          Host a game
        </MotionLink>
      </header>

      <div className="relative z-10 mx-auto grid min-h-[calc(92svh-104px)] w-full max-w-7xl items-center gap-10 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:py-16">
        <div className="flex max-w-3xl flex-col gap-6">
          <h1 className="font-display text-[clamp(4.8rem,14vw,10rem)] font-semibold leading-[0.78] tracking-normal">
            Mafia
          </h1>
          <div className="max-w-2xl">
            <p className="font-display text-[clamp(2.35rem,6vw,5.6rem)] font-semibold leading-[0.92]">
              A party game for{" "}
              <span className="text-outsider-glow">liars</span>,{" "}
              <span className="text-civilian-glow">listeners</span>, and{" "}
              <span className="text-gold-glow">late nights</span>
            </p>
            <p className="mt-5 max-w-xl text-base leading-7 text-foreground-muted sm:text-lg">
              Deceive your friends. Read the room. Trust carefully. Win together.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <MotionLink
              href="/host"
              onClick={vibrate}
              whileTap={{ y: 2, scale: 0.99 }}
              className="action-glint flex h-14 items-center justify-center rounded-[14px] px-7 text-sm font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{
                background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 14px 32px rgba(184,32,43,0.26)",
              }}
            >
              Host a game
            </MotionLink>
            <MotionLink
              href="/join"
              onClick={vibrate}
              whileTap={{ y: 2, scale: 0.99 }}
              className="flex h-14 items-center justify-center rounded-[14px] border border-surface-border-strong bg-background/45 px-7 text-sm font-semibold text-foreground outline-none backdrop-blur-md transition-colors hover:bg-surface/70 focus-visible:ring-2 focus-visible:ring-accent"
            >
              Join with code
            </MotionLink>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_0.82fr] xl:items-start">
          <HeroRoomPreview />
          <LiveRoomPanel games={games} joiningCode={joiningCode} onJoinGame={onJoinGame} />
        </div>
      </div>
    </section>
  );
}

function HeroRoomPreview() {
  return (
    <div className="noir-panel floating-card rounded-[22px] p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Room code
          </p>
          <p className="room-code-text font-display text-6xl font-semibold leading-none">AB3K</p>
        </div>
        <div className="flex items-center gap-2">
          <PreviewIcon label="Invite" />
          <PreviewIcon label="Settings" />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
          Players 7/10
        </span>
        <span className="h-2 w-2 rounded-full bg-outsider-glow shadow-[0_0_16px_var(--outsider-glow)]" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PREVIEW_PLAYERS.map((player, index) => (
          <div key={player.name} className="rounded-[14px] border border-surface-border bg-background/45 p-3">
            <div className="flex h-14 items-center justify-center" style={{ color: player.color }}>
              <span className="role-mark h-11 w-11" />
            </div>
            <p className="mt-2 truncate text-sm font-medium">{player.name}</p>
            <p className="truncate text-xs" style={{ color: player.color }}>
              {player.role}
            </p>
            <p className="mt-1 text-[10px] text-foreground-muted">{index + 1}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex h-12 items-center justify-center rounded-[12px] bg-accent text-sm font-semibold text-accent-foreground shadow-[0_14px_32px_rgba(184,32,43,0.24)]">
        Start game
      </div>
    </div>
  );
}

function PreviewIcon({ label }: { label: string }) {
  return (
    <div className="flex h-12 w-14 flex-col items-center justify-center gap-1 rounded-[12px] border border-surface-border bg-surface/80 text-[10px] text-foreground-muted">
      <span className="role-mark h-4 w-4 text-foreground" />
      {label}
    </div>
  );
}

function LiveRoomPanel({
  games,
  joiningCode,
  onJoinGame,
}: {
  games: OpenGame[] | null;
  joiningCode: string | null;
  onJoinGame: (game: OpenGame) => void;
}) {
  return (
    <div id="join" className="noir-panel-soft rounded-[22px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Open rooms</h2>
          <p className="text-xs text-foreground-muted">Join a lobby already waiting.</p>
        </div>
        {games && games.length > 0 && (
          <span className="rounded-full border border-surface-border px-2.5 py-1 text-xs text-foreground-muted">
            {games.length} open
          </span>
        )}
      </div>

      <div className="flex max-h-[24rem] flex-col gap-2 overflow-y-auto no-scrollbar">
        {games === null ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-[16px] border border-surface-border bg-surface/60 px-3 py-3">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-[12px] bg-surface-overlay" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-24 animate-pulse rounded bg-surface-overlay" />
                <div className="h-2 w-16 animate-pulse rounded bg-surface-overlay" />
              </div>
            </div>
          ))
        ) : games.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-surface-border-strong px-4 py-7 text-center">
            <p className="text-sm text-foreground">No rooms are open.</p>
            <p className="mt-1 text-xs text-foreground-muted">Host one or join with a code.</p>
          </div>
        ) : (
          games.map((g) => {
            const joining = joiningCode === g.room_code;
            const isMafia = g.game_mode === "mafia";
            return (
              <motion.button
                key={g.room_code}
                type="button"
                onClick={() => onJoinGame(g)}
                disabled={joiningCode !== null}
                whileTap={joiningCode ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex items-center gap-3 rounded-[16px] border border-surface-border bg-surface/65 px-3 py-3 text-left outline-none transition-colors hover:bg-surface-raised/80 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-display text-xl font-semibold"
                  style={{
                    color: isMafia ? "var(--outsider-glow)" : "var(--civilian-glow)",
                    background: "var(--background)",
                    boxShadow: "inset 0 0 0 1px var(--surface-border-strong)",
                  }}
                >
                  {g.host_name.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{g.host_name}</p>
                  <p className="text-xs text-foreground-muted">
                    {isMafia ? "Classic Mafia" : "Chameleon"} - {g.player_count}/{isMafia ? 25 : 8}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground-muted">
                  {joining ? "Joining" : "Join"}
                </span>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
