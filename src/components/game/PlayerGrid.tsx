"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import type { PlayerView } from "@/lib/game/types";

export function PlayerGrid({
  players,
  activeUserId,
  selectedUserId,
  onSelect,
  hintedIds,
  meId,
  hostUserId,
}: {
  players: PlayerView[];
  activeUserId?: string;
  selectedUserId?: string | null;
  onSelect?: (userId: string) => void;
  hintedIds?: string[];
  meId?: string;
  /** When set, the matching player's avatar gets the gold host badge. */
  hostUserId?: string;
}) {
  if (players.length === 0) {
    return <p className="py-4 text-center text-sm text-foreground-muted">Waiting for players...</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      <AnimatePresence initial={false}>
        {players.map((p) => {
          const isActive = p.userId === activeUserId;
          const isSelected = p.userId === selectedUserId;
          const hasHinted = hintedIds?.includes(p.userId);
          const selectable = !!onSelect && !p.isEliminated;
          const isMe = p.userId === meId;
          const isHost = p.userId === hostUserId;

          return (
            <motion.button
              key={p.userId}
              type="button"
              aria-label={[
                p.displayName,
                isMe && "you",
                isHost && "host",
                hasHinted && "ready",
                isSelected && "selected",
                p.isEliminated && "out",
              ]
                .filter(Boolean)
                .join(", ")}
              layout
              disabled={!selectable}
              aria-pressed={selectable ? isSelected : undefined}
              initial={{ opacity: 0, scale: 0.5, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              whileTap={selectable ? { scale: 0.92 } : undefined}
              onClick={() => selectable && onSelect?.(p.userId)}
              className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 transition-colors"
              style={{
                background: isSelected
                  ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent) 6%, transparent))"
                  : hasHinted || isActive
                    ? "color-mix(in srgb, var(--surface-raised) 56%, transparent)"
                    : "color-mix(in srgb, var(--surface) 34%, transparent)",
                border: `1px solid ${
                  isSelected
                    ? "color-mix(in srgb, var(--accent-bright) 46%, transparent)"
                    : hasHinted || isActive
                      ? "var(--surface-border-strong)"
                      : "var(--surface-border)"
                }`,
                boxShadow: isSelected ? "var(--elevation-2)" : "inset 0 1px 0 rgba(255,246,232,0.04)",
                cursor: selectable ? "pointer" : "default",
              }}
            >
              <div className="relative">
                <motion.div
                  animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={
                    isActive
                      ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                >
                  <Avatar
                    name={p.displayName}
                    index={p.joinOrder}
                    size={56}
                    dimmed={p.isEliminated}
                    variant={isActive ? "active" : undefined}
                    isHost={isHost}
                  />
                </motion.div>
                {hasHinted && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "var(--civilian-glow)", color: "var(--background)", boxShadow: "var(--elevation-2)" }}
                  >
                    ✓
                  </span>
                )}
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "var(--elevation-2)" }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-medium text-center leading-tight line-clamp-2 break-words max-w-full ${p.isEliminated ? "opacity-40" : ""}`}
              >
                {p.displayName}
              </span>
              {isMe && (
                <span className="-mt-0.5 text-[11px] font-semibold uppercase tracking-wide leading-none text-accent-bright">
                  you
                </span>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
