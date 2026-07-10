import type { Tables, Database } from "@/lib/supabase/database.types";

export type GameMode = "chameleon" | "mafia";
export type GameStatus =
  | "lobby"
  | "role_reveal"
  | "hint_phase"
  | "voting"
  | "chameleon_tie_break"
  | "chameleon_guess"
  | "round_result"
  | "game_over"
  | "night"
  | "day_result"
  | "day_vote"
  | "lynch_result";

export type ChameleonGameStatus =
  | "lobby"
  | "role_reveal"
  | "hint_phase"
  | "voting"
  | "chameleon_tie_break"
  | "chameleon_guess"
  | "round_result"
  | "game_over";

export type MafiaGameStatus =
  | "lobby"
  | "role_reveal"
  | "night"
  | "day_result"
  | "day_vote"
  | "lynch_result"
  | "game_over";

export type GameWinner = "town" | "mafia" | "players" | "chameleon" | null;

/** Participant-safe game state returned by get_game_snapshot. */
export type Game = {
  id: string;
  room_code: string;
  game_mode: GameMode;
  status: GameStatus;
  host_id: string;
  dealer_id: string | null;
  category_id: string | null;
  category_name: string | null;
  current_round: number;
  max_rounds: number;
  mafia_count: number;
  show_categories: boolean;
  sheriff_enabled: boolean;
  angel_enabled: boolean;
  reveal_role_on_death: boolean;
  winner: GameWinner;
  last_night_victim: string | null;
  last_lynch_victim: string | null;
  chameleon_vote_stage: number;
  chameleon_tied_player_ids: string[];
  chameleon_caught_id: string | null;
  phase_started_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
  guess_correct?: boolean | null;
};

export type Round = Pick<
  Tables<"rounds">,
  "id" | "game_id" | "round_number" | "hint_order"
>;

export type PlayerView = {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  isOutsider: boolean | null;
  joinOrder: number;
  lastSeenAt: string;
};

export type PlayerRole = Database["public"]["Enums"]["player_role"];
export type NightActionType = Database["public"]["Enums"]["night_action_type"];
export type NightAction = Tables<"night_actions">;

export type MafiaPlayerView = {
  userId: string;
  displayName: string;
  isEliminated: boolean;
  role: PlayerRole | null;
  joinOrder: number;
  lastSeenAt: string;
};

export type SnapshotPlayer = {
  id: string;
  user_id: string;
  display_name: string;
  is_eliminated: boolean;
  join_order: number;
  joined_at: string;
  last_seen_at: string;
  is_outsider: boolean | null;
  role: PlayerRole | null;
};

export type GuessWordOption = {
  id: string;
  text: string;
  attempted?: boolean;
};

type GameSnapshotBase = {
  game: Game;
  players: SnapshotPlayer[];
  round: Round | null;
  hinted_player_ids: string[];
  voted_player_ids: string[];
  ready_player_ids: string[];
  tied_player_ids: string[];
  guess_word_options: GuessWordOption[];
  word_text: string | null;
  chameleon_id: string | null;
  dealer_id: string | null;
  my_vote_target_id: string | null;
  my_day_vote_target_id: string | null;
  night_actions: NightAction[];
  day_votes: Tables<"day_votes">[];
  can_advance: boolean;
  recovery_available: boolean;
  phase_deadline: string | null;
  guesses_remaining: number | null;
  guessed_word_ids?: string[];
  guess_correct: boolean | null;
  winner: GameWinner;
};

type SnapshotFor<Mode extends GameMode, Status extends GameStatus> =
  Omit<GameSnapshotBase, "game"> & {
    game: Game & { game_mode: Mode; status: Status };
  };

type ChameleonSnapshots = {
  [Status in ChameleonGameStatus]: SnapshotFor<"chameleon", Status>;
}[ChameleonGameStatus];

type MafiaSnapshots = {
  [Status in MafiaGameStatus]: SnapshotFor<"mafia", Status>;
}[MafiaGameStatus];

/** Mode and phase are paired discriminants for every authorized UI snapshot. */
export type GameSnapshot = ChameleonSnapshots | MafiaSnapshots;
