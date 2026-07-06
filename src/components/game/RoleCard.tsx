"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function RoleCard({
  isOutsider,
  word,
  category,
  showCategory,
}: {
  isOutsider: boolean;
  word: string | null;
  category: string;
  showCategory: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const [locked, setLocked] = useState(false);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  function handleTap() {
    if (locked) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12);
    setLocked(true);
    setFlipped(true);
    timeouts.current.push(
      setTimeout(() => {
        setFlipped(false);
        timeouts.current.push(setTimeout(() => setLocked(false), 300));
      }, 3500),
    );
  }

  const glow = isOutsider ? "var(--outsider-glow)" : "var(--civilian-glow)";

  return (
    <div className="relative w-full max-w-xs mx-auto">
      {/* Directional spotlight, offset top-left. Static, not a sweep, so it stays cheap on mobile GPUs. */}
      <motion.div
        className="pointer-events-none absolute -inset-x-4 -top-10 h-64 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${glow} 30%, transparent), transparent 70%)` }}
        animate={{ opacity: flipped ? 1 : 0.4 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <button
        type="button"
        onClick={handleTap}
        aria-label={isOutsider ? "Reveal your role" : "Reveal your secret word"}
        className="relative block w-full aspect-[3/4] select-none cursor-pointer appearance-none rounded-[24px] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            className="absolute inset-0 rounded-[24px] flex flex-col items-center justify-center gap-3 overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background:
                "linear-gradient(160deg, var(--surface-overlay), var(--surface-raised) 60%, var(--surface)), radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 58%)",
              boxShadow:
                "0 24px 50px -18px rgba(0,0,0,0.82), inset 0 0 0 1px var(--surface-border-strong), var(--elevation-3)",
            }}
          >
            <div
              className="pointer-events-none absolute -inset-x-6 -top-16 h-48 rounded-full blur-3xl"
              style={{ background: "radial-gradient(circle at 35% 25%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%)" }}
            />
            <motion.div
              animate={{ opacity: locked ? 0 : [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="role-mark relative h-16 w-16 text-accent-bright"
              style={{
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                boxShadow: "var(--elevation-2)",
              }}
            />
            {!locked && (
              <span className="relative text-foreground-muted text-xs tracking-widest uppercase">Tap to reveal</span>
            )}
          </div>

          {/* face-up */}
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 rounded-[24px] flex flex-col items-center justify-center gap-3 px-7 text-center overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: `radial-gradient(circle at 30% 22%, ${glow}33, var(--surface-raised) 70%)`,
              boxShadow: `inset 0 0 0 1px ${glow}4d, var(--elevation-3)`,
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
                  {isOutsider ? (
                    <>
                      {showCategory && (
                        <span
                          className="rounded-full px-3 py-0.5 text-[11px] tracking-wide uppercase text-foreground-muted"
                          style={{ background: "var(--surface)", boxShadow: "var(--elevation-1)" }}
                        >
                          {category}
                        </span>
                      )}
                      <span className="mt-1 text-xs tracking-widest uppercase text-foreground-muted">
                        You are the
                      </span>
                      <span
                        className="font-display text-4xl font-bold"
                        style={{ color: glow, textShadow: `0 0 24px ${glow}66` }}
                      >
                        Mafia
                      </span>
                      <span className="text-sm text-foreground-muted mt-1 max-w-[200px]">
                        You don&apos;t know the word. Bluff like you do.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs tracking-widest uppercase text-foreground-muted">{category}</span>
                      <span
                        className="font-display font-bold leading-tight break-words max-w-full"
                        style={{
                          color: glow,
                          textShadow: `0 0 24px ${glow}66`,
                          fontSize: "clamp(1.5rem, 8vw, 2.25rem)",
                        }}
                      >
                        {word}
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </button>
    </div>
  );
}
