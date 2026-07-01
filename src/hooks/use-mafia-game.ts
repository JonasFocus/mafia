"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, MafiaPlayerView, NightAction, DayVote, PlayerRole } from "@/lib/game/types";

export function useMafiaGame(roomCode: string) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<MafiaPlayerView[]>([]);
  const [nightActions, setNightActions] = useState<NightAction[]>([]);
  const [dayVotes, setDayVotes] = useState<DayVote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameIdRef = useRef<string | null>(null);
  const roundRef = useRef<number>(1);

  const refetchPlayers = useCallback(
    async (gameId: string) => {
      const [{ data: playerRows }, { data: { user } }] = await Promise.all([
        supabase.from("game_players_public").select("*").eq("game_id", gameId).order("join_order"),
        supabase.auth.getUser(),
      ]);
      if (!playerRows) return;
      const ids = playerRows.map((p) => p.user_id!).filter(Boolean);
      const { data: userRows } = await supabase.from("users").select("id, display_name").in("id", ids);
      const nameById = new Map(userRows?.map((u) => [u.id, u.display_name]) ?? []);
      setPlayers(
        playerRows.map((p) => ({
          userId: p.user_id!,
          displayName: nameById.get(p.user_id!) ?? "Player",
          isEliminated: !!p.is_eliminated,
          role: p.role,
          joinOrder: p.join_order ?? 0,
        })),
      );
      if (user) setUserId(user.id);
    },
    [supabase],
  );

  const refetchNightActions = useCallback(
    async (gameId: string, round: number) => {
      const { data } = await supabase
        .from("night_actions")
        .select("*")
        .eq("game_id", gameId)
        .eq("round_number", round);
      setNightActions(data ?? []);
    },
    [supabase],
  );

  const refetchDayVotes = useCallback(
    async (gameId: string, round: number) => {
      const { data } = await supabase
        .from("day_votes")
        .select("*")
        .eq("game_id", gameId)
        .eq("round_number", round);
      setDayVotes(data ?? []);
    },
    [supabase],
  );

  const refetchGame = useCallback(
    async (gameId: string) => {
      const { data: g, error: gErr } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
      if (gErr) {
        setError(gErr.message);
        return;
      }
      if (!g) {
        // The game row was deleted out from under us (host ended the game).
        if (gameIdRef.current) {
          setGame(null);
          setError("This game has ended");
        }
        return;
      }
      setGame(g);
      roundRef.current = g.current_round;
      await Promise.all([
        refetchPlayers(gameId),
        refetchNightActions(gameId, g.current_round),
        refetchDayVotes(gameId, g.current_round),
      ]);
    },
    [supabase, refetchPlayers, refetchNightActions, refetchDayVotes],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      const { data: g, error: gErr } = await supabase
        .from("games")
        .select("*")
        .eq("room_code", roomCode.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (gErr || !g) {
        setError("Room not found");
        setLoading(false);
        return;
      }
      gameIdRef.current = g.id;
      await refetchGame(g.id);
      setLoading(false);
    }
    init();

    return () => {
      cancelled = true;
    };
  }, [roomCode, supabase, refetchGame]);

  useEffect(() => {
    if (!game?.id) return;
    const gameId = game.id;

    const channel = supabase
      .channel(`mafia:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () =>
        refetchGame(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => refetchPlayers(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "night_actions", filter: `game_id=eq.${gameId}` },
        () => refetchNightActions(gameId, roundRef.current),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "day_votes", filter: `game_id=eq.${gameId}` },
        () => refetchDayVotes(gameId, roundRef.current),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  // Lobby membership can't stream over realtime (game_players RLS is own-row-only),
  // so poll the security-definer player list while in the lobby to keep the roster
  // and Start button current as people join.
  useEffect(() => {
    if (game?.status !== "lobby" || !game?.id) return;
    const gameId = game.id;
    const interval = setInterval(() => refetchPlayers(gameId), 2500);
    return () => clearInterval(interval);
  }, [game?.status, game?.id, refetchPlayers]);

  const me = players.find((p) => p.userId === userId);
  const myRole: PlayerRole | null = me?.role ?? null;
  const fellowMafia =
    myRole === "mafia"
      ? players.filter((p) => p.role === "mafia" && p.userId !== userId)
      : [];

  const myNightAction =
    nightActions.find((a) => a.actor_id === userId) ?? null;
  const inspectRow = nightActions.find((a) => a.actor_id === userId && a.action_type === "inspect");
  const myInspectResult: "mafia" | "not_mafia" | null =
    inspectRow?.result === "mafia" || inspectRow?.result === "not_mafia" ? inspectRow.result : null;

  const myDayVoteCast = dayVotes.some((v) => v.voter_id === userId);

  return {
    userId,
    game,
    players,
    me,
    myRole,
    fellowMafia,
    nightActions,
    myNightAction,
    myInspectResult,
    dayVotes,
    myDayVoteCast,
    loading,
    error,
  };
}
