import { createClient } from "@/lib/supabase/client";
import type { GameMode, NightActionType } from "@/lib/game/types";

type RoomSummary = {
  id: string;
  room_code: string;
  game_mode: GameMode;
};

export type OpenGame = {
  room_code: string;
  host_name: string;
  player_count: number;
  capacity: number;
  game_mode: GameMode;
  created_at: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Your session expired. Refresh and try again.",
  PROFILE_REQUIRED: "Choose your player name before creating a room.",
  INVALID_GAME_MODE: "Choose Mafia or Chameleon.",
  CATEGORY_REQUIRED: "Choose a Chameleon category.",
  CATEGORY_HAS_NO_WORDS: "That category does not have enough words yet.",
  ROOM_CODE_EXHAUSTED: "Could not create a room code. Try again.",
  ROOM_NOT_FOUND: "Room not found.",
  GAME_NOT_FOUND: "This room no longer exists.",
  ROOM_EXPIRED: "This room has expired.",
  ROOM_FULL: "That room is full.",
  GAME_ALREADY_STARTED: "That game has already started.",
  CHAMELEON_NEEDS_THREE_PLAYERS: "Chameleon needs at least 3 players.",
  CHAMELEON_PLAYER_LIMIT: "Chameleon supports at most 8 players.",
  MAFIA_NEEDS_FIVE_PLAYERS: "Mafia needs at least 5 players.",
  MAFIA_PLAYER_LIMIT: "Mafia supports at most 25 players.",
  NOT_ENOUGH_PLAYERS_FOR_ROLES: "Add more players or reduce the number of special roles.",
  TOO_MANY_MAFIA: "Mafia must be fewer than half of the table.",
  NOT_A_PARTICIPANT: "You are not a player in this room.",
  LEAVE_NOT_ALLOWED_AFTER_START: "You can only leave from the lobby.",
  ONLY_ROOM_HOST: "Only the current room host can do that.",
  ROOM_HOST_ACTIVE: "The current host is still connected.",
  HOST_CLAIM_NOT_ALLOWED_DURING_GAME: "Host recovery is available only in the lobby or after the game.",
  SETTINGS_LOCKED: "Settings are locked after the game starts.",
  INVALID_MAFIA_COUNT: "Choose a valid number of Mafia players.",
  INVALID_MAX_ROUNDS: "Choose a valid round count.",
  CLOSE_NOT_ALLOWED_DURING_GAME: "Finish the current game before closing the room.",
  REMATCH_REQUIRES_GAME_OVER: "A rematch is available after the game ends.",
  WRONG_GAME_MODE: "That action does not match this game mode.",
  NOT_A_CHAMELEON_GAME: "That action is available only in Chameleon.",
  NOT_A_MAFIA_GAME: "That action is available only in Mafia.",
  WRONG_PHASE: "The game has already moved to another phase.",
  PHASE_NOT_READY: "The table is still waiting for required choices.",
  RECOVERY_NOT_AVAILABLE: "The recovery timer has not expired yet.",
  PHASE_NOT_ADVANCEABLE: "This phase cannot be advanced manually.",
  PHASE_NOT_ACKNOWLEDGEABLE: "This phase does not need a readiness check.",
  PLAYER_ELIMINATED: "Eliminated players cannot take that action.",
  NOT_AN_ACTIVE_PLAYER: "Only a living player can take that action.",
  INVALID_TARGET: "Choose an eligible player.",
  INVALID_ACTION_TARGET: "Choose an eligible living player.",
  INVALID_VOTE_TARGET: "Choose an eligible living player.",
  NOT_CHAMELEON_VOTING: "The Chameleon vote is no longer open.",
  NOT_CHAMELEON_TIE_BREAK: "The dealer decision is no longer open.",
  NOT_THE_DEALER: "The designated dealer must break this tie.",
  ONLY_DEALER_CAN_BREAK_TIE: "The designated dealer must break this tie.",
  TARGET_NOT_IN_TIE_BREAK: "Choose one of the tied players.",
  GUESS_NOT_ALLOWED: "Only the Chameleon can make the final guess.",
  NOT_CHAMELEON_GUESS_PHASE: "The final word guess is no longer open.",
  ONLY_CAUGHT_CHAMELEON_CAN_GUESS: "Only the caught Chameleon can make this guess.",
  INVALID_GUESS: "Choose a word from this category card.",
  INVALID_GUESS_CANDIDATE: "Choose a word from this category card.",
  WORD_ALREADY_GUESSED: "That word was already guessed. Choose another.",
  NO_GUESSES_REMAINING: "The Chameleon has no guesses remaining.",
  NOT_NIGHT_PHASE: "The night phase has already ended.",
  ROLE_CANNOT_PERFORM_ACTION: "Your role cannot perform that night action.",
  MAFIA_FRIENDLY_FIRE_BLOCKED: "Mafia players cannot target another Mafia player.",
  INSPECTION_ALREADY_LOCKED: "The Sheriff inspection is already locked for tonight.",
  NOT_DAY_VOTE_PHASE: "The day vote has already ended.",
  ROUND_NOT_FOUND: "The current round could not be loaded. Refresh and try again.",
};

