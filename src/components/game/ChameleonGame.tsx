"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/hooks/use-game";
import { createClient } from "@/lib/supabase/client";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { HintPhaseScreen } from "@/components/game/HintPhaseScreen";
import { VotingScreen } from "@/components/game/VotingScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { GameErrorScreen } from "@/components/game/GameErrorScreen";
import { HostSkipButton } from "@/components/game/HostSkipButton";

export function ChameleonGame({
  roomCode,
  userId,
  isHost,
}: {
  roomCode: string;
  userId: string;
  isHost: boolean;
}) {
  const { game, players, round, hintedPlayerIds, myVoteCast, wordText, error } = useGame(roomCode);
  const [categoryName, setCategoryName] = useState("");

  useEffect(() => {
    if (!game?.category_id) return;
    createClient()
      .from("categories")
      .select("name")
      .eq("id", game.category_id)
      .maybeSingle()
      .then(({ data }) => setCategoryName(data?.name ?? ""));
  }, [game?.category_id]);

  if (error || !game) {
    return <GameErrorScreen error={error ?? "Something went wrong"} />;
  }

  const me = players.find((p) => p.userId === userId);

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

      {isHost && (game.status === "hint_phase" || game.status === "voting") && (
        <HostSkipButton gameId={game.id} />
      )}
    </main>
  );
}
