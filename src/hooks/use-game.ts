"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Game, PlayerView, Round } from "@/lib/game/types";

export function useGame(roomCode: string) {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<PlayerView[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [hintedPlayerIds, setHintedPlayerIds] = useState<string[]>([]);
  const [myVoteCast, setMyVoteCast] = useState(false);
  const [wordText, setWordText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetchPlayers = useCallback(
    async (gameId: string) => {
      const [{ data: playerRows }, { data: { user } }] = await Promise.all([
        supabase.from("game_players_public").select("*").eq("game_id", gameId).order("join_order"),
        supabase.auth.getUser(),
      ]);
      if (!mountedRef.current) return;
      if (!playerRows) return;
      const ids = playerRows.map((p) => p.user_id!).filter(Boolean);
      const { data: userRows } = await supabase.from("users").select("id, display_name").in("id", ids);
      if (!mountedRef.current) return;
      const nameById = new Map(userRows?.map((u) => [u.id, u.display_name]) ?? []);
      setPlayers(
        playerRows.map((p) => ({
          userId: p.user_id!,
          displayName: nameById.get(p.user_id!) ?? "Player",
          isEliminated: !!p.is_eliminated,
          isOutsider: p.is_outsider,
          joinOrder: p.join_order ?? 0,
        })),
      );
      if (user) setUserId(user.id);
    },
    [supabase],
  );

  const refetchRound = useCallback(
    async (gameId: string) => {
      const { data: roundRow } = await supabase
        .from("rounds")
        .select("*")
        .eq("game_id", gameId)
        .order("round_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mountedRef.current) return;
      setRound(roundRow);
      if (!roundRow) {
        setHintedPlayerIds([]);
        setMyVoteCast(false);
        return;
      }
      const { data: hints } = await supabase.from("hints_given").select("player_id").eq("round_id", roundRow.id);
      if (!mountedRef.current) return;
      setHintedPlayerIds(hints?.map((h) => h.player_id) ?? []);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: myVote } = await supabase
          .from("votes")
          .select("id")
          .eq("round_id", roundRow.id)
          .eq("voter_id", user.id)
          .maybeSingle();
        if (!mountedRef.current) return;
        setMyVoteCast(!!myVote);
      }
    },
    [supabase],
  );

  const refetchWord = useCallback(
    async (g: Game) => {
      if (!g.word_id) {
        setWordText(null);
        return;
      }
      const { data } = await supabase.from("words").select("text").eq("id", g.word_id).maybeSingle();
      if (!mountedRef.current) return;
      setWordText(data?.text ?? null);
    },
    [supabase],
  );

  const refetchGame = useCallback(
    async (gameId: string) => {
      const { data: g, error: gErr } = await supabase.from("games").select("*").eq("id", gameId).maybeSingle();
      if (!mountedRef.current) return;
      if (gErr) {
        setError(gErr.message);
        return;
      }
      if (!g) return;
      setGame(g);
      await Promise.all([refetchPlayers(gameId), refetchRound(gameId), refetchWord(g)]);
    },
    [supabase, refetchPlayers, refetchRound, refetchWord],
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
      if (cancelled) return;
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
      .channel(`game:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () =>
        refetchGame(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => refetchPlayers(gameId),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds", filter: `game_id=eq.${gameId}` }, () =>
        refetchRound(gameId),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hints_given" }, () =>
        refetchRound(gameId),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes" }, () => refetchRound(gameId))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  return { userId, game, players, round, hintedPlayerIds, myVoteCast, wordText, loading, error };
}
