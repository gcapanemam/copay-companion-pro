

## Chat Interno (estilo WhatsApp) — Plano

### Funcionalidades
- Conversas individuais (1:1) entre funcionários
- Grupos de conversa (criar, adicionar/remover membros)
- Status de mensagem: ✓ enviado, ✓✓ recebido, ✓✓ azul = lido
- Lista de conversas com última mensagem e contagem de não lidas
- Atualização em tempo real via Realtime
- Disponível tanto no painel admin quanto no portal do funcionário

### Tabelas (migration)

```sql
-- Conversas (individuais e grupos)
chat_conversas (
  id uuid PK,
  tipo text NOT NULL DEFAULT 'individual', -- 'individual' | 'grupo'
  nome text, -- nome do grupo (null para individual)
  criado_por text, -- cpf de quem criou
  created_at timestamptz
)

-- Membros de cada conversa
chat_membros (
  id uuid PK,
  conversa_id uuid FK -> chat_conversas,
  cpf text NOT NULL,
  created_at timestamptz
)

-- Mensagens
chat_mensagens (
  id uuid PK,
  conversa_id uuid FK -> chat_conversas,
  remetente_cpf text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamptz
)

-- Status de leitura por destinatário
chat_mensagem_status (
  id uuid PK,
  mensagem_id uuid FK -> chat_mensagens,
  cpf text NOT NULL, -- destinatário
  recebido_em timestamptz,
  lido_em timestamptz
)
```

- Habilitar Realtime em `chat_mensagens` e `chat_mensagem_status`
- RLS: anon SELECT/INSERT/UPDATE (padrão do projeto, autenticação via CPF na edge function)

### Componentes

1. **`src/components/chat/ChatSidebar.tsx`** — lista de conversas, busca, botão nova conversa/grupo
2. **`src/components/chat/ChatWindow.tsx`** — área de mensagens com scroll, input de texto, indicadores de status (✓/✓✓/✓✓ azul)
3. **`src/components/chat/ChatNovaConversa.tsx`** — dialog para iniciar conversa individual ou criar grupo (selecionar funcionários)
4. **`src/components/chat/ChatStatusIcon.tsx`** — componente que renderiza os checks conforme status

### Indicadores de status
- **✓** (cinza) — mensagem salva no banco (enviada)
- **✓✓** (cinza) — todos os destinatários têm `recebido_em` preenchido
- **✓✓** (azul) — todos os destinatários têm `lido_em` preenchido

### Integração

- **Portal do Funcionário (`MinhaArea.tsx`)**: nova aba "Chat" com ícone MessageCircle
- **Edge function `login-beneficiario`**: retornar lista de conversas do usuário no login
- **Realtime**: subscribe em `chat_mensagens` e `chat_mensagem_status` para atualizações instantâneas
- Ao abrir uma conversa, marcar mensagens como recebidas/lidas automaticamente

### Arquivos a criar/editar
- **Criar**: migration SQL, `ChatSidebar.tsx`, `ChatWindow.tsx`, `ChatNovaConversa.tsx`, `ChatStatusIcon.tsx`
- **Editar**: `MinhaArea.tsx` (nova aba), `login-beneficiario/index.ts` (carregar conversas), `Index.tsx` (aba chat no admin, opcional)

