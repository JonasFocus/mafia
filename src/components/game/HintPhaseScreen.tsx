"use client";

import { useState } from "react";
import { RoleCard } from "./RoleCard";
import { PlayerGrid } from "./PlayerGrid";
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
}: {
  userId: string;
  players: PlayerView[];
  round: Round;
  hintedIds: string[];
  isOutsider: boolean;
  word: string | null;
  category: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const alreadyHinted = hintedIds.includes(userId);

  const turnOrder = round.hint_order
    .map((id) => players.find((p) => p.userId === id))
    .filter((p): p is PlayerView => !!p);
  const currentTurn = turnOrder.find((p) => !hintedIds.includes(p.userId));

  async function handleGiveHint() {
    setSubmitting(true);
    try {
      await giveHint(round.id, userId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-6 safe-top safe-bottom gap-6 w-full max-w-sm mx-auto">
      <span className="text-xs tracking-widest uppercase text-foreground-muted">Round {round.round_number}</span>

      <RoleCard isOutsider={isOutsider} word={word} category={category} />

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

      <Button onClick={handleGiveHint} disabled={alreadyHinted || submitting} className="w-full mt-auto">
        {alreadyHinted ? "Hint given — waiting on others" : submitting ? "Marking…" : "I've given my hint"}
      </Button>
    </div>
  );
}
