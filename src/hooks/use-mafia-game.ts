"use client";

import { useGameSnapshot } from "@/hooks/use-game-snapshot";
import { usePhaseRecovery } from "@/hooks/use-phase-recovery";
import type { MafiaPlayerView, PlayerRole } from "@/lib/game/types";

export function useMafiaGame(roomCode: string, userId: string) {
  const state = useGameSnapshot(roomCode);
  const snapshot = state.snapshot;
  const recoveryAvailable = usePhaseRecovery(
    snapshot?.phase_deadline,
    snapshot?.recovery_available ?? false,
  );
  const players: MafiaPlayerView[] =
    snapshot?.players.map((player) => ({
      userId: player.user_id,
      displayName: player.display_name,
      isEliminated: player.is_eliminated,
      role: player.role,
      joinOrder: player.join_order,
      lastSeenAt: player.last_seen_at,
    })) ?? [];

  const me = players.find((player) => player.userId === userId);
  const myRole: PlayerRole | null = me?.role ?? null;
  const fellowMafia =
    myRole === "mafia"
      ? players.filter((player) => player.role === "mafia" && player.userId !== userId)
      : [];
  const nightActions = snapshot?.night_actions ?? [];
  const myNightAction = nightActions.find((action) => action.actor_id === userId) ?? null;
  const myInspectResult: "mafia" | "not_mafia" | null =
    myNightAction?.result === "mafia" || myNightAction?.result === "not_mafia"
      ? myNightAction.result
      : null;

  return {
    userId,
    game: snapshot?.game ?? null,
    players,
    me,
    myRole,
    fellowMafia,
    nightActions,
    myNightAction,
    myInspectResult,
    myDayVoteCast: snapshot?.my_day_vote_target_id != null,
    myDayVoteTargetId: snapshot?.my_day_vote_target_id ?? null,
    readyPlayerIds: snapshot?.ready_player_ids ?? [],
    canAdvance: snapshot?.can_advance ?? false,
    recoveryAvailable,
    refetchCurrent: state.refetchCurrent,
    loading: state.loading,
    error: state.error,
    connectionState: state.connectionState,
    retryConnection: state.retryConnection,
  };
}
