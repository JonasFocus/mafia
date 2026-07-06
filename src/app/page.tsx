"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
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

const MODES = [
  {
    title: "Classic Mafia",
    tagline: "Night falls. Someone doesn't wake up.",
    copy: "The mafia knows each other. The town has to read the room — accusations, alibis, and one lynch vote at a time — before night takes over.",
    players: "4–25 players",
    tone: "var(--outsider-glow)",
    span: "lg:col-span-3",
  },
  {
    title: "Chameleon",
    tagline: "Everyone knows the word. Except one.",
    copy: "Give a hint that proves you know it — without giving it away to the player who doesn't.",
    players: "3–8 players",
    tone: "var(--civilian-glow)",
    span: "lg:col-span-2",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create a room",
    copy: "Pick a mode, get a four-letter code. No accounts, no downloads.",
  },
  {
    n: "02",
    title: "Friends join by code",
    copy: "Everyone joins from their own phone — type the code or scan the QR in the lobby.",
  },
  {
    n: "03",
    title: "Find the fake",
    copy: "Secret roles, hints, votes, and night actions move the room forward on their own.",
  },
];

const heroStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const blurIn: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(12px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", bounce: 0.28, duration: 1.1 },
  },
};

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

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
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <LandingNav />
      <HeroSection />
      <OpenRoomsSection games={games} joiningCode={joiningCode} onJoinGame={handleCardTap} />
      <ModesSection />
      <HowItWorksSection />
      <FinalCtaSection />

      {error && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-2xl border border-outsider-glow/40 bg-background px-4 py-3 text-center text-sm text-outsider-glow shadow-2xl">
          {error}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-2xl font-semibold tracking-tight">What is your name?</h3>
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
    </main>
  );
}

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 px-4 sm:px-6"
      style={{ paddingTop: "max(0.75rem, var(--safe-top))" }}
    >
      <nav
        className={`mx-auto flex items-center justify-between px-4 py-2.5 transition-all duration-300 ${
          scrolled
            ? "max-w-3xl rounded-2xl border border-surface-border bg-background/60 backdrop-blur-lg"
            : "max-w-5xl rounded-2xl border border-transparent bg-transparent"
        }`}
      >
        <Link href="/" className="text-base font-semibold tracking-tight text-foreground">
          Mafia
        </Link>
        <div className="hidden items-center gap-1 text-sm md:flex">
          <a
            className="rounded-full px-3 py-1.5 text-foreground-muted transition-colors hover:bg-surface/80 hover:text-foreground"
            href="#modes"
          >
            Modes
          </a>
          <a
            className="rounded-full px-3 py-1.5 text-foreground-muted transition-colors hover:bg-surface/80 hover:text-foreground"
            href="#how"
          >
            How it works
          </a>
          <Link
            className="rounded-full px-3 py-1.5 text-foreground-muted transition-colors hover:bg-surface/80 hover:text-foreground"
            href="/join"
          >
            Join
          </Link>
        </div>
        <MotionLink
          href="/host"
          onClick={vibrate}
          whileTap={{ y: 1, scale: 0.98 }}
          className="rounded-full px-4 py-2 text-sm font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{
            background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 22px rgba(184,32,43,0.24)",
          }}
        >
          Host a game
        </MotionLink>
      </nav>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 pt-32 sm:px-8 sm:pt-36 lg:pt-40">
      {/* Background: grid floor + spotlight + vignette */}
      <div aria-hidden className="landing-grid-floor pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="landing-spotlight pointer-events-none absolute left-1/2 top-16 h-[420px] w-[640px] max-w-[120vw] -translate-x-1/2"
      />
      <div aria-hidden className="landing-vignette pointer-events-none absolute inset-0" />

      <motion.div
        variants={heroStagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center"
      >
        {/* Announcement pill */}
        <motion.div variants={blurIn}>
          <a
            href="#modes"
            className="group mx-auto flex w-fit items-center gap-3 rounded-full border border-surface-border bg-surface/70 p-1 pl-4 text-sm text-foreground-muted shadow-md shadow-black/30 transition-colors hover:border-surface-border-strong hover:text-foreground"
          >
            <span>Two game modes · No downloads</span>
            <span className="block h-4 w-px bg-surface-border-strong" />
            <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-background/80">
              <span className="flex w-12 -translate-x-1/4 items-center transition-transform duration-500 ease-in-out group-hover:translate-x-1/4">
                <ArrowIcon />
                <ArrowIcon />
              </span>
            </span>
          </a>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={blurIn}
          className="mt-8 max-w-3xl text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-6xl md:text-7xl xl:text-[5.25rem]"
        >
          The party game of <span className="landing-serif text-accent-bright">perfect lies</span>
        </motion.h1>

        {/* Subcopy */}
        <motion.p
          variants={blurIn}
          className="mt-6 max-w-xl text-balance text-base leading-7 text-foreground-muted sm:text-lg"
        >
          Classic Mafia and Chameleon, played on the phones already at your table. Host a room,
          share a code, and find the fake before it finds you.
        </motion.p>

        {/* CTAs */}
        <motion.div variants={blurIn} className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <div className="rounded-[18px] border border-surface-border bg-foreground/5 p-0.5">
            <MotionLink
              href="/host"
              onClick={vibrate}
              whileTap={{ y: 2, scale: 0.99 }}
              className="action-glint flex h-12 items-center justify-center rounded-[15px] px-7 text-sm font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{
                background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 14px 32px rgba(184,32,43,0.26)",
              }}
            >
              Host a game
            </MotionLink>
          </div>
          <MotionLink
            href="/join"
            onClick={vibrate}
            whileTap={{ y: 2, scale: 0.99 }}
            className="flex h-12 items-center justify-center rounded-[15px] px-7 text-sm font-semibold text-foreground-muted outline-none transition-colors hover:bg-surface/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Join with code
          </MotionLink>
        </motion.div>

        {/* Room preview mockup */}
        <motion.div variants={blurIn} className="relative mt-16 w-full max-w-md">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-8 -top-8 bottom-0 rounded-[32px]"
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%)",
            }}
          />
          <HeroRoomPreview />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 rounded-b-[22px] bg-gradient-to-t from-background to-transparent"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="size-3 shrink-0 text-foreground"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ margin: "0 6px" }}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function HeroRoomPreview() {
  return (
    <div className="landing-glass relative rounded-[22px] p-5 text-left">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground-muted">
            Room code
          </p>
          <p className="room-code-text mt-1 text-5xl font-semibold leading-none tracking-tight">
            AB3K
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] text-foreground-muted">
            7/10 players
          </span>
          <span className="landing-live-dot mt-px h-2 w-2 rounded-full bg-civilian-glow" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PREVIEW_PLAYERS.map((player) => (
          <div
            key={player.name}
            className="rounded-[12px] border border-surface-border bg-background/50 px-2.5 py-2.5"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                color: player.color,
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 40%, transparent)",
              }}
            >
              {player.name.charAt(0)}
            </span>
            <p className="mt-2 truncate text-xs font-medium text-foreground">{player.name}</p>
            <p className="truncate text-[10px]" style={{ color: player.color }}>
              {player.role}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-11 items-center justify-center rounded-[12px] bg-accent text-sm font-semibold text-accent-foreground shadow-[0_14px_32px_rgba(184,32,43,0.22)]">
        Start game
      </div>
    </div>
  );
}

