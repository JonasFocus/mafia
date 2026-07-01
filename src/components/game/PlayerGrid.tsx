"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/Avatar";
import type { PlayerView } from "@/lib/game/types";

export function PlayerGrid({
  players,
  activeUserId,
  selectedUserId,
  onSelect,
  hintedIds,
  meId,
}: {
  players: PlayerView[];
  activeUserId?: string;
  selectedUserId?: string | null;
  onSelect?: (userId: string) => void;
  hintedIds?: string[];
  meId?: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-3 w-full">
      {players.map((p, i) => {
        const isActive = p.userId === activeUserId;
        const isSelected = p.userId === selectedUserId;
        const hasHinted = hintedIds?.includes(p.userId);
        const selectable = !!onSelect && !p.isEliminated;
        const isMe = p.userId === meId;

        return (
          <motion.button
            key={p.userId}
            type="button"
            disabled={!selectable}
            whileTap={selectable ? { scale: 0.92 } : undefined}
            onClick={() => selectable && onSelect?.(p.userId)}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 transition-colors"
            style={{
              background: isSelected ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "transparent",
              cursor: selectable ? "pointer" : "default",
            }}
          >
            <div className="relative">
              <motion.div
                animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={isActive ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
              >
                <Avatar name={p.displayName} index={i} size={56} dimmed={p.isEliminated} />
              </motion.div>
              {hasHinted && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "var(--civilian-glow)", color: "var(--background)" }}
                >
                  ✓
                </span>
              )}
              {isSelected && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                >
                  ✓
                </span>
              )}
            </div>
            <span
              className={`text-xs font-medium truncate max-w-full ${p.isEliminated ? "opacity-40" : ""}`}
            >
              {p.displayName}
              {isMe ? " (you)" : ""}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