function gameError(error: { message: string }) {
  const code = Object.keys(ERROR_MESSAGES).find((candidate) =>
    error.message.includes(candidate),
  );
  return new Error(code ? ERROR_MESSAGES[code] : error.message);
}

async function callRpc<T>(name: string, args: Record<string, unknown> = {}) {
  const supabase = createClient();
  // Generated database types are refreshed from the migration before release.
  // Keeping this one boundary untyped lets the expand migration and frontend
  // land together without scattering casts through every caller.
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw gameError(error);
  return data as T;
}

export async function createGame(
  categoryId: string | null,
  gameMode: GameMode = "chameleon",
) {
  const data = await callRpc<RoomSummary[]>("create_game", {
    p_game_mode: gameMode,
    p_category_id: gameMode === "mafia" ? null : categoryId,
  });
  const game = data?.[0];
  if (!game) throw new Error("Could not create the room. Try again.");
  return game;
}

export async function joinGame(roomCode: string) {
  const data = await callRpc<RoomSummary[]>("join_game", {
    p_room_code: roomCode.toUpperCase(),
  });
  const game = data?.[0];
  if (!game) throw new Error("Room not found.");
  return game;
}

export async function listOpenGames(): Promise<OpenGame[]> {
  return (await callRpc<OpenGame[]>("list_open_games")) ?? [];
}

export async function getGameSnapshot(roomCode: string) {
  const snapshot = await callRpc<unknown>("get_game_snapshot", {
    p_room_code: roomCode.toUpperCase(),
  });
  if (
    snapshot &&
    typeof snapshot === "object" &&
    "error_code" in snapshot &&
    typeof snapshot.error_code === "string"
  ) {
    throw gameError({ message: snapshot.error_code });
  }
  return snapshot;
}

export async function startGame(gameId: string) {
  await callRpc("start_game", { p_game_id: gameId });
}

export async function startMafiaGame(gameId: string) {
  await callRpc("start_mafia_game", { p_game_id: gameId });
}

export async function updateGameSettings(
  gameId: string,
  settings: {
    categoryId?: string | null;
    mafiaCount?: number;
    showCategories?: boolean;
    sheriffEnabled?: boolean;
    angelEnabled?: boolean;
    revealRoleOnDeath?: boolean;
    maxRounds?: number;
  },
) {
  await callRpc("update_game_settings", {
    p_game_id: gameId,
    p_category_id: settings.categoryId ?? null,
    p_mafia_count: settings.mafiaCount ?? null,
    p_show_categories: settings.showCategories ?? null,
    p_sheriff_enabled: settings.sheriffEnabled ?? null,
    p_angel_enabled: settings.angelEnabled ?? null,
    p_reveal_role_on_death: settings.revealRoleOnDeath ?? null,
    p_max_rounds: settings.maxRounds ?? null,
  });
}

export async function markPhaseReady(gameId: string) {
  await callRpc("mark_phase_ready", { p_game_id: gameId });
}

export async function advanceGamePhase(gameId: string) {
  await callRpc("advance_game_phase", { p_game_id: gameId });
}

/** Compatibility alias for the existing recovery component. */
export async function forceAdvancePhase(gameId: string) {
  await advanceGamePhase(gameId);
}

/** Compatibility wrappers retained during the expand/switch rollout. */
export async function beginNight(gameId: string) {
  await advanceGamePhase(gameId);
}

export async function beginDayVote(gameId: string) {
  await advanceGamePhase(gameId);
}

export async function heartbeatGame(gameId: string) {
  return callRpc<string>("heartbeat_game", { p_game_id: gameId });
}

export async function claimRoomHost(gameId: string) {
  return callRpc<string>("claim_room_host", { p_game_id: gameId });
}

export async function submitNightAction(
  gameId: string,
  actionType: NightActionType,
  targetId: string,
) {
  await callRpc("submit_night_action", {
    p_game_id: gameId,
    p_action_type: actionType,
    p_target_id: targetId,
  });
}

export async function castDayVote(gameId: string, targetId: string) {
  await callRpc("cast_day_vote", {
    p_game_id: gameId,
    p_target_id: targetId,
  });
}

export async function castChameleonVote(gameId: string, targetId: string) {
  await callRpc("cast_chameleon_vote", {
    p_game_id: gameId,
    p_target_id: targetId,
  });
}

export async function breakChameleonTie(gameId: string, targetId: string) {
  await callRpc("break_chameleon_tie", {
    p_game_id: gameId,
    p_target_id: targetId,
  });
}

export async function submitChameleonGuess(gameId: string, wordId: string) {
  return callRpc<{ correct: boolean; guesses_remaining: number }>(
    "submit_chameleon_guess",
    { p_game_id: gameId, p_word_id: wordId },
  );
}

export async function closeGame(gameId: string) {
  await callRpc("close_game", { p_game_id: gameId });
}

/** Compatibility alias for older callers. */
export async function deleteGame(gameId: string) {
  await closeGame(gameId);
}

export async function resetGameForRematch(gameId: string) {
  await callRpc("reset_game_for_rematch", { p_game_id: gameId });
}

export async function leaveGame(gameId: string) {
  await callRpc("leave_game", { p_game_id: gameId });
}

export async function giveHint(gameId: string) {
  await callRpc("submit_chameleon_hint", { p_game_id: gameId });
}
