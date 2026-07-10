"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGameSnapshot, heartbeatGame } from "@/lib/game/actions";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeConnection } from "@/hooks/use-realtime-connection";
import { useAuthorizedGameTextSnapshot } from "game-e2e-renderer";
import type {
  ChameleonGameStatus,
  GameSnapshot,
  MafiaGameStatus,
} from "@/lib/game/types";

const CHAMELEON_STATUSES = new Set<ChameleonGameStatus>([
  "lobby",
  "role_reveal",
  "hint_phase",
  "voting",
  "chameleon_tie_break",
  "chameleon_guess",
  "round_result",
  "game_over",
]);

const MAFIA_STATUSES = new Set<MafiaGameStatus>([
  "lobby",
  "role_reveal",
  "night",
  "day_result",
  "day_vote",
  "lynch_result",
  "game_over",
]);

function isGameSnapshot(value: unknown): value is GameSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    game?: { id?: unknown; game_mode?: unknown; status?: unknown };
    players?: unknown;
  };
  if (typeof candidate.game?.id !== "string" || !Array.isArray(candidate.players)) {
    return false;
  }
  if (candidate.game.game_mode === "chameleon") {
    return CHAMELEON_STATUSES.has(candidate.game.status as ChameleonGameStatus);
  }
  if (candidate.game.game_mode === "mafia") {
    return MAFIA_STATUSES.has(candidate.game.status as MafiaGameStatus);
  }
  return false;
}

export function useGameSnapshot(roomCode: string) {
  const [supabase] = useState(() => createClient());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchCurrent = useCallback(async () => {
    try {
      const next = await getGameSnapshot(roomCode);
      if (!isGameSnapshot(next)) throw new Error("The game returned an invalid state.");
      if (!mountedRef.current) return;
      const normalized = {
        ...next,
        guessed_word_ids: next.guess_word_options
          .filter((option) => option.attempted)
          .map((option) => option.id),
        game: {
          ...next.game,
          dealer_id: next.dealer_id,
          chameleon_vote_stage: next.game.chameleon_vote_stage ?? 1,
          chameleon_tied_player_ids: next.tied_player_ids,
          chameleon_caught_id:
            next.game.chameleon_caught_id ??
            (next.game.status === "chameleon_guess" ? next.chameleon_id : null),
          guess_correct: next.guess_correct,
        },
      } as GameSnapshot;
      snapshotRef.current = normalized;
      setSnapshot(normalized);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Could not load this game.";
      const isTerminal = /room not found|no longer exists|room has expired|not a player/i.test(message);
      if (!snapshotRef.current || isTerminal) setError(message);
      throw err;
    }
  }, [roomCode]);

  const scheduleRefetch = useCallback(() => {
    if (invalidationTimerRef.current) clearTimeout(invalidationTimerRef.current);
    invalidationTimerRef.current = setTimeout(() => {
      invalidationTimerRef.current = null;
      void refetchCurrent().catch(() => undefined);
    }, 120);
  }, [refetchCurrent]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void refetchCurrent()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (invalidationTimerRef.current) {
        clearTimeout(invalidationTimerRef.current);
        invalidationTimerRef.current = null;
      }
    };
  }, [refetchCurrent]);

  const gameId = snapshot?.game.id ?? null;
  const connectRealtime = useCallback(() => {
    if (!gameId) throw new Error("Cannot connect without a game.");
    return supabase
      .channel(`game-snapshot:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        scheduleRefetch,
      );
  }, [gameId, scheduleRefetch, supabase]);

  const catchUp = useCallback(
    () => refetchCurrent().catch(() => undefined),
    [refetchCurrent],
  );

  const { connectionState, retryConnection } = useRealtimeConnection({
    enabled: gameId !== null,
    connect: connectRealtime,
    catchUp,
  });

  useEffect(() => {
    if (!gameId) return;
    const sendHeartbeat = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void heartbeatGame(gameId).catch(() => undefined);
      }
    };
    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, 30_000);
    document.addEventListener("visibilitychange", sendHeartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, [gameId]);

  useAuthorizedGameTextSnapshot(snapshot);

  return {
    snapshot,
    loading,
    error,
    connectionState,
    retryConnection,
    refetchCurrent,
  };
}
