/**
 * Hand-written database types matching supabase/migrations.
 * If the schema changes, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * (and re-apply the Json import shape below if needed).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = 'super_admin' | 'editor' | 'viewer';
export type SessionStatus = 'lobby' | 'active' | 'finished';
export type ProjectStatus = 'ongoing' | 'one_time' | 'campaign';
export type ProjectLifecycle = 'active' | 'upcoming';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: Role;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: Role;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: Role;
          created_at?: string;
        };
        Relationships: [];
      };
      forms: {
        Row: {
          id: string;
          title: string;
          slug: string;
          schema: Json;
          style: Json;
          is_published: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          schema: Json;
          style?: Json;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          schema?: Json;
          style?: Json;
          is_published?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      form_submissions: {
        Row: {
          id: string;
          form_id: string;
          data: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          data: Json;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          data?: Json;
          submitted_at?: string;
        };
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          title: string;
          cover_image: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          cover_image?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          cover_image?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          quiz_id: string;
          question_text: string;
          options: Json;
          correct_indexes: number[];
          time_limit_seconds: number;
          points: number;
          position: number;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question_text: string;
          options: Json;
          correct_indexes: number[];
          time_limit_seconds?: number;
          points?: number;
          position: number;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question_text?: string;
          options?: Json;
          correct_indexes?: number[];
          time_limit_seconds?: number;
          points?: number;
          position?: number;
        };
        Relationships: [];
      };
      game_sessions: {
        Row: {
          id: string;
          quiz_id: string;
          room_code: string;
          status: SessionStatus;
          current_question_index: number;
          started_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          room_code: string;
          status?: SessionStatus;
          current_question_index?: number;
          started_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          room_code?: string;
          status?: SessionStatus;
          current_question_index?: number;
          started_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      game_players: {
        Row: {
          id: string;
          session_id: string;
          nickname: string;
          score: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          nickname: string;
          score?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          nickname?: string;
          score?: number;
          joined_at?: string;
        };
        Relationships: [];
      };
      game_answers: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          question_id: string;
          selected_indexes: number[];
          answered_at: string;
          is_correct: boolean;
          points_awarded: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          player_id: string;
          question_id: string;
          selected_indexes: number[];
          answered_at?: string;
          is_correct: boolean;
          points_awarded?: number;
        };
        Update: {
          id?: string;
          session_id?: string;
          player_id?: string;
          question_id?: string;
          selected_indexes?: number[];
          answered_at?: string;
          is_correct?: boolean;
          points_awarded?: number;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          title: string;
          category: string;
          icon: string | null;
          short_description: string;
          full_description: string | null;
          read_more: string | null;
          cover_image: string | null;
          gallery: Json;
          tags: string[];
          status: ProjectStatus;
          is_fundraiser: boolean;
          goal_amount: number | null;
          current_amount: number | null;
          donors_count: number | null;
          external_donate_url: string | null;
          slug: string | null;
          sort_order: number;
          featured: boolean;
          badge: string | null;
          lifecycle: ProjectLifecycle | null;
          main_image_alt: string | null;
          currency: string;
          progress_visible: boolean;
          progress_percent: number | null;
          amount_left: number | null;
          deadline_days: number | null;
          presentation: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category: string;
          icon?: string | null;
          short_description: string;
          full_description?: string | null;
          read_more?: string | null;
          cover_image?: string | null;
          gallery?: Json;
          tags?: string[];
          status?: ProjectStatus;
          is_fundraiser?: boolean;
          goal_amount?: number | null;
          current_amount?: number | null;
          donors_count?: number | null;
          external_donate_url?: string | null;
          slug?: string | null;
          sort_order?: number;
          featured?: boolean;
          badge?: string | null;
          lifecycle?: ProjectLifecycle | null;
          main_image_alt?: string | null;
          currency?: string;
          progress_visible?: boolean;
          progress_percent?: number | null;
          amount_left?: number | null;
          deadline_days?: number | null;
          presentation?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          category?: string;
          icon?: string | null;
          short_description?: string;
          full_description?: string | null;
          read_more?: string | null;
          cover_image?: string | null;
          gallery?: Json;
          tags?: string[];
          status?: ProjectStatus;
          is_fundraiser?: boolean;
          goal_amount?: number | null;
          current_amount?: number | null;
          donors_count?: number | null;
          external_donate_url?: string | null;
          slug?: string | null;
          sort_order?: number;
          featured?: boolean;
          badge?: string | null;
          lifecycle?: ProjectLifecycle | null;
          main_image_alt?: string | null;
          currency?: string;
          progress_visible?: boolean;
          progress_percent?: number | null;
          amount_left?: number | null;
          deadline_days?: number | null;
          presentation?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_role: {
        Args: Record<string, never>;
        Returns: Role;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
