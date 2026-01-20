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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          agent_id: string
          attended: boolean | null
          confirmed: boolean | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          attended?: boolean | null
          confirmed?: boolean | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          scheduled_date: string
          scheduled_time: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          attended?: boolean | null
          confirmed?: boolean | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          scheduled_date?: string
          scheduled_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean
          modality: Database["public"]["Enums"]["course_modality"]
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          modality?: Database["public"]["Enums"]["course_modality"]
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          modality?: Database["public"]["Enums"]["course_modality"]
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      enrollment_history: {
        Row: {
          changed_by: string | null
          created_at: string
          enrollment_id: string
          from_status: Database["public"]["Enums"]["academic_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["academic_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          enrollment_id: string
          from_status?: Database["public"]["Enums"]["academic_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["academic_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          enrollment_id?: string
          from_status?: Database["public"]["Enums"]["academic_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["academic_status"]
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_history_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          certificate_issued: boolean | null
          certificate_issued_at: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          enrolled_at: string
          grade: number | null
          id: string
          lead_id: string | null
          notes: string | null
          progress_percentage: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["academic_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrolled_at?: string
          grade?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["academic_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_issued?: boolean | null
          certificate_issued_at?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrolled_at?: string
          grade?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["academic_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      lead_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ad_name: string | null
          ad_set: string | null
          assigned_agent_id: string | null
          campaign: string | null
          course_interest_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string
          scheduled_at: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          ad_name?: string | null
          ad_set?: string | null
          assigned_agent_id?: string | null
          campaign?: string | null
          course_interest_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone: string
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          ad_name?: string | null
          ad_set?: string | null
          assigned_agent_id?: string | null
          campaign?: string | null
          course_interest_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string
          scheduled_at?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_course_interest_id_fkey"
            columns: ["course_interest_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          available_for_casting: boolean | null
          bio: string | null
          bust_cm: number | null
          created_at: string
          eye_color: string | null
          followers_count: number | null
          hair_color: string | null
          height_cm: number | null
          hip_cm: number | null
          id: string
          instagram_handle: string | null
          portfolio_url: string | null
          shoe_size: number | null
          skin_tone: string | null
          tiktok_handle: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
          youtube_channel: string | null
        }
        Insert: {
          available_for_casting?: boolean | null
          bio?: string | null
          bust_cm?: number | null
          created_at?: string
          eye_color?: string | null
          followers_count?: number | null
          hair_color?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          instagram_handle?: string | null
          portfolio_url?: string | null
          shoe_size?: number | null
          skin_tone?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
          youtube_channel?: string | null
        }
        Update: {
          available_for_casting?: boolean | null
          bio?: string | null
          bust_cm?: number | null
          created_at?: string
          eye_color?: string | null
          followers_count?: number | null
          hair_color?: string | null
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          instagram_handle?: string | null
          portfolio_url?: string | null
          shoe_size?: number | null
          skin_tone?: string | null
          tiktok_handle?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
          youtube_channel?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      academic_status:
        | "ativo"
        | "em_curso"
        | "inadimplente"
        | "evasao"
        | "concluido"
        | "trancado"
      app_role:
        | "admin"
        | "gestor"
        | "agente_comercial"
        | "recepcao"
        | "professor"
        | "produtor"
        | "scouter"
        | "aluno"
      course_modality: "presencial" | "online" | "hibrido"
      lead_source:
        | "whatsapp"
        | "instagram"
        | "facebook"
        | "google"
        | "indicacao"
        | "site"
        | "presencial"
        | "outro"
      lead_status:
        | "lead"
        | "em_atendimento"
        | "agendado"
        | "confirmado"
        | "compareceu"
        | "proposta"
        | "matriculado"
        | "perdido"
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
      academic_status: [
        "ativo",
        "em_curso",
        "inadimplente",
        "evasao",
        "concluido",
        "trancado",
      ],
      app_role: [
        "admin",
        "gestor",
        "agente_comercial",
        "recepcao",
        "professor",
        "produtor",
        "scouter",
        "aluno",
      ],
      course_modality: ["presencial", "online", "hibrido"],
      lead_source: [
        "whatsapp",
        "instagram",
        "facebook",
        "google",
        "indicacao",
        "site",
        "presencial",
        "outro",
      ],
      lead_status: [
        "lead",
        "em_atendimento",
        "agendado",
        "confirmado",
        "compareceu",
        "proposta",
        "matriculado",
        "perdido",
      ],
    },
  },
} as const
