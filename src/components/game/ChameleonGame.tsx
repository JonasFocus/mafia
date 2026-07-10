"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGame } from "@/hooks/use-game";
import { LobbyScreen } from "@/components/game/LobbyScreen";
import { ChameleonRoleRevealScreen } from "@/components/game/ChameleonRoleRevealScreen";
import { ChameleonTieBreakScreen } from "@/components/game/ChameleonTieBreakScreen";
import { ChameleonGuessScreen, type GuessWordOption } from "@/components/game/ChameleonGuessScreen";
import { HintPhaseScreen } from "@/components/game/HintPhaseScreen";
import { VotingScreen } from "@/components/game/VotingScreen";
import { SpectatorScreen } from "@/components/game/SpectatorScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { GameErrorScreen } from "@/components/game/GameErrorScreen";
import { HostSkipButton } from "@/components/game/HostSkipButton";
import { ConnectionBanner } from "@/components/game/ConnectionBanner";
import { useHostRecovery } from "@/hooks/use-host-recovery";
import {
  advanceGamePhase,
  breakChameleonTie,
  claimRoomHost,
  closeGame,
  markPhaseReady,
  resetGameForRematch,
  submitChameleonGuess,
} from "@/lib/game/actions";

type ChameleonHookExtras = {
  readyPlayerIds?: string[];
  tiedPlayerIds?: string[];
  guessWordOptions?: GuessWordOption[];
  chameleonId?: string | null;
  myTieBreakChoiceId?: string | null;
  myVoteTargetId?: string | null;
  guessesRemaining?: number;
  guessedWordIds?: string[];
  dealerId?: string | null;
  canAdvance?: boolean;
  recoveryAvailable?: boolean;
};

export function ChameleonGame({
  roomCode,
  userId,
}: {
  roomCode: string;
  userId: string;
}) {
  const state = useGame(roomCode) as ReturnType<typeof useGame> & ChameleonHookExtras;
  const {
    game,
    categoryName,
    players,
    round,
    hintedPlayerIds,
    votedPlayerIds,
    myVoteCast,
    wordText,
    loading,
    error,
    refetchCurrent,
    connectionState,
    retryConnection,
    readyPlayerIds = [],
    tiedPlayerIds = [],
    guessWordOptions = [],
    chameleonId = null,
    myTieBreakChoiceId = null,
    myVoteTargetId = null,
    guessesRemaining = 1,
    guessedWordIds = [],
    dealerId = null,
    canAdvance = false,
    recoveryAvailable = false,
  } = state;
  const designatedHostId = game ? (game.dealer_id ?? game.host_id) : null;
  const currentIsHost = designatedHostId === userId;
  const canRecoverHost = useHostRecovery(players, designatedHostId, currentIsHost);

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center safe-top safe-bottom" aria-label="Loading game">
        <motion.div
          animate={{ opacity: [0.3, 0.75, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="h-14 w-14 rounded-2xl bg-surface-raised"
        />
      </main>
    );
  }

  if (error || !game) {
    return <GameErrorScreen error={error ?? "Something went wrong"} />;
  }

  const me = players.find((p) => p.userId === userId);
  const status = game.status as string;
  const gameResult = game as typeof game & { guess_correct?: boolean | null };
  async function refreshAfter(action: () => Promise<void>) {
    await action();
    await refetchCurrent();
  }

  return (
    <main className="flex flex-1 flex-col">
      <ConnectionBanner state={connectionState} onRetry={retryConnection} />
      <AnimatePresence mode="wait">
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col"
        >
          {status === "lobby" && (
            <LobbyScreen
              game={game}
              players={players}
              isHost={currentIsHost}
              categoryName={categoryName}
              userId={userId}
            />
          )}

          {status === "role_reveal" && me && (
            <ChameleonRoleRevealScreen
              userId={userId}
              players={players}
              readyPlayerIds={readyPlayerIds}
              isChameleon={me.isOutsider === true}
              word={wordText}
              wordOptions={guessWordOptions}
              category={categoryName}
              canAdvance={canAdvance}
              recoveryAvailable={recoveryAvailable}
              onReady={() => refreshAfter(() => markPhaseReady(game.id))}
              onAdvance={() => refreshAfter(() => advanceGamePhase(game.id))}
            />
          )}

          {status === "hint_phase" &&
            round &&
            (me?.isEliminated ? (
              <SpectatorScreen
                phase="day"
                message="You are out of the vote. Watch the table hunt the Chameleon."
                players={players}
              />
            ) : (
              <HintPhaseScreen
                userId={userId}
                players={players}
                round={round}
                hintedIds={hintedPlayerIds}
                isChameleon={!!me?.isOutsider}
                word={wordText}
                wordOptions={guessWordOptions}
                category={categoryName}
              />
            ))}

          {status === "voting" &&
            round &&
            (me?.isEliminated ? (
              <SpectatorScreen
                phase="day"
                message="You are out of the vote. Watch the table hunt the Chameleon."
                players={players}
              />
            ) : (
              <VotingScreen
                userId={userId}
                gameId={game.id}
                players={players}
                votedIds={votedPlayerIds}
                myVoteCast={myVoteCast}
                currentVoteTargetId={myVoteTargetId}
              />
            ))}

          {status === "chameleon_tie_break" && (
            <ChameleonTieBreakScreen
              players={players}
              tiedPlayerIds={tiedPlayerIds}
              dealerId={dealerId}
              userId={userId}
              currentChoiceId={myTieBreakChoiceId}
              onVote={(targetId) => refreshAfter(() => breakChameleonTie(game.id, targetId))}
            />
          )}

          {status === "chameleon_guess" && (
            <ChameleonGuessScreen
              isGuesser={chameleonId === userId || me?.isOutsider === true}
              chameleonName={players.find((player) => player.userId === chameleonId)?.displayName ?? "The Chameleon"}
              options={guessWordOptions}
              guessesRemaining={guessesRemaining}
              guessedWordIds={guessedWordIds}
              onGuess={(wordId) =>
                refreshAfter(async () => {
                  await submitChameleonGuess(game.id, wordId);
                })
              }
            />
          )}

          {status === "round_result" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center safe-top safe-bottom">
              <motion.span
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="role-mark h-16 w-16 text-gold-glow"
              />
              <p className="font-display text-2xl font-semibold">Tallying the votes...</p>
            </div>
          )}

          {status === "game_over" && (
            <ResultsScreen
              players={players}
              word={wordText}
              category={categoryName}
              winner={game.winner === "players" ? "players" : "chameleon"}
              guessCorrect={gameResult.guess_correct ?? null}
              isHost={currentIsHost}
              canRecoverHost={canRecoverHost}
              onRematch={() => refreshAfter(() => resetGameForRematch(game.id))}
              onClose={async () => {
                await closeGame(game.id);
                window.location.assign("/");
              }}
              onRecoverHost={() => refreshAfter(() => claimRoomHost(game.id).then(() => undefined))}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {connectionState === "connected" && recoveryAvailable && (status === "hint_phase" || status === "voting" || status === "chameleon_tie_break" || status === "chameleon_guess") && (
        <HostSkipButton
          gameId={game.id}
          onAdvanced={refetchCurrent}
          description={status === "chameleon_guess" ? "The guessing deadline has passed. Ending the phase now gives the players the win." : undefined}
          confirmLabel={status === "chameleon_guess" ? "End the final guess" : undefined}
        />
      )}
    </main>
  );
}