function OpenRoomsSection({
  games,
  joiningCode,
  onJoinGame,
}: {
  games: OpenGame[] | null;
  joiningCode: string | null;
  onJoinGame: (game: OpenGame) => void;
}) {
  return (
    <motion.section
      id="rooms"
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative border-t border-surface-border px-5 py-14 sm:px-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="landing-live-dot h-2 w-2 rounded-full bg-civilian-glow" />
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Open rooms</h2>
            </div>
            <p className="mt-1 text-sm text-foreground-muted">
              Lobbies waiting right now — tap one to sit down.
            </p>
          </div>
          {games && games.length > 0 && (
            <span className="shrink-0 rounded-full border border-surface-border px-2.5 py-1 text-xs text-foreground-muted">
              {games.length} open
            </span>
          )}
        </div>

        {games === null ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[16px] border border-surface-border bg-surface/60 px-3 py-3"
              >
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-surface-overlay" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-surface-overlay" />
                  <div className="h-2 w-16 animate-pulse rounded bg-surface-overlay" />
                </div>
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-surface-border-strong px-4 py-8 text-center">
            <p className="text-sm text-foreground">No rooms are open right now.</p>
            <p className="mt-1 text-xs text-foreground-muted">Host one — it takes about ten seconds.</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((g) => {
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
                  className="flex items-center gap-3 rounded-[16px] border border-surface-border bg-surface/65 px-3 py-3 text-left outline-none transition-colors hover:border-surface-border-strong hover:bg-surface-raised/80 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold"
                    style={{
                      color: isMafia ? "var(--outsider-glow)" : "var(--civilian-glow)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, currentColor 35%, transparent)",
                    }}
                  >
                    {g.host_name.charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{g.host_name}</span>
                    <span className="block text-xs text-foreground-muted">
                      {isMafia ? "Classic Mafia" : "Chameleon"} · {g.player_count}/{isMafia ? 25 : 8}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-foreground-muted">
                    {joining ? "Joining…" : "Join"}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function ModesSection() {
  return (
    <motion.section
      id="modes"
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative border-t border-surface-border px-5 py-20 sm:px-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Choose your <span className="landing-serif text-accent-bright">deception</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground-muted sm:text-base">
            Two social deduction modes, built for one table and fast rounds that stay tense.
          </p>
        </div>

        <div className="mt-10 grid gap-3 lg:grid-cols-5">
          {MODES.map((mode) => (
            <div
              key={mode.title}
              className={`group relative overflow-hidden rounded-2xl border border-surface-border bg-surface/60 p-6 transition-colors hover:border-surface-border-strong sm:p-7 ${mode.span}`}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, ${mode.tone} 12%, transparent), transparent 70%)`,
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: mode.tone, boxShadow: `0 0 14px ${mode.tone}` }}
                  />
                  <span className="rounded-full border border-surface-border px-2.5 py-1 text-[11px] text-foreground-muted">
                    {mode.players}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight">{mode.title}</h3>
                <p className="mt-1 text-sm font-medium" style={{ color: mode.tone }}>
                  {mode.tagline}
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-foreground-muted">{mode.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function HowItWorksSection() {
  return (
    <motion.section
      id="how"
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative border-t border-surface-border px-5 py-20 sm:px-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step) => (
            <div key={step.n} className="border-t border-surface-border-strong pt-5">
              <span className="text-xs font-semibold tracking-[0.2em] text-accent-bright">
                {step.n}
              </span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">{step.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function FinalCtaSection() {
  return (
    <motion.section
      variants={sectionReveal}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      className="relative border-t border-surface-border px-5 pb-12 pt-20 sm:px-8"
    >
      <div className="mx-auto w-full max-w-4xl">
        <p className="text-center text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Someone at your table is <span className="landing-serif text-accent-bright">lying</span>.
        </p>
        <div className="mt-8 flex items-center gap-5">
          <span className="accent-rule h-px flex-1" />
          <MotionLink
            href="/host"
            onClick={vibrate}
            whileTap={{ y: 2, scale: 0.99 }}
            className="action-glint flex h-12 items-center justify-center rounded-full px-8 text-sm font-semibold text-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
            style={{
              background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.24), 0 14px 32px rgba(184,32,43,0.26)",
            }}
          >
            Host a game
          </MotionLink>
          <span className="accent-rule h-px flex-1" />
        </div>
        <div className="mt-14 flex items-center justify-between text-xs text-foreground-muted safe-bottom">
          <span>© {new Date().getFullYear()} Mafia</span>
          <div className="flex items-center gap-4">
            <a className="transition-colors hover:text-foreground" href="#modes">
              Modes
            </a>
            <a className="transition-colors hover:text-foreground" href="#how">
              How it works
            </a>
            <Link className="transition-colors hover:text-foreground" href="/join">
              Join
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
