export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
        Relationships: []
      }
      game_players: {
        Row: {
          game_id: string
          id: string
          is_eliminated: boolean
          is_outsider: boolean
          join_order: number
          joined_at: string
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          is_eliminated?: boolean
          is_outsider?: boolean
          join_order: number
          joined_at?: string
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          is_eliminated?: boolean
          is_outsider?: boolean
          join_order?: number
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          category_id: string
          created_at: string
          current_round: number
          ended_at: string | null
          host_id: string
          id: string
          mafia_count: number
          max_rounds: number
          room_code: string
          show_categories: boolean
          status: Database["public"]["Enums"]["game_status"]
          word_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          current_round?: number
          ended_at?: string | null
          host_id: string
          id?: string
          mafia_count?: number
          max_rounds?: number
          room_code: string
          show_categories?: boolean
          status?: Database["public"]["Enums"]["game_status"]
          word_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          current_round?: number
          ended_at?: string | null
          host_id?: string
          id?: string
          mafia_count?: number
          max_rounds?: number
          room_code?: string
          show_categories?: boolean
          status?: Database["public"]["Enums"]["game_status"]
          word_id?: string | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          voted_for_id: string
          voter_id: string
        }
        Insert: {
          cast_at?: string
          id?: string
          round_id: string
          voted_for_id: string
          voter_id: string
        }
        Update: {
          cast_at?: string
          id?: string
          round_id?: string
          voted_for_id?: string
          voter_id?: string
        }
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      game_players_public: {
        Row: {
          game_id: string | null
          id: string | null
          is_eliminated: boolean | null
          is_outsider: boolean | null
          join_order: number | null
          joined_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      start_game: { Args: { p_game_id: string }; Returns: undefined }
      count_game_players: { Args: { p_game_id: string }; Returns: number }
    }
    Enums: {
      game_status:
        | "lobby"
        | "role_reveal"
        | "hint_phase"
        | "voting"
        | "round_result"
        | "game_over"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> =
  (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends { Row: infer R } ? R : never

export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
