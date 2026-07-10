export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_by: string | null
          id: string
          is_custom: boolean
          name: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          is_custom?: boolean
          name: string
        }
        Update: {
          created_by?: string | null
          id?: string
          is_custom?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      day_votes: {
        Row: {
          created_at: string
          game_id: string
          id: string
          round_number: number
          target_id: string
          voter_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          round_number: number
          target_id: string
          voter_id: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          round_number?: number
          target_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_votes_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_votes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_phase_acknowledgements: {
        Row: {
          acknowledged_at: string
          game_id: string
          phase: Database["public"]["Enums"]["game_status"]
          round_number: number
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          game_id: string
          phase: Database["public"]["Enums"]["game_status"]
          round_number: number
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          game_id?: string
          phase?: Database["public"]["Enums"]["game_status"]
          round_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_phase_acknowledgements_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_phase_acknowledgements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          game_id: string
          id: string
          is_eliminated: boolean
          is_outsider: boolean
          join_order: number
          joined_at: string
          last_seen_at: string
          role: Database["public"]["Enums"]["player_role"] | null
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          is_eliminated?: boolean
          is_outsider?: boolean
          join_order: number
          joined_at?: string
          last_seen_at?: string
          role?: Database["public"]["Enums"]["player_role"] | null
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          is_eliminated?: boolean
          is_outsider?: boolean
          join_order?: number
          joined_at?: string
          last_seen_at?: string
          role?: Database["public"]["Enums"]["player_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_secrets: {
        Row: {
          created_at: string
          game_id: string
          guess_attempt_ids: string[]
          guess_candidate_ids: string[]
          guesses_remaining: number
          updated_at: string
          word_id: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          guess_attempt_ids?: string[]
          guess_candidate_ids?: string[]
          guesses_remaining?: number
          updated_at?: string
          word_id?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          guess_attempt_ids?: string[]
          guess_candidate_ids?: string[]
          guesses_remaining?: number
          updated_at?: string
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_secrets_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_secrets_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          angel_enabled: boolean
          category_id: string | null
          chameleon_caught_id: string | null
          chameleon_tied_player_ids: string[]
          chameleon_vote_stage: number
          created_at: string
          current_round: number
          dealer_id: string | null
          ended_at: string | null
          expires_at: string
          game_mode: string
          host_id: string
          id: string
          last_lynch_victim: string | null
          last_night_victim: string | null
          mafia_count: number
          max_rounds: number
          phase_started_at: string
          reveal_role_on_death: boolean
          room_code: string
          sheriff_enabled: boolean
          show_categories: boolean
          status: Database["public"]["Enums"]["game_status"]
          updated_at: string
          winner: string | null
          word_id: string | null
        }
        Insert: {
          angel_enabled?: boolean
          category_id?: string | null
          chameleon_caught_id?: string | null
          chameleon_tied_player_ids?: string[]
          chameleon_vote_stage?: number
          created_at?: string
          current_round?: number
          dealer_id?: string | null
          ended_at?: string | null
          expires_at?: string
          game_mode?: string
          host_id: string
          id?: string
          last_lynch_victim?: string | null
          last_night_victim?: string | null
          mafia_count?: number
          max_rounds?: number
          phase_started_at?: string
          reveal_role_on_death?: boolean
          room_code: string
          sheriff_enabled?: boolean
          show_categories?: boolean
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          winner?: string | null
          word_id?: string | null
        }
        Update: {
          angel_enabled?: boolean
          category_id?: string | null
          chameleon_caught_id?: string | null
          chameleon_tied_player_ids?: string[]
          chameleon_vote_stage?: number
          created_at?: string
          current_round?: number
          dealer_id?: string | null
          ended_at?: string | null
          expires_at?: string
          game_mode?: string
          host_id?: string
          id?: string
          last_lynch_victim?: string | null
          last_night_victim?: string | null
          mafia_count?: number
          max_rounds?: number
          phase_started_at?: string
          reveal_role_on_death?: boolean
          room_code?: string
          sheriff_enabled?: boolean
          show_categories?: boolean
          status?: Database["public"]["Enums"]["game_status"]
          updated_at?: string
          winner?: string | null
          word_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_chameleon_caught_id_fkey"
            columns: ["chameleon_caught_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_last_lynch_victim_fkey"
            columns: ["last_lynch_victim"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_last_night_victim_fkey"
            columns: ["last_night_victim"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      hints_given: {
        Row: {
          given_at: string
          id: string
          player_id: string
          round_id: string
        }
        Insert: {
          given_at?: string
          id?: string
          player_id: string
          round_id: string
        }
        Update: {
          given_at?: string
          id?: string
          player_id?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hints_given_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hints_given_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      night_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["night_action_type"]
          actor_id: string
          created_at: string
          game_id: string
          id: string
          result: string | null
          round_number: number
          target_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["night_action_type"]
          actor_id: string
          created_at?: string
          game_id: string
          id?: string
          result?: string | null
          round_number: number
          target_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["night_action_type"]
          actor_id?: string
          created_at?: string
          game_id?: string
          id?: string
          result?: string | null
          round_number?: number
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "night_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "night_actions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "night_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          game_id: string
          hint_order: string[]
          id: string
          round_number: number
        }
        Insert: {
          game_id: string
          hint_order: string[]
          id?: string
          round_number: number
        }
        Update: {
          game_id?: string
          hint_order?: string[]
          id?: string
          round_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_guest: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          is_guest?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_guest?: boolean
        }
        Relationships: []
      }
      votes: {
        Row: {
          cast_at: string
          id: string
          round_id: string
          vote_stage: number
          voted_for_id: string
          voter_id: string
        }
        Insert: {
          cast_at?: string
          id?: string
          round_id: string
          vote_stage?: number
          voted_for_id: string
          voter_id: string
        }
        Update: {
          cast_at?: string
          id?: string
          round_id?: string
          vote_stage?: number
          voted_for_id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voted_for_id_fkey"
            columns: ["voted_for_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          category_id: string
          id: string
          text: string
        }
        Insert: {
          category_id: string
          id?: string
          text: string
        }
        Update: {
          category_id?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "words_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      game_players_public: {
        Row: {
          display_name: string | null
          game_id: string | null
          id: string | null
          is_eliminated: boolean | null
          is_outsider: boolean | null
          join_order: number | null
          joined_at: string | null
          last_seen_at: string | null
          role: Database["public"]["Enums"]["player_role"] | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _game_status: {
        Args: { p_game_id: string }
        Returns: Database["public"]["Enums"]["game_status"]
      }
      _is_alive_player: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: boolean
      }
      _mafia_win_check: { Args: { p_game_id: string }; Returns: string }
      _maybe_resolve_night: {
        Args: { p_game_id: string; p_round: number }
        Returns: undefined
      }
      advance_game_phase: { Args: { p_game_id: string }; Returns: undefined }
      begin_day_vote: { Args: { p_game_id: string }; Returns: undefined }
      begin_night: { Args: { p_game_id: string }; Returns: undefined }
      break_chameleon_tie: {
        Args: { p_game_id: string; p_target_id: string }
        Returns: undefined
      }
      cast_chameleon_vote: {
        Args: { p_game_id: string; p_target_id: string }
        Returns: undefined
      }
      cast_day_vote: {
        Args: { p_game_id: string; p_target_id: string }
        Returns: undefined
      }
      claim_room_host: { Args: { p_game_id: string }; Returns: string }
      close_game: { Args: { p_game_id: string }; Returns: undefined }
      count_game_players: { Args: { p_game_id: string }; Returns: number }
      create_game: {
        Args: { p_category_id?: string; p_game_mode: string }
        Returns: {
          game_mode: string
          id: string
          room_code: string
        }[]
      }
      force_advance_phase: { Args: { p_game_id: string }; Returns: undefined }
      get_game_snapshot: { Args: { p_room_code: string }; Returns: Json }
      heartbeat_game: { Args: { p_game_id: string }; Returns: string }
      join_game: {
        Args: { p_room_code: string }
        Returns: {
          game_mode: string
          id: string
          room_code: string
        }[]
      }
      leave_game: { Args: { p_game_id: string }; Returns: undefined }
      list_open_games: {
        Args: never
        Returns: {
          capacity: number
          created_at: string
          game_mode: string
          host_name: string
          player_count: number
          room_code: string
        }[]
      }
      mark_phase_ready: { Args: { p_game_id: string }; Returns: undefined }
      reset_game_for_rematch: {
        Args: { p_game_id: string }
        Returns: undefined
      }
      resolve_day: { Args: { p_game_id: string }; Returns: undefined }
      resolve_night: { Args: { p_game_id: string }; Returns: undefined }
      round_voter_ids: { Args: { p_round_id: string }; Returns: string[] }
      start_game: { Args: { p_game_id: string }; Returns: undefined }
      start_mafia_game: { Args: { p_game_id: string }; Returns: undefined }
      submit_chameleon_guess: {
        Args: { p_game_id: string; p_word_id: string }
        Returns: Json
      }
      submit_chameleon_hint: { Args: { p_game_id: string }; Returns: undefined }
      submit_night_action: {
        Args: {
          p_action_type: Database["public"]["Enums"]["night_action_type"]
          p_game_id: string
          p_target_id: string
        }
        Returns: undefined
      }
      update_game_settings: {
        Args: {
          p_angel_enabled?: boolean
          p_category_id?: string
          p_game_id: string
          p_mafia_count?: number
          p_max_rounds?: number
          p_reveal_role_on_death?: boolean
          p_sheriff_enabled?: boolean
          p_show_categories?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      game_status:
        | "lobby"
        | "role_reveal"
        | "hint_phase"
        | "voting"
        | "round_result"
        | "game_over"
        | "night"
        | "day_result"
        | "day_vote"
        | "lynch_result"
        | "chameleon_tie_break"
        | "chameleon_guess"
      night_action_type: "kill" | "inspect" | "protect"
      player_role: "faithful" | "mafia" | "sheriff" | "angel"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      game_status: [
        "lobby",
        "role_reveal",
        "hint_phase",
        "voting",
        "round_result",
        "game_over",
        "night",
        "day_result",
        "day_vote",
        "lynch_result",
        "chameleon_tie_break",
        "chameleon_guess",
      ],
      night_action_type: ["kill", "inspect", "protect"],
      player_role: ["faithful", "mafia", "sheriff", "angel"],
    },
  },
} as const
