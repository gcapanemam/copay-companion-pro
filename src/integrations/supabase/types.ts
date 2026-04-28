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
      admissao_campos: {
        Row: {
          ativo: boolean
          campo_nome: string
          created_at: string
          grupo: string
          id: string
          label: string
          obrigatorio: boolean
          opcoes: string[] | null
          ordem: number
          placeholder: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          campo_nome: string
          created_at?: string
          grupo?: string
          id?: string
          label: string
          obrigatorio?: boolean
          opcoes?: string[] | null
          ordem?: number
          placeholder?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean
          campo_nome?: string
          created_at?: string
          grupo?: string
          id?: string
          label?: string
          obrigatorio?: boolean
          opcoes?: string[] | null
          ordem?: number
          placeholder?: string | null
          tipo?: string
        }
        Relationships: []
      }
      admissoes: {
        Row: {
          bairro: string | null
          cep: string | null
          cor: string | null
          cpf: string
          cpf_conjuge: string | null
          cpf_dependentes: string | null
          created_at: string
          dados: Json | null
          dados_bancarios: string | null
          data_cadastro_pis: string | null
          data_demissao: string | null
          data_expedicao_rg: string | null
          data_nascimento: string | null
          departamento: string | null
          dependentes_ir: string | null
          detalhes_vale_transporte: string | null
          email: string | null
          emissao_ctps: string | null
          endereco: string | null
          escolaridade: string | null
          estado_civil: string | null
          foto_url: string | null
          funcao: string | null
          horario_trabalho: string | null
          id: string
          interesse_plano: string | null
          local_nascimento: string | null
          nome_completo: string
          nome_conjuge: string | null
          nome_mae: string | null
          nome_pai: string | null
          numero_ctps: string | null
          numero_pis: string | null
          observacoes: string | null
          plano_escolhido: string | null
          primeiro_dia_trabalho: string | null
          primeiro_emprego: boolean | null
          rg: string | null
          serie_ctps: string | null
          sexo: string | null
          telefone: string | null
          titulo_eleitor: string | null
          unidade: string | null
          vale_transporte: boolean | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cor?: string | null
          cpf: string
          cpf_conjuge?: string | null
          cpf_dependentes?: string | null
          created_at?: string
          dados?: Json | null
          dados_bancarios?: string | null
          data_cadastro_pis?: string | null
          data_demissao?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_ir?: string | null
          detalhes_vale_transporte?: string | null
          email?: string | null
          emissao_ctps?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          funcao?: string | null
          horario_trabalho?: string | null
          id?: string
          interesse_plano?: string | null
          local_nascimento?: string | null
          nome_completo: string
          nome_conjuge?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero_ctps?: string | null
          numero_pis?: string | null
          observacoes?: string | null
          plano_escolhido?: string | null
          primeiro_dia_trabalho?: string | null
          primeiro_emprego?: boolean | null
          rg?: string | null
          serie_ctps?: string | null
          sexo?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          unidade?: string | null
          vale_transporte?: boolean | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cor?: string | null
          cpf?: string
          cpf_conjuge?: string | null
          cpf_dependentes?: string | null
          created_at?: string
          dados?: Json | null
          dados_bancarios?: string | null
          data_cadastro_pis?: string | null
          data_demissao?: string | null
          data_expedicao_rg?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          dependentes_ir?: string | null
          detalhes_vale_transporte?: string | null
          email?: string | null
          emissao_ctps?: string | null
          endereco?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          funcao?: string | null
          horario_trabalho?: string | null
          id?: string
          interesse_plano?: string | null
          local_nascimento?: string | null
          nome_completo?: string
          nome_conjuge?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          numero_ctps?: string | null
          numero_pis?: string | null
          observacoes?: string | null
          plano_escolhido?: string | null
          primeiro_dia_trabalho?: string | null
          primeiro_emprego?: boolean | null
          rg?: string | null
          serie_ctps?: string | null
          sexo?: string | null
          telefone?: string | null
          titulo_eleitor?: string | null
          unidade?: string | null
          vale_transporte?: boolean | null
        }
        Relationships: []
      }
      banco_horas_movimentos: {
        Row: {
          cpf: string
          created_at: string
          data_referencia: string
          descricao: string | null
          expira_em: string | null
          id: string
          minutos: number
          origem: string
          registro_ponto_id: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          data_referencia: string
          descricao?: string | null
          expira_em?: string | null
          id?: string
          minutos: number
          origem?: string
          registro_ponto_id?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          data_referencia?: string
          descricao?: string | null
          expira_em?: string | null
          id?: string
          minutos?: number
          origem?: string
          registro_ponto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_movimentos_registro_ponto_id_fkey"
            columns: ["registro_ponto_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
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
      chat_conversas: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          nome: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string | null
          tipo?: string
        }
        Relationships: []
      }
      chat_membros: {
        Row: {
          conversa_id: string
          cpf: string
          created_at: string
          id: string
        }
        Insert: {
          conversa_id: string
          cpf: string
          created_at?: string
          id?: string
        }
        Update: {
          conversa_id?: string
          cpf?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_membros_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "chat_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagem_status: {
        Row: {
          cpf: string
          id: string
          lido_em: string | null
          mensagem_id: string
          recebido_em: string | null
        }
        Insert: {
          cpf: string
          id?: string
          lido_em?: string | null
          mensagem_id: string
          recebido_em?: string | null
        }
        Update: {
          cpf?: string
          id?: string
          lido_em?: string | null
          mensagem_id?: string
          recebido_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagem_status_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "chat_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          remetente_cpf: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          remetente_cpf: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          remetente_cpf?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "chat_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      codigos_2fa: {
        Row: {
          codigo: string
          cpf: string
          created_at: string
          expira_em: string
          id: string
          usado: boolean
        }
        Insert: {
          codigo: string
          cpf: string
          created_at?: string
          expira_em: string
          id?: string
          usado?: boolean
        }
        Update: {
          codigo?: string
          cpf?: string
          created_at?: string
          expira_em?: string
          id?: string
          usado?: boolean
        }
        Relationships: []
      }
      comunicado_destinatarios: {
        Row: {
          comunicado_id: string
          cpf: string
          created_at: string
          id: string
        }
        Insert: {
          comunicado_id: string
          cpf: string
          created_at?: string
          id?: string
        }
        Update: {
          comunicado_id?: string
          cpf?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_destinatarios_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicado_leituras: {
        Row: {
          comunicado_id: string
          confirmado_em: string | null
          cpf: string
          created_at: string
          id: string
          visualizado_em: string | null
        }
        Insert: {
          comunicado_id: string
          confirmado_em?: string | null
          cpf: string
          created_at?: string
          id?: string
          visualizado_em?: string | null
        }
        Update: {
          comunicado_id?: string
          confirmado_em?: string | null
          cpf?: string
          created_at?: string
          id?: string
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicado_leituras_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          mensagem: string
          tipo_destinatario: string
          titulo: string
          valor_destinatario: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem: string
          tipo_destinatario?: string
          titulo: string
          valor_destinatario?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem?: string
          tipo_destinatario?: string
          titulo?: string
          valor_destinatario?: string | null
        }
        Relationships: []
      }
      config_horas_extras: {
        Row: {
          adicional_100_pct: number
          adicional_50_pct: number
          created_at: string
          expiracao_banco_meses: number
          id: string
          permite_banco_horas: boolean
          tolerancia_min: number
          updated_at: string
        }
        Insert: {
          adicional_100_pct?: number
          adicional_50_pct?: number
          created_at?: string
          expiracao_banco_meses?: number
          id?: string
          permite_banco_horas?: boolean
          tolerancia_min?: number
          updated_at?: string
        }
        Update: {
          adicional_100_pct?: number
          adicional_50_pct?: number
          created_at?: string
          expiracao_banco_meses?: number
          id?: string
          permite_banco_horas?: boolean
          tolerancia_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          chave: string
          created_at: string
          id: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          valor?: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          valor?: string
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
      controlid_comandos: {
        Row: {
          body: Json | null
          concluido_em: string | null
          content_type: string
          created_at: string
          device_id_externo: string | null
          endpoint: string
          enviado_em: string | null
          equipamento_id: string | null
          erro: string | null
          id: string
          query_string: string | null
          resultado: Json | null
          status: string
          uuid: string | null
          verb: string
        }
        Insert: {
          body?: Json | null
          concluido_em?: string | null
          content_type?: string
          created_at?: string
          device_id_externo?: string | null
          endpoint: string
          enviado_em?: string | null
          equipamento_id?: string | null
          erro?: string | null
          id?: string
          query_string?: string | null
          resultado?: Json | null
          status?: string
          uuid?: string | null
          verb?: string
        }
        Update: {
          body?: Json | null
          concluido_em?: string | null
          content_type?: string
          created_at?: string
          device_id_externo?: string | null
          endpoint?: string
          enviado_em?: string | null
          equipamento_id?: string | null
          erro?: string | null
          id?: string
          query_string?: string | null
          resultado?: Json | null
          status?: string
          uuid?: string | null
          verb?: string
        }
        Relationships: [
          {
            foreignKeyName: "controlid_comandos_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      controlid_push_log: {
        Row: {
          body: Json | null
          created_at: string
          device_id_externo: string | null
          equipamento_id: string | null
          id: string
          ip: string | null
          metodo: string | null
          query: Json | null
          resposta: Json | null
          tipo: string
          user_agent: string | null
        }
        Insert: {
          body?: Json | null
          created_at?: string
          device_id_externo?: string | null
          equipamento_id?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          query?: Json | null
          resposta?: Json | null
          tipo: string
          user_agent?: string | null
        }
        Update: {
          body?: Json | null
          created_at?: string
          device_id_externo?: string | null
          equipamento_id?: string | null
          id?: string
          ip?: string | null
          metodo?: string | null
          query?: Json | null
          resposta?: Json | null
          tipo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controlid_push_log_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_ponto"
            referencedColumns: ["id"]
          },
        ]
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
      equipamentos_ponto: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          device_id_externo: string | null
          host: string | null
          id: string
          modelo: string | null
          nome: string
          numero_serie: string | null
          porta: number | null
          senha_cripto: string | null
          tipo_conexao: string
          ultima_sincronizacao: string | null
          ultimo_nsr: number
          updated_at: string
          usuario: string | null
          versao_firmware: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          device_id_externo?: string | null
          host?: string | null
          id?: string
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          porta?: number | null
          senha_cripto?: string | null
          tipo_conexao?: string
          ultima_sincronizacao?: string | null
          ultimo_nsr?: number
          updated_at?: string
          usuario?: string | null
          versao_firmware?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          device_id_externo?: string | null
          host?: string | null
          id?: string
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          porta?: number | null
          senha_cripto?: string | null
          tipo_conexao?: string
          ultima_sincronizacao?: string | null
          ultimo_nsr?: number
          updated_at?: string
          usuario?: string | null
          versao_firmware?: string | null
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
      funcionario_documentos: {
        Row: {
          arquivo_url: string
          cpf: string
          created_at: string
          drive_url_original: string | null
          id: string
          nome_arquivo: string
          tipo_documento: string
        }
        Insert: {
          arquivo_url: string
          cpf: string
          created_at?: string
          drive_url_original?: string | null
          id?: string
          nome_arquivo: string
          tipo_documento: string
        }
        Update: {
          arquivo_url?: string
          cpf?: string
          created_at?: string
          drive_url_original?: string | null
          id?: string
          nome_arquivo?: string
          tipo_documento?: string
        }
        Relationships: []
      }
      funcionario_jornada: {
        Row: {
          cpf: string
          created_at: string
          id: string
          jornada_id: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          cpf: string
          created_at?: string
          id?: string
          jornada_id: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          cpf?: string
          created_at?: string
          id?: string
          jornada_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_jornada_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas_trabalho"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas_trabalho: {
        Row: {
          ativo: boolean
          carga_diaria_min: number
          carga_semanal_min: number
          created_at: string
          dias_semana: Json
          entrada_padrao: string | null
          id: string
          intervalo_obrigatorio_min: number
          nome: string
          saida_padrao: string | null
          tipo: string
          tolerancia_min: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carga_diaria_min?: number
          carga_semanal_min?: number
          created_at?: string
          dias_semana?: Json
          entrada_padrao?: string | null
          id?: string
          intervalo_obrigatorio_min?: number
          nome: string
          saida_padrao?: string | null
          tipo?: string
          tolerancia_min?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carga_diaria_min?: number
          carga_semanal_min?: number
          created_at?: string
          dias_semana?: Json
          entrada_padrao?: string | null
          id?: string
          intervalo_obrigatorio_min?: number
          nome?: string
          saida_padrao?: string | null
          tipo?: string
          tolerancia_min?: number
          updated_at?: string
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
      registros_ponto: {
        Row: {
          cpf: string
          created_at: string
          data: string
          data_hora: string | null
          duracao: string | null
          endereco_aproximado: string | null
          entrada_1: string | null
          entrada_2: string | null
          entrada_3: string | null
          equipamento_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          marcacoes_brutas: Json | null
          motivo: string | null
          nsr: number | null
          ocorrencia: string | null
          precisao_metros: number | null
          saida_1: string | null
          saida_2: string | null
          saida_3: string | null
          tipo_marcacao: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          data: string
          data_hora?: string | null
          duracao?: string | null
          endereco_aproximado?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          equipamento_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          marcacoes_brutas?: Json | null
          motivo?: string | null
          nsr?: number | null
          ocorrencia?: string | null
          precisao_metros?: number | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          tipo_marcacao?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          data?: string
          data_hora?: string | null
          duracao?: string | null
          endereco_aproximado?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          equipamento_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          marcacoes_brutas?: Json | null
          motivo?: string | null
          nsr?: number | null
          ocorrencia?: string | null
          precisao_metros?: number | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          tipo_marcacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_ponto_equipamento_id_fkey"
            columns: ["equipamento_id"]
            isOneToOne: false
            referencedRelation: "equipamentos_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto_auditoria: {
        Row: {
          alterado_por: string | null
          campo: string
          cpf: string
          created_at: string
          data: string
          id: string
          motivo: string | null
          registro_id: string | null
          solicitacao_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          alterado_por?: string | null
          campo: string
          cpf: string
          created_at?: string
          data: string
          id?: string
          motivo?: string | null
          registro_id?: string | null
          solicitacao_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          alterado_por?: string | null
          campo?: string
          cpf?: string
          created_at?: string
          data?: string
          id?: string
          motivo?: string | null
          registro_id?: string | null
          solicitacao_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: []
      }
      solicitacoes_ponto: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          campo: string
          cpf: string
          created_at: string
          data: string
          data_fim: string | null
          id: string
          motivo: string
          observacao_admin: string | null
          rejeitado_em: string | null
          rejeitado_por: string | null
          status: string
          tipo: string
          valor: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          campo: string
          cpf: string
          created_at?: string
          data: string
          data_fim?: string | null
          id?: string
          motivo: string
          observacao_admin?: string | null
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          status?: string
          tipo: string
          valor: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          campo?: string
          cpf?: string
          created_at?: string
          data?: string
          data_fim?: string | null
          id?: string
          motivo?: string
          observacao_admin?: string | null
          rejeitado_em?: string | null
          rejeitado_por?: string | null
          status?: string
          tipo?: string
          valor?: string
        }
        Relationships: []
      }
      tarefa_atualizacoes: {
        Row: {
          conteudo: string | null
          cpf: string
          created_at: string
          id: string
          resolvida: boolean
          status_anterior: string | null
          status_novo: string | null
          tarefa_id: string
          tipo: string
        }
        Insert: {
          conteudo?: string | null
          cpf: string
          created_at?: string
          id?: string
          resolvida?: boolean
          status_anterior?: string | null
          status_novo?: string | null
          tarefa_id: string
          tipo?: string
        }
        Update: {
          conteudo?: string | null
          cpf?: string
          created_at?: string
          id?: string
          resolvida?: boolean
          status_anterior?: string | null
          status_novo?: string | null
          tarefa_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_atualizacoes_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_fotos: {
        Row: {
          created_at: string
          foto_url: string
          id: string
          tarefa_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          foto_url: string
          id?: string
          tarefa_id: string
          tipo?: string
        }
        Update: {
          created_at?: string
          foto_url?: string
          id?: string
          tarefa_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_fotos_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          concluido_em: string | null
          created_at: string
          criado_por: string | null
          data_prevista: string | null
          descricao: string | null
          id: string
          status: string
          tipo_destinatario: string
          titulo: string
          valor_destinatario: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          status?: string
          tipo_destinatario?: string
          titulo: string
          valor_destinatario: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          criado_por?: string | null
          data_prevista?: string | null
          descricao?: string | null
          id?: string
          status?: string
          tipo_destinatario?: string
          titulo?: string
          valor_destinatario?: string
        }
        Relationships: []
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
      vt_calendario: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao?: string | null
          id?: string
          tipo: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo?: string
        }
        Relationships: []
      }
      vt_cartoes: {
        Row: {
          ativo: boolean
          cpf: string
          created_at: string
          id: string
          linhas: string[]
          numero_cartao: string
          observacao: string | null
          titular_nome: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf: string
          created_at?: string
          id?: string
          linhas?: string[]
          numero_cartao: string
          observacao?: string | null
          titular_nome?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string
          created_at?: string
          id?: string
          linhas?: string[]
          numero_cartao?: string
          observacao?: string | null
          titular_nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vt_ferias: {
        Row: {
          cpf: string
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          observacao: string | null
        }
        Insert: {
          cpf: string
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          observacao?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          observacao?: string | null
        }
        Relationships: []
      }
      vt_inconsistencias: {
        Row: {
          cpf: string | null
          created_at: string
          data_hora: string
          decisao_em: string | null
          decisao_por: string | null
          detalhe: string | null
          id: string
          justificada_em: string | null
          justificativa: string | null
          linha: string | null
          numero_cartao: string
          observacao_admin: string | null
          regra: string
          status: string
          uso_id: string
          valor: number
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_hora: string
          decisao_em?: string | null
          decisao_por?: string | null
          detalhe?: string | null
          id?: string
          justificada_em?: string | null
          justificativa?: string | null
          linha?: string | null
          numero_cartao: string
          observacao_admin?: string | null
          regra: string
          status?: string
          uso_id: string
          valor?: number
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_hora?: string
          decisao_em?: string | null
          decisao_por?: string | null
          detalhe?: string | null
          id?: string
          justificada_em?: string | null
          justificativa?: string | null
          linha?: string | null
          numero_cartao?: string
          observacao_admin?: string | null
          regra?: string
          status?: string
          uso_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vt_inconsistencias_uso_id_fkey"
            columns: ["uso_id"]
            isOneToOne: true
            referencedRelation: "vt_usos"
            referencedColumns: ["id"]
          },
        ]
      }
      vt_usos: {
        Row: {
          cpf: string | null
          created_at: string
          data_hora: string
          id: string
          linha: string | null
          numero_cartao: string
          observacao: string | null
          operadora: string | null
          tipo_tarifa: string | null
          valor: number
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_hora: string
          id?: string
          linha?: string | null
          numero_cartao: string
          observacao?: string | null
          operadora?: string | null
          tipo_tarifa?: string | null
          valor?: number
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_hora?: string
          id?: string
          linha?: string | null
          numero_cartao?: string
          observacao?: string | null
          operadora?: string | null
          tipo_tarifa?: string | null
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _equipamento_enc_key: { Args: never; Returns: string }
      obter_senha_equipamento: { Args: { p_id: string }; Returns: string }
      salvar_equipamento_ponto: {
        Args: {
          p_ativo: boolean
          p_descricao: string
          p_host: string
          p_id: string
          p_modelo: string
          p_nome: string
          p_numero_serie: string
          p_porta: number
          p_senha: string
          p_tipo_conexao: string
          p_usuario: string
        }
        Returns: string
      }
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
