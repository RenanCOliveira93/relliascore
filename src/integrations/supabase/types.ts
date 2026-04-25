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
      analises: {
        Row: {
          action_plan: Json | null
          created_at: string
          dados_marca: Json | null
          empresa_id: string | null
          id: string
          keywords_analysis: Json | null
          origem: string
          score: number | null
          sub_scores: Json | null
          summary: string | null
          tipo: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action_plan?: Json | null
          created_at?: string
          dados_marca?: Json | null
          empresa_id?: string | null
          id?: string
          keywords_analysis?: Json | null
          origem?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          tipo: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action_plan?: Json | null
          created_at?: string
          dados_marca?: Json | null
          empresa_id?: string | null
          id?: string
          keywords_analysis?: Json | null
          origem?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          tipo?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      analises_competitivas: {
        Row: {
          concorrente_id: string
          created_at: string
          empresa_id: string | null
          id: string
          score: number | null
          sub_scores: Json | null
          summary: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          concorrente_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          concorrente_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          score?: number | null
          sub_scores?: Json | null
          summary?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analises_competitivas_concorrente_id_fkey"
            columns: ["concorrente_id"]
            isOneToOne: false
            referencedRelation: "concorrentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_competitivas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analises_competitivas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_analyses: {
        Row: {
          created_at: string
          description: string
          id: string
          instagram: string | null
          linkedin: string | null
          mode: string
          result: Json
          user_id: string
          website: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mode?: string
          result: Json
          user_id: string
          website?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          instagram?: string | null
          linkedin?: string | null
          mode?: string
          result?: Json
          user_id?: string
          website?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_analyses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      concorrentes: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          search_query: string
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          search_query: string
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          search_query?: string
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concorrentes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concorrentes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          analise_marca_ativa: boolean
          created_at: string
          descricao: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          monitoramento_ativo: boolean
          nome: string
          search_query: string
          updated_at: string
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          analise_marca_ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          monitoramento_ativo?: boolean
          nome: string
          search_query: string
          updated_at?: string
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          analise_marca_ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          monitoramento_ativo?: boolean
          nome?: string
          search_query?: string
          updated_at?: string
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          analysis_mode: string | null
          analysis_result: Json | null
          convertido: boolean
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          score: number | null
          search_query: string | null
          sub_scores: Json | null
          summary: string | null
          website_url: string | null
        }
        Insert: {
          analysis_mode?: string | null
          analysis_result?: Json | null
          convertido?: boolean
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          score?: number | null
          search_query?: string | null
          sub_scores?: Json | null
          summary?: string | null
          website_url?: string | null
        }
        Update: {
          analysis_mode?: string | null
          analysis_result?: Json | null
          convertido?: boolean
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          score?: number | null
          search_query?: string | null
          sub_scores?: Json | null
          summary?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_de_acao: {
        Row: {
          action: string
          analise_id: string | null
          category: string | null
          concluida: boolean
          created_at: string
          empresa_id: string | null
          id: string
          impact: string | null
          priority: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          analise_id?: string | null
          category?: string | null
          concluida?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          impact?: string | null
          priority: string
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          analise_id?: string | null
          category?: string | null
          concluida?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          impact?: string | null
          priority?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_de_acao_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "analises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_de_acao_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_de_acao_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          analyses_limit: number
          analyses_used: number
          created_at: string
          id: string
          period_start: string
          plan: Database["public"]["Enums"]["app_plan"]
          updated_at: string
          user_id: string
        }
        Insert: {
          analyses_limit?: number
          analyses_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          user_id: string
        }
        Update: {
          analyses_limit?: number
          analyses_used?: number
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["app_plan"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_webhooks: {
        Row: {
          created_at: string
          events: string[]
          failure_count: number
          id: string
          is_active: boolean
          last_error: string | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          success_count: number
          url: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          success_count?: number
          url: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          failure_count?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          success_count?: number
          url?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_webhooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          analise_competitiva_ativa: boolean
          analise_marca_ativa: boolean
          created_at: string
          id: string
          logo_url: string | null
          monitoramento_ativo: boolean
          name: string
          score_alert_threshold: number
          user_id: string
        }
        Insert: {
          analise_competitiva_ativa?: boolean
          analise_marca_ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          monitoramento_ativo?: boolean
          name: string
          score_alert_threshold?: number
          user_id: string
        }
        Update: {
          analise_competitiva_ativa?: boolean
          analise_marca_ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          monitoramento_ativo?: boolean
          name?: string
          score_alert_threshold?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_analysis_usage: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      record_webhook_delivery: {
        Args: { p_error?: string; p_success: boolean; p_webhook_id: string }
        Returns: undefined
      }
      validate_api_key: {
        Args: { p_key_hash: string }
        Returns: {
          key_id: string
          user_id: string
          workspace_id: string
        }[]
      }
    }
    Enums: {
      app_plan: "free" | "pro" | "premium"
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
      app_plan: ["free", "pro", "premium"],
    },
  },
} as const
