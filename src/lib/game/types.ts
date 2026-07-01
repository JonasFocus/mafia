import type { Tables } from "@/lib/supabase/database.types";

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
