import { createClient } from "@/lib/supabase/client";
import type { GameMode, NightActionType } from "@/lib/game/types";

export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
export const ROOM_CODE_LENGTH = 4;

export function randomRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export async function createGame(
  userId: string,
  categoryId: string,
  gameMode: GameMode = "chameleon",
) {
  const supabase = createClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = randomRoomCode();
    const { data: game, error } = await supabase
      .from("games")
      .insert({ room_code: roomCode, host_id: userId, category_id: categoryId, game_mode: gameMode })
      .select()
      .single();

    if (!error) {
      const { error: joinError } = await supabase
        .from("game_players")
        .insert({ game_id: game.id, user_id: userId, join_order: 0 });
      if (joinError) throw joinError;
      return game;
    }
    // unique violation on room_code: retry with a new code
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique room code, please try again");
}

export async function joinGame(userId: string, roomCode: string) {
  const supabase = createClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .maybeSingle();
  if (gameError) throw gameError;
  if (!game) throw new Error("Room not found");
  if (game.status !== "lobby") throw new Error("This game has already started");

  const { data: playerCount, error: countError } = await supabase.rpc("count_game_players", {
    p_game_id: game.id,
  });
  if (countError) throw countError;
  if ((playerCount ?? 0) >= 8) throw new Error("This room is full");

  const { error: joinError } = await supabase
    .from("game_players")
    .upsert(
      { game_id: game.id, user_id: userId, join_order: playerCount ?? 0 },
      { onConflict: "game_id,user_id", ignoreDuplicates: true },
    );
  if (joinError) throw joinError;

  return game;
}

export async function startGame(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("start_game", { p_game_id: gameId });
  if (error) throw error;
}

export async function updateGameSettings(
  gameId: string,
  settings: {
    mafiaCount?: number;
    showCategories?: boolean;
    sheriffEnabled?: boolean;
    angelEnabled?: boolean;
  },
) {
  const supabase = createClient();
  const update: {
    mafia_count?: number;
    show_categories?: boolean;
    sheriff_enabled?: boolean;
    angel_enabled?: boolean;
  } = {};
  if (settings.mafiaCount !== undefined) update.mafia_count = settings.mafiaCount;
  if (settings.showCategories !== undefined) update.show_categories = settings.showCategories;
  if (settings.sheriffEnabled !== undefined) update.sheriff_enabled = settings.sheriffEnabled;
  if (settings.angelEnabled !== undefined) update.angel_enabled = settings.angelEnabled;

  const { error } = await supabase.from("games").update(update).eq("id", gameId);
  if (error) throw error;
}

export async function startMafiaGame(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("start_mafia_game", { p_game_id: gameId });
  if (error) throw error;
}

export async function beginNight(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("begin_night", { p_game_id: gameId });
  if (error) throw error;
}

export async function beginDayVote(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("begin_day_vote", { p_game_id: gameId });
  if (error) throw error;
}

export async function submitNightAction(
  gameId: string,
  actionType: NightActionType,
  targetId: string,
) {
  const supabase = createClient();
  const { error } = await supabase.rpc("submit_night_action", {
    p_game_id: gameId,
    p_action_type: actionType,
    p_target_id: targetId,
  });
  if (error) throw error;
}

export async function castDayVote(gameId: string, targetId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("cast_day_vote", { p_game_id: gameId, p_target_id: targetId });
  if (error) throw error;
}

export async function deleteGame(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("games").delete().eq("id", gameId);
  if (error) throw error;
}

export async function giveHint(roundId: string, playerId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("hints_given").insert({ round_id: roundId, player_id: playerId });
  if (error) throw error;
}

export async function castVote(roundId: string, voterId: string, votedForId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("votes")
    .insert({ round_id: roundId, voter_id: voterId, voted_for_id: votedForId });
  if (error) throw error;
}
