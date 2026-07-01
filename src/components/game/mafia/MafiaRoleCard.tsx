"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import { roleGlow } from "./shared";
import type { MafiaPlayerView, PlayerRole } from "@/lib/game/types";

const ROLE_COPY: Record<PlayerRole, { label: string; blurb: string }> = {
  faithful: { label: "Faithful", blurb: "You are not the Mafia." },
  mafia: { label: "Mafia", blurb: "You are one of the Mafia." },
  sheriff: { label: "Sheriff", blurb: "Inspect one player each night." },
  angel: { label: "Angel", blurb: "Protect one player each night." },
};

export function MafiaRoleCard({
  role,
  fellowMafia,
}: {
  role: PlayerRole;
  fellowMafia?: MafiaPlayerView[];
}) {
  const [flipped, setFlipped] = useState(false);
  const [locked, setLocked] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  function handleTap() {
    if (locked) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    setLocked(true);
    setFlipped(true);
    timersRef.current.push(
      setTimeout(() => {
        setFlipped(false);
        timersRef.current.push(setTimeout(() => setLocked(false), 600));
      }, 2600),
    );
  }

  const isMafia = role === "mafia";
  const glow = roleGlow(role);
  const { label, blurb } = ROLE_COPY[role];
  const teammates = isMafia ? (fellowMafia ?? []) : [];

  return (
    <div className="relative w-full max-w-xs mx-auto">
      <motion.div
        className="pointer-events-none absolute -inset-x-4 -top-10 h-64 rounded-full blur-3xl"
        animate={{
          background: `radial-gradient(circle at 30% 20%, ${flipped ? `${glow}4d` : `${glow}1f`}, transparent 70%)`,
        }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <div
        onClick={handleTap}
        className="relative aspect-[3/4] select-none cursor-pointer"
        style={{ perspective: 1400 }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          {/* face-down */}
          <div
            className="absolute inset-0 rounded-[32px] flex flex-col items-center justify-center gap-3 overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(160deg, var(--surface-overlay), var(--surface-raised) 65%, var(--surface))",
              boxShadow:
                "0 22px 45px -14px rgba(0,0,0,0.75), inset 0 0 0 1px var(--surface-border-strong), var(--elevation-3)",
            }}
          >
            <div
              className="pointer-events-none absolute -inset-x-6 -top-16 h-48 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 35% 25%, rgba(139,123,255,0.18), transparent 70%)" }}
            />
            <motion.div
              animate={{ opacity: locked ? 0 : [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative h-16 w-16 rounded-2xl flex items-center justify-center font-display text-2xl font-bold"
              style={{
                background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                color: "var(--accent-bright)",
                boxShadow: "var(--elevation-2)",
              }}
            >
              ?
            </motion.div>
            {!locked && (
              <span className="relative text-foreground-muted text-xs tracking-widest uppercase">Tap to reveal</span>
            )}
          </div>

          {/* face-up */}
          <div
            className="absolute inset-0 rounded-[32px] flex flex-col items-center justify-center gap-3 px-7 text-center overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: `radial-gradient(circle at 30% 22%, ${glow}3d, var(--surface-overlay) 60%, var(--surface-raised))`,
              boxShadow: `0 22px 45px -14px rgba(0,0,0,0.75), inset 0 0 0 1px ${glow}80, var(--elevation-3)`,
            }}
          >
            <AnimatePresence>
              {flipped && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.18, type: "spring", stiffness: 380, damping: 22 }}
                  className="flex flex-col items-center gap-3"
                >
                  <span className="text-xs tracking-widest uppercase text-foreground-muted">You are the</span>
                  <span
                    className="font-display text-4xl font-bold leading-tight"
                    style={{ color: glow, textShadow: `0 0 24px ${glow}66` }}
                  >
                    {label}
                  </span>
                  <span className="text-sm text-foreground-muted mt-1 max-w-[220px]">{blurb}</span>

                  {isMafia && teammates.length > 0 && (
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <span className="text-[11px] tracking-widest uppercase text-foreground-muted">
                        Your team
                      </span>
                      <div className="flex flex-wrap items-start justify-center gap-3">
                        {teammates.map((t) => (
                          <div key={t.userId} className="flex flex-col items-center gap-1" style={{ width: 56 }}>
                            <Avatar name={t.displayName} index={t.joinOrder} size={40} variant="mafia" />
                            <span className="max-w-[56px] truncate text-[11px] text-foreground">
                              {t.displayName}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isMafia && teammates.length === 0 && (
                    <span className="mt-1 text-xs text-foreground-muted">You are the only Mafia.</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
