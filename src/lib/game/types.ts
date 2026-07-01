import type { Tables, Database } from "@/lib/supabase/database.types";

export type Game = Tables<"games">;
export type PlayerPublic = Tables<"game_players_public">;
export type Round = Tables<"rounds">;
export type UserRow = Tables<"users">;

export type PlayerView = {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  isOutsider: boolean | null; // null unless it's you, or the game has ended
  joinOrder: number;
};

export type PlayerRole = Database["public"]["Enums"]["player_role"]; // 'faithful'|'mafia'|'sheriff'|'angel'
export type NightActionType = Database["public"]["Enums"]["night_action_type"]; // 'kill'|'inspect'|'protect'
export type NightAction = Tables<"night_actions">;
export type DayVote = Tables<"day_votes">;
export type GameMode = "chameleon" | "mafia";

export type MafiaPlayerView = {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  role: PlayerRole | null; // null unless own row, game_over, or (mafia && viewer is mafia)
  joinOrder: number;
};
