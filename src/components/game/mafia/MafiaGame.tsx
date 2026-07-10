"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMafiaGame } from "@/hooks/use-mafia-game";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { GameErrorScreen } from "@/components/game/GameErrorScreen";
import { HostSkipButton } from "@/components/game/HostSkipButton";
import { SpectatorScreen } from "@/components/game/SpectatorScreen";
import { ConnectionBanner } from "@/components/game/ConnectionBanner";
import { useHostRecovery } from "@/hooks/use-host-recovery";
import { MafiaRoleReveal } from "./MafiaRoleReveal";
import { NightScreen } from "./NightScreen";
import { DayResultScreen } from "./DayResultScreen";
import { DayVoteScreen } from "./DayVoteScreen";
import { LynchResultScreen } from "./LynchResultScreen";
import { MafiaResultsScreen } from "./MafiaResultsScreen";
import {
  advanceGamePhase,
  castDayVote,
  claimRoomHost,
  closeGame,
  markPhaseReady,
  resetGameForRematch,
  submitNightAction,
} from "@/lib/game/actions";
import { toPlayerView } from "./shared";
import type { NightActionType } from "@/lib/game/types";

export function MafiaGame({
  roomCode,
  userId,
}: {
  roomCode: string;
  userId: string;
}) {
  const state = useMafiaGame(roomCode, userId) as ReturnType<typeof useMafiaGame> & {
    readyPlayerIds?: string[];
    canAdvance?: boolean;
    recoveryAvailable?: boolean;
    myDayVoteTargetId?: string | null;
  };
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
    connectionState,
    retryConnection,
    readyPlayerIds = [],
    canAdvance = false,
    recoveryAvailable = false,
    myDayVoteTargetId = null,
  } = state;
  const designatedHostId = game ? (game.dealer_id ?? game.host_id) : null;
  const currentIsHost = designatedHostId === userId;
  const canRecoverHost = useHostRecovery(players, designatedHostId, currentIsHost);

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
      <ConnectionBanner state={connectionState} onRetry={retryConnection} />
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
              isHost={currentIsHost}
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
              userId={userId}
              readyPlayerIds={readyPlayerIds}
              canAdvance={canAdvance}
              recoveryAvailable={recoveryAvailable}
              onReady={async () => {
                await markPhaseReady(game.id);
                await refetchCurrent();
              }}
              onBeginNight={async () => {
                await advanceGamePhase(game.id);
                await refetchCurrent();
              }}
            />
          )}

          {game.status === "night" &&
            me &&
            myRole &&
            (me.isEliminated ? (
              <SpectatorScreen
                phase="night"
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
              userId={userId}
              readyPlayerIds={readyPlayerIds}
              canAdvance={canAdvance}
              recoveryAvailable={recoveryAvailable}
              onReady={async () => {
                await markPhaseReady(game.id);
                await refetchCurrent();
              }}
              onBeginVote={async () => {
                await advanceGamePhase(game.id);
                await refetchCurrent();
              }}
            />
          )}

          {game.status === "day_vote" &&
            me &&
            (me.isEliminated ? (
              <SpectatorScreen
                phase="day"
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
                currentVoteTargetId={myDayVoteTargetId}
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
              readyPlayerIds={readyPlayerIds}
              canAdvance={canAdvance}
              recoveryAvailable={recoveryAvailable}
              onReady={async () => {
                await markPhaseReady(game.id);
                await refetchCurrent();
              }}
              onBeginNight={async () => {
                await advanceGamePhase(game.id);
                await refetchCurrent();
              }}
            />
          )}

          {game.status === "game_over" && (
            <MafiaResultsScreen
              game={game}
              players={players}
              winner={game.winner === "mafia" ? "mafia" : "town"}
              isHost={currentIsHost}
              canRecoverHost={canRecoverHost}
              onRematch={async () => {
                await resetGameForRematch(game.id);
                await refetchCurrent();
              }}
              onClose={async () => {
                await closeGame(game.id);
                window.location.assign("/");
              }}
              onRecoverHost={async () => {
                await claimRoomHost(game.id);
                await refetchCurrent();
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {connectionState === "connected" && recoveryAvailable && (game.status === "night" || game.status === "day_vote") && (
        <HostSkipButton gameId={game.id} onAdvanced={refetchCurrent} />
      )}
    </main>
  );
}
