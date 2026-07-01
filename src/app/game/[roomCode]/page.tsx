"use client";

import { use, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/hooks/use-game";
import { createClient } from "@/lib/supabase/client";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { HintPhaseScreen } from "@/components/game/HintPhaseScreen";
import { VotingScreen } from "@/components/game/VotingScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";

export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const { userId, game, players, round, hintedPlayerIds, myVoteCast, wordText, loading, error } =
    useGame(roomCode);
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    if (!game?.category_id) return;
    const supabase = createClient();
    supabase
      .from("categories")
      .select("name")
      .eq("id", game.category_id)
      .maybeSingle()
      .then(({ data }) => setCategoryName(data?.name ?? ""));
  }, [game?.category_id]);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center safe-top safe-bottom">
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="h-14 w-14 rounded-2xl"
          style={{ background: "var(--surface-raised)" }}
        />
      </main>
    );
  }

  if (error || !game || !userId) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center safe-top safe-bottom">
        <p className="text-foreground-muted">{error ?? "Something went wrong"}</p>
      </main>
    );
  }

  const me = players.find((p) => p.userId === userId);
  const isHost = game.host_id === userId;

  return (
    <main className="flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col"
        >
          {game.status === "lobby" && (
            <LobbyScreen
              game={game}
              players={players}
              isHost={isHost}
              categoryName={categoryName}
              userId={userId}
            />
          )}

          {(game.status === "hint_phase" || game.status === "role_reveal") && round && (
            <HintPhaseScreen
              userId={userId}
              players={players}
              round={round}
              hintedIds={hintedPlayerIds}
              isOutsider={!!me?.isOutsider}
              word={wordText}
              category={categoryName}
              showCategories={game.show_categories}
            />
          )}

          {game.status === "voting" && round && (
            <VotingScreen userId={userId} players={players} round={round} myVoteCast={myVoteCast} />
          )}

          {game.status === "round_result" && (
            <div className="flex flex-1 items-center justify-center safe-top safe-bottom">
              <p className="text-foreground-muted">Tallying votes…</p>
            </div>
          )}

          {game.status === "game_over" && (
            <ResultsScreen players={players} word={wordText} category={categoryName} />
          )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
