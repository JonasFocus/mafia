"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMafiaGame } from "@/hooks/use-mafia-game";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { GameErrorScreen } from "@/components/game/GameErrorScreen";
import { HostSkipButton } from "@/components/game/HostSkipButton";
import { SpectatorScreen } from "@/components/game/SpectatorScreen";
import { MafiaRoleReveal } from "./MafiaRoleReveal";
import { NightScreen } from "./NightScreen";
import { DayResultScreen } from "./DayResultScreen";
import { DayVoteScreen } from "./DayVoteScreen";
import { LynchResultScreen } from "./LynchResultScreen";
import { MafiaResultsScreen } from "./MafiaResultsScreen";
import { beginNight, beginDayVote, submitNightAction, castDayVote } from "@/lib/game/actions";
import { toPlayerView } from "./shared";
import type { NightActionType } from "@/lib/game/types";

export function MafiaGame({
  roomCode,
  userId,
  isHost,
}: {
  roomCode: string;
  userId: string;
  isHost: boolean;
}) {
  const {
    game,
    players,
    me,
    myRole,
    fellowMafia,
    nightActions,
    myNightAction,
    myInspectResult,
    myDayVoteCast,
    refetchCurrent,
    loading,
    error,
  } = useMafiaGame(roomCode);

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

  if (error || !game) {
    return <GameErrorScreen error={error ?? "Something went wrong"} />;
  }

  return (
    <main className="flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="flex flex-1 flex-col"
        >
          {game.status === "lobby" && (
            <LobbyScreen
              game={game}
              players={players.map(toPlayerView)}
              isHost={isHost}
              categoryName=""
              userId={userId}
              mode="mafia"
            />
          )}

          {game.status === "role_reveal" && me && myRole && (
            <MafiaRoleReveal
              game={game}
              players={players}
              me={me}
              myRole={myRole}
              fellowMafia={fellowMafia}
              isHost={isHost}
              onBeginNight={() => beginNight(game.id)}
            />
          )}

          {game.status === "night" &&
            me &&
            myRole &&
            (me.isEliminated ? (
              <SpectatorScreen
                emoji="🌙"
                message="The town sleeps. Watch how the night unfolds."
                players={players.map(toPlayerView)}
              />
            ) : (
              <NightScreen
                game={game}
                players={players}
                me={me}
                myRole={myRole}
                fellowMafia={fellowMafia}
                nightActions={nightActions}
                myNightAction={myNightAction}
                myInspectResult={myInspectResult}
                userId={userId}
                onSubmit={async (actionType: NightActionType, targetId: string) => {
                  await submitNightAction(game.id, actionType, targetId);
                  await refetchCurrent();
                }}
              />
            ))}

          {game.status === "day_result" && (
            <DayResultScreen
              game={game}
              players={players}
              isHost={isHost}
              onBeginVote={() => beginDayVote(game.id)}
            />
          )}

          {game.status === "day_vote" &&
            me &&
            (me.isEliminated ? (
              <SpectatorScreen
                emoji="☀️"
                message="Watch the town decide who to vote out."
                players={players.map(toPlayerView)}
              />
            ) : (
              <DayVoteScreen
                game={game}
                players={players}
                me={me}
                userId={userId}
                myDayVoteCast={myDayVoteCast}
                onVote={async (targetId: string) => {
                  await castDayVote(game.id, targetId);
                  await refetchCurrent();
                }}
              />
            ))}

          {game.status === "lynch_result" && (
            <LynchResultScreen
              game={game}
              players={players}
              userId={userId}
              isHost={isHost}
              onBeginNight={() => beginNight(game.id)}
            />
          )}

          {game.status === "game_over" && (
            <MafiaResultsScreen
              game={game}
              players={players}
              winner={game.winner === "mafia" ? "mafia" : "town"}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {isHost && (game.status === "night" || game.status === "day_vote") && (
        <HostSkipButton gameId={game.id} />
      )}
    </main>
  );
}
