"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { RoleCard } from "./RoleCard";
import { PlayerGrid } from "./PlayerGrid";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { giveHint } from "@/lib/game/actions";
import type { PlayerView, Round } from "@/lib/game/types";

export function HintPhaseScreen({
  userId,
  players,
  round,
  hintedIds,
  isOutsider,
  word,
  category,
  showCategories,
}: {
  userId: string;
  players: PlayerView[];
  round: Round;
  hintedIds: string[];
  isOutsider: boolean;
  word: string | null;
  category: string;
  showCategories: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const alreadyHinted = hintedIds.includes(userId);

  const turnOrder = round.hint_order
    .map((id) => players.find((p) => p.userId === id))
    .filter((p): p is PlayerView => !!p);
  const currentTurn = turnOrder.find((p) => !hintedIds.includes(p.userId));

  async function handleGiveHint() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await giveHint(round.id, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark your hint");
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-6 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto">
      <span className="shrink-0 text-xs tracking-widest uppercase text-foreground-muted">Round {round.round_number}</span>

      <div className="w-full shrink-0">
        <RoleCard isOutsider={isOutsider} word={word} category={category} showCategory={showCategories} />
      </div>

      <TurnOrderRail turnOrder={turnOrder} hintedIds={hintedIds} currentUserId={currentTurn?.userId} />

      <p className="text-sm text-foreground-muted text-center">
        Give your hint out loud, then mark yourself done.
        {currentTurn && (
          <>
            {" "}
            Up now: <span className="text-foreground font-medium">{currentTurn.displayName}</span>
          </>
        )}
      </p>

      <PlayerGrid players={players} activeUserId={currentTurn?.userId} hintedIds={hintedIds} meId={userId} />

      {error && <p className="text-sm text-outsider-glow text-center">{error}</p>}

      <Button onClick={handleGiveHint} disabled={alreadyHinted || submitting} className="w-full mt-auto">
        {alreadyHinted ? "Hint given — waiting on others" : submitting ? "Marking…" : "I've given my hint"}
      </Button>
    </div>
  );
}

function TurnOrderRail({
  turnOrder,
  hintedIds,
  currentUserId,
}: {
  turnOrder: PlayerView[];
  hintedIds: string[];
  currentUserId?: string;
}) {
  if (turnOrder.length === 0) return null;

  return (
    <div className="relative w-full">
      <div
        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--surface-border-strong) 8%, var(--surface-border-strong) 92%, transparent)",
        }}
      />
      <div className="relative flex items-center justify-between gap-1 overflow-x-auto no-scrollbar px-2">
        {turnOrder.map((p) => {
          const done = hintedIds.includes(p.userId);
          const isCurrent = p.userId === currentUserId;
          const variant = done ? undefined : isCurrent ? "active" : "neutral";

          return (
            <motion.div
              key={p.userId}
              className="relative flex flex-col items-center gap-1 shrink-0"
              animate={isCurrent ? { y: [0, -2, 0] } : { y: 0 }}
              transition={isCurrent ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
            >
              <div
                className="rounded-[18%]"
                style={{
                  boxShadow: done ? "0 0 0 2px var(--gold-glow)" : undefined,
                }}
              >
                <Avatar
                  name={p.displayName}
                  index={p.joinOrder}
                  size={32}
                  variant={variant}
                  dimmed={!done && !isCurrent}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
