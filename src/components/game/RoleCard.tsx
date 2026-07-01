"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function RoleCard({
  isOutsider,
  word,
  category,
}: {
  isOutsider: boolean;
  word: string | null;
  category: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [locked, setLocked] = useState(false);

  function handleTap() {
    if (locked) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    setLocked(true);
    setFlipped(true);
    setTimeout(() => {
      setFlipped(false);
      setTimeout(() => setLocked(false), 600);
    }, 2200);
  }

  const glow = isOutsider ? "var(--outsider-glow)" : "var(--civilian-glow)";

  return (
    <div className="relative w-full max-w-xs mx-auto">
      <motion.div
        className="spotlight-pulse pointer-events-none absolute inset-x-0 top-1/2 h-72 -translate-y-1/2 rounded-full blur-3xl"
        animate={{ background: `radial-gradient(circle, ${glow}33, transparent 70%)` }}
      />

      <div
        onClick={handleTap}
        className="relative aspect-[3/4] select-none cursor-pointer"
        style={{ perspective: 1200 }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ transformStyle: "preserve-3d" }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* face-down */}
          <div
            className="absolute inset-0 rounded-[32px] flex flex-col items-center justify-center gap-3"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(155deg, var(--surface-raised), var(--surface))",
              boxShadow: "inset 0 0 0 1px var(--surface-border), 0 20px 60px -20px rgba(0,0,0,0.6)",
            }}
          >
            <motion.div
              animate={{ opacity: locked ? 0 : [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-16 w-16 rounded-2xl flex items-center justify-center font-display text-2xl font-bold"
              style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent-bright)" }}
            >
              ?
            </motion.div>
            {!locked && (
              <span className="text-foreground-muted text-xs tracking-widest uppercase">Tap to reveal</span>
            )}
          </div>

          {/* face-up */}
          <div
            className="absolute inset-0 rounded-[32px] flex flex-col items-center justify-center gap-3 px-7 text-center overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: `radial-gradient(circle at 50% 30%, ${glow}30, var(--surface-raised) 72%)`,
              boxShadow: `inset 0 0 0 1px ${glow}40, 0 20px 60px -20px rgba(0,0,0,0.6)`,
            }}
          >
            <AnimatePresence>
              {flipped && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                  className="flex flex-col items-center gap-3"
                >
                  {isOutsider ? (
                    <>
                      <span className="text-xs tracking-widest uppercase text-foreground-muted">You are the</span>
                      <span className="font-display text-4xl font-bold" style={{ color: glow }}>
                        Mafia
                      </span>
                      <span className="text-sm text-foreground-muted mt-1 max-w-[200px]">
                        You don&apos;t know the word. Bluff like you do.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs tracking-widest uppercase text-foreground-muted">{category}</span>
                      <span className="font-display text-4xl font-bold leading-tight" style={{ color: glow }}>
                        {word}
                      </span>
                    </>
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
