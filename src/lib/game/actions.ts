import { createClient } from "@/lib/supabase/client";
import type { GameMode, NightActionType } from "@/lib/game/types";
import type { Database } from "@/lib/supabase/database.types";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
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

// Join by code via a SECURITY DEFINER RPC. A direct client-side select is blocked
// by RLS for a non-participant (games are readable only by host/existing players),
// so a first-time joiner would always get "Room not found". The RPC validates
// existence/status/capacity and inserts the player row atomically. Requires an
// established session first (ensureGuestSession) so auth.uid() is set.
export async function joinGame(roomCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("join_game", {
    p_room_code: roomCode.toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const game = data?.[0];
  if (!game) throw new Error("Room not found");
  return game;
}

export type OpenGame = Database["public"]["Functions"]["list_open_games"]["Returns"][number];

/** Public list of open (lobby) games for the home-screen "active games" list. */
export async function listOpenGames(): Promise<OpenGame[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_open_games");
  if (error) throw error;
  return data ?? [];
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

/** Host-only: resolve the current phase with whatever has been submitted, to
 * recover from a player who abandoned mid-phase. */
export async function forceAdvancePhase(gameId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("force_advance_phase", { p_game_id: gameId });
  if (error) throw new Error(error.message);
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

/** Remove the current player's own membership from a game (leaving the lobby). */
export async function leaveGame(gameId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("game_players")
    .delete()
    .eq("game_id", gameId)
    .eq("user_id", user.id);
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
