"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMafiaGame } from "@/hooks/use-mafia-game";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { MafiaRoleReveal } from "./MafiaRoleReveal";
import { NightScreen } from "./NightScreen";
import { DayResultScreen } from "./DayResultScreen";
import { DayVoteScreen } from "./DayVoteScreen";
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
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center safe-top safe-bottom">
        <p className="text-foreground-muted">{error ?? "Something went wrong"}</p>
      </main>
    );
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

          {(game.status === "role_reveal" || game.status === "night") && me && !myRole && (
            <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center safe-top safe-bottom">
              <p className="text-foreground-muted">
                You joined after this round started, so you&apos;re sitting this one out.
              </p>
            </main>
          )}

          {game.status === "night" && me && myRole && (
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
              onSubmit={(actionType: NightActionType, targetId: string) =>
                submitNightAction(game.id, actionType, targetId)
              }
            />
          )}

          {game.status === "day_result" && (
            <DayResultScreen
              game={game}
              players={players}
              isHost={isHost}
              onBeginVote={() => beginDayVote(game.id)}
            />
          )}

          {game.status === "day_vote" && me && (
            <DayVoteScreen
              game={game}
              players={players}
              me={me}
              userId={userId}
              myDayVoteCast={myDayVoteCast}
              onVote={(targetId: string) => castDayVote(game.id, targetId)}
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
    </main>
  );
}
