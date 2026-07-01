"use client";

import { use, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/hooks/use-game";
import { createClient } from "@/lib/supabase/client";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { HintPhaseScreen } from "@/components/game/HintPhaseScreen";
import { VotingScreen } from "@/components/game/VotingScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { MafiaGame } from "@/components/game/mafia/MafiaGame";

function LoadingScreen() {
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

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center safe-top safe-bottom">
      <p className="text-foreground-muted">{message}</p>
    </main>
  );
}

// Resolve the game mode with one light query, then mount exactly one data
// layer: useGame (chameleon) or useMafiaGame inside MafiaGame. Previously both
// hooks ran for every mafia game — double fetches and two realtime channels.
export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const [mode, setMode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("games")
      .select("game_mode")
      .eq("room_code", roomCode.toUpperCase())
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) setNotFound(true);
        else setMode(data.game_mode);
      });
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  if (notFound) return <ErrorScreen message="Room not found" />;
  if (!mode) return <LoadingScreen />;
  if (mode === "mafia") return <MafiaGame roomCode={roomCode} />;
  return <ChameleonGame roomCode={roomCode} />;
}

function ChameleonGame({ roomCode }: { roomCode: string }) {
  const { userId, game, players, round, hintedPlayerIds, votedPlayerIds, myVoteCast, wordText, loading, error } =
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

  if (loading) return <LoadingScreen />;

  if (error || !game || !userId) {
    return <ErrorScreen message={error ?? "Something went wrong"} />;
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
            <VotingScreen
              userId={userId}
              players={players}
              round={round}
              votedIds={votedPlayerIds}
              myVoteCast={myVoteCast}
            />
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
