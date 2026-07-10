"use client";

import { useGameSnapshot } from "@/hooks/use-game-snapshot";
import { usePhaseRecovery } from "@/hooks/use-phase-recovery";
import type { PlayerView } from "@/lib/game/types";

export function useGame(roomCode: string) {
  const state = useGameSnapshot(roomCode);
  const snapshot = state.snapshot;
  const recoveryAvailable = usePhaseRecovery(
    snapshot?.phase_deadline,
    snapshot?.recovery_available ?? false,
  );
  const players: PlayerView[] =
    snapshot?.players.map((player) => ({
      userId: player.user_id,
      displayName: player.display_name,
      isEliminated: player.is_eliminated,
      isOutsider: player.is_outsider,
      joinOrder: player.join_order,
      lastSeenAt: player.last_seen_at,
    })) ?? [];

  return {
    userId: null,
    game: snapshot?.game ?? null,
    categoryName: snapshot?.game.category_name ?? "",
    players,
    round: snapshot?.round ?? null,
    hintedPlayerIds: snapshot?.hinted_player_ids ?? [],
    votedPlayerIds: snapshot?.voted_player_ids ?? [],
    myVoteCast: snapshot?.my_vote_target_id != null,
    myVoteTargetId: snapshot?.my_vote_target_id ?? null,
    wordText: snapshot?.word_text ?? null,
    readyPlayerIds: snapshot?.ready_player_ids ?? [],
    tiedPlayerIds: snapshot?.tied_player_ids ?? [],
    guessWordOptions: snapshot?.guess_word_options ?? [],
    chameleonId: snapshot?.chameleon_id ?? null,
    dealerId: snapshot?.dealer_id ?? null,
    myTieBreakChoiceId: null,
    canAdvance: snapshot?.can_advance ?? false,
    recoveryAvailable,
    guessesRemaining: snapshot?.guesses_remaining ?? 0,
    guessedWordIds: snapshot?.guessed_word_ids ?? [],
    loading: state.loading,
    error: state.error,
    connectionState: state.connectionState,
    retryConnection: state.retryConnection,
    refetchCurrent: state.refetchCurrent,
  };
}
