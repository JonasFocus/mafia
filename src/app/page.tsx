"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const MotionLink = motion.create(Link);

function vibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(8);
  }
}

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 safe-top safe-bottom overflow-hidden">
      <div
        className="spotlight-pulse pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--gold-glow) 30%, transparent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-4 mb-16">
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-[28%] text-4xl font-display font-bold mb-2 animate-pop-in"
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
        <h1 className="font-display text-6xl font-bold tracking-tight">Mafia</h1>
        <p className="text-foreground-muted text-[15px] max-w-[280px] leading-relaxed">
          Everyone knows the word. One of you is bluffing. Find them before they survive three rounds.
        </p>
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-3">
        <MotionLink
          href="/host"
          onClick={vibrate}
          initial={false}
          whileTap={{
            y: 2,
            borderBottomWidth: 1,
            boxShadow: "0 2px 0 var(--accent-deep), 0 3px 6px rgba(0,0,0,0.3)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex h-14 items-center justify-center rounded-full font-display font-semibold text-base"
          style={{
            background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
            color: "var(--accent-foreground)",
            borderBottom: "3px solid var(--accent-deep)",
            boxShadow: "0 4px 0 var(--accent-deep), 0 6px 14px rgba(0,0,0,0.4)",
          }}
        >
          Host a Game
        </MotionLink>
        <MotionLink
          href="/join"
          onClick={vibrate}
          initial={false}
          whileTap={{
            y: 2,
            borderBottomWidth: 1,
            boxShadow: "0 2px 0 rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.3)",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="flex h-14 items-center justify-center rounded-full bg-surface-raised text-foreground font-display font-semibold text-base"
          style={{
            borderBottom: "3px solid rgba(0,0,0,0.4)",
            boxShadow: "var(--elevation-2)",
          }}
        >
          Join a Game
        </MotionLink>
      </div>
    </main>
  );
}
