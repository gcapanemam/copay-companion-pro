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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      beneficiario_senhas: {
        Row: {
          cpf: string
          created_at: string
          id: string
          senha_hash: string
        }
        Insert: {
          cpf: string
          created_at?: string
          id?: string
          senha_hash: string
        }
        Update: {
          cpf?: string
          created_at?: string
          id?: string
          senha_hash?: string
        }
        Relationships: []
      }
      contracheques: {
        Row: {
          ano: number
          arquivo_path: string
          cpf: string
          created_at: string
          id: string
          mes: number
          nome_arquivo: string
        }
        Insert: {
          ano: number
          arquivo_path: string
          cpf: string
          created_at?: string
          id?: string
          mes: number
          nome_arquivo: string
        }
        Update: {
          ano?: number
          arquivo_path?: string
          cpf?: string
          created_at?: string
          id?: string
          mes?: number
          nome_arquivo?: string
        }
        Relationships: []
      }
      coparticipacao_itens: {
        Row: {
          coparticipacao_id: string
          created_at: string
          id: string
          local: string | null
          procedimento: string
          quantidade: number
          valor: number
        }
        Insert: {
          coparticipacao_id: string
          created_at?: string
          id?: string
          local?: string | null
          procedimento: string
          quantidade?: number
          valor?: number
        }
        Update: {
          coparticipacao_id?: string
          created_at?: string
          id?: string
          local?: string | null
          procedimento?: string
          quantidade?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "coparticipacao_itens_coparticipacao_id_fkey"
            columns: ["coparticipacao_id"]
            isOneToOne: false
            referencedRelation: "coparticipacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      coparticipacoes: {
        Row: {
          ano: number
          created_at: string
          data_utilizacao: string | null
          dependente_id: string | null
          id: string
          mes: number
          nome_usuario: string
          titular_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          data_utilizacao?: string | null
          dependente_id?: string | null
          id?: string
          mes: number
          nome_usuario: string
          titular_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          data_utilizacao?: string | null
          dependente_id?: string | null
          id?: string
          mes?: number
          nome_usuario?: string
          titular_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coparticipacoes_dependente_id_fkey"
            columns: ["dependente_id"]
            isOneToOne: false
            referencedRelation: "dependentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coparticipacoes_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      dependentes: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          matricula: string | null
          nome: string
          titular_id: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome: string
          titular_id: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome?: string
          titular_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dependentes_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      epis: {
        Row: {
          cpf: string
          created_at: string
          data_entrega: string
          data_validade: string | null
          id: string
          observacao: string | null
          quantidade: number
          tipo_epi: string
        }
        Insert: {
          cpf: string
          created_at?: string
          data_entrega: string
          data_validade?: string | null
          id?: string
          observacao?: string | null
          quantidade?: number
          tipo_epi: string
        }
        Update: {
          cpf?: string
          created_at?: string
          data_entrega?: string
          data_validade?: string | null
          id?: string
          observacao?: string | null
          quantidade?: number
          tipo_epi?: string
        }
        Relationships: []
      }
      faltas: {
        Row: {
          abonada: boolean
          cpf: string
          created_at: string
          data_falta: string
          id: string
          justificativa: string | null
          tipo: string
        }
        Insert: {
          abonada?: boolean
          cpf: string
          created_at?: string
          data_falta: string
          id?: string
          justificativa?: string | null
          tipo?: string
        }
        Update: {
          abonada?: boolean
          cpf?: string
          created_at?: string
          data_falta?: string
          id?: string
          justificativa?: string | null
          tipo?: string
        }
        Relationships: []
      }
      mensalidades: {
        Row: {
          ano: number
          created_at: string
          dependente_id: string | null
          id: string
          mes: number
          titular_id: string
          valor: number
        }
        Insert: {
          ano: number
          created_at?: string
          dependente_id?: string | null
          id?: string
          mes: number
          titular_id: string
          valor?: number
        }
        Update: {
          ano?: number
          created_at?: string
          dependente_id?: string | null
          id?: string
          mes?: number
          titular_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_dependente_id_fkey"
            columns: ["dependente_id"]
            isOneToOne: false
            referencedRelation: "dependentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "titulares"
            referencedColumns: ["id"]
          },
        ]
      }
      titulares: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          matricula: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          data_upload: string
          id: string
          nome_arquivo: string
          tipo: string
        }
        Insert: {
          data_upload?: string
          id?: string
          nome_arquivo: string
          tipo: string
        }
        Update: {
          data_upload?: string
          id?: string
          nome_arquivo?: string
          tipo?: string
        }
        Relationships: []
      }
      vale_transporte: {
        Row: {
          ano: number
          cpf: string
          created_at: string
          id: string
          mes: number
          observacao: string | null
          quantidade_passagens: number | null
          valor: number
        }
        Insert: {
          ano: number
          cpf: string
          created_at?: string
          id?: string
          mes: number
          observacao?: string | null
          quantidade_passagens?: number | null
          valor?: number
        }
        Update: {
          ano?: number
          cpf?: string
          created_at?: string
          id?: string
          mes?: number
          observacao?: string | null
          quantidade_passagens?: number | null
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
