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

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(8);
  }
}

export default function HomePage() {
  const router = useRouter();
  const [games, setGames] = useState<OpenGame[] | null>(null); // null while first load is pending
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill the remembered name on mount (not in useState) so SSR/client markup
  // match — avoids a hydration mismatch.
  useEffect(() => {
    const stored = getStoredName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setNameDraft(stored);
  }, []);

  useEffect(() => {
    // The list is a public SECURITY DEFINER RPC (RLS filters realtime for
    // non-participants, so postgres_changes can't stream it). Poll every 4s and
    // refetch whenever the tab regains focus.
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
      // The game may have started or filled — refresh so the list reflects it.
      listOpenGames()
        .then(setGames)
        .catch(() => {});
    }
  }

  function handleCardTap(code: string) {
    if (joiningCode) return;
    vibrate();
    const stored = getStoredName().trim();
    if (!stored) {
      setPendingCode(code);
      setError(null);
      setSheetOpen(true);
      return;
    }
    void doJoin(code, stored);
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
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative flex flex-1 flex-col px-6 pt-12 pb-6 safe-top safe-bottom overflow-hidden"
    >
      <div
        className="spotlight-pulse pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm mx-auto flex flex-col items-center text-center gap-3 mb-7">
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-[28%] text-3xl font-display font-bold animate-pop-in"
          style={{
            background: "linear-gradient(155deg, var(--accent-bright), var(--accent) 60%, var(--accent-deep))",
            color: "var(--accent-foreground)",
            boxShadow: [
              "inset 0 2px 3px rgba(255,255,255,0.3)",
              "inset 0 -4px 6px rgba(0,0,0,0.3)",
              "0 16px 40px -12px color-mix(in srgb, var(--accent) 75%, transparent)",
            ].join(", "),
          }}
        >
          🕵️
        </div>
        <h1 className="font-display text-5xl font-bold tracking-tight">Mafia</h1>
        <p className="text-foreground-muted text-[15px] max-w-[280px] leading-relaxed">
          One of you is faking it. Blend in, or expose the impostor before they slip away.
        </p>
      </div>

      <div className="relative w-full max-w-sm mx-auto">
        <MotionLink
          href="/host"
          onClick={vibrate}
          initial={false}
          whileTap={{
            y: 2,
            boxShadow: "inset 0 -1px 0 var(--accent-deep), 0 2px 0 var(--accent-deep), 0 3px 6px rgba(0,0,0,0.3)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex h-14 items-center justify-center rounded-full font-display font-semibold text-base outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{
            background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
            color: "var(--accent-foreground)",
            boxShadow: "inset 0 -3px 0 var(--accent-deep), 0 4px 0 var(--accent-deep), 0 6px 14px rgba(0,0,0,0.4)",
          }}
        >
          Host a Game
        </MotionLink>
      </div>

      <div className="relative w-full max-w-sm mx-auto mt-7 flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Join a game
          </h2>
          {games && games.length > 0 && (
            <span className="text-xs text-foreground-muted">{games.length} open</span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col gap-2">
          {games === null ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3"
                style={{ boxShadow: "var(--elevation-1)" }}
              >
                <div className="h-10 w-10 shrink-0 rounded-full bg-surface-overlay animate-pulse" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="h-3 w-24 rounded bg-surface-overlay animate-pulse" />
                  <div className="h-2 w-16 rounded bg-surface-overlay animate-pulse" />
                </div>
              </div>
            ))
          ) : games.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center" style={{ borderColor: "var(--surface-border-strong)" }}>
              <span className="text-2xl">🔍</span>
              <p className="text-sm text-foreground-muted">No open games right now.</p>
              <p className="text-xs text-foreground-muted">Host one above, or join with a code.</p>
            </div>
          ) : (
            games.map((g) => {
              const joining = joiningCode === g.room_code;
              const isMafia = g.game_mode === "mafia";
              return (
                <motion.button
                  key={g.room_code}
                  type="button"
                  onClick={() => handleCardTap(g.room_code)}
                  disabled={joiningCode !== null}
                  whileTap={joiningCode ? undefined : { scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className="flex items-center gap-3 rounded-2xl bg-surface-raised px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                  style={{ boxShadow: "var(--elevation-2)" }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
                    style={{
                      background: "linear-gradient(155deg, var(--accent-bright), var(--accent))",
                      color: "var(--accent-foreground)",
                    }}
                  >
                    {g.host_name.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold truncate">{g.host_name}</p>
                    <p className="text-xs text-foreground-muted">
                      {isMafia ? "Classic Mafia" : "Chameleon"} · {g.player_count}/8
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-foreground-muted">
                    {joining ? "Joining…" : "Join ›"}
                  </span>
                </motion.button>
              );
            })
          )}
        </div>

        {error && <p className="mt-3 text-center text-sm text-outsider-glow">{error}</p>}

        <Link
          href="/join"
          onClick={vibrate}
          className="mt-4 shrink-0 rounded text-center text-sm text-foreground-muted outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Got a room code? <span className="font-semibold text-accent-bright">Enter it</span>
        </Link>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-xl font-bold">What&rsquo;s your name?</h3>
            <p className="text-sm text-foreground-muted">So the table knows who just sat down.</p>
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
            className="h-14 rounded-2xl bg-surface px-5 text-base outline-none focus:ring-2 focus:ring-accent"
            style={{ boxShadow: "var(--elevation-1)" }}
          />
          <Button onClick={handleSheetSubmit} disabled={!nameDraft.trim()} className="w-full">
            Join game
          </Button>
        </div>
      </BottomSheet>
    </motion.main>
  );
}
