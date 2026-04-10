

## Sistema de Tarefas — Plano

### Funcionalidades

**Admin:**
- Criar tarefas com: título, descrição, fotos anexas, data prevista de conclusão
- Destinar para: funcionário específico (CPF), departamento ou unidade
- Visualizar todas as tarefas com filtros de status (pendente, em andamento, concluída)
- Ver atualizações/pendências reportadas pelos funcionários

**Funcionário (Portal):**
- Ver tarefas atribuídas a si (diretamente ou por departamento/unidade)
- Atualizar status: pendente → em andamento → concluída
- Registrar pendências com texto
- Enviar foto de conclusão
- Data/hora de conclusão registrada automaticamente

### Tabelas (migration)

```sql
-- Tarefas
tarefas (
  id uuid PK DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo_destinatario text NOT NULL DEFAULT 'funcionario', -- 'funcionario' | 'departamento' | 'unidade'
  valor_destinatario text NOT NULL, -- CPF, nome do depto ou unidade
  data_prevista date,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'em_andamento' | 'concluida'
  criado_por text, -- CPF ou 'admin'
  concluido_em timestamptz,
  created_at timestamptz DEFAULT now()
)

-- Fotos das tarefas (criação e conclusão)
tarefa_fotos (
  id uuid PK DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL,
  foto_url text NOT NULL,
  tipo text NOT NULL DEFAULT 'descricao', -- 'descricao' | 'conclusao'
  created_at timestamptz DEFAULT now()
)

-- Atualizações/pendências
tarefa_atualizacoes (
  id uuid PK DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL,
  cpf text NOT NULL,
  tipo text NOT NULL DEFAULT 'pendencia', -- 'pendencia' | 'status' | 'comentario'
  conteudo text,
  status_anterior text,
  status_novo text,
  created_at timestamptz DEFAULT now()
)
```

- Storage bucket `tarefas-fotos` (público) para upload de imagens
- RLS: anon SELECT/INSERT/UPDATE, authenticated ALL (padrão do projeto)

### Componentes

1. **`AdminTarefas.tsx`** — CRUD de tarefas pelo admin: form com título, descrição, upload de fotos, seletor de destinatário (funcionário/departamento/unidade), data prevista. Tabela com filtro de status e timeline de atualizações.

2. **`PortalTarefas.tsx`** — Funcionário vê suas tarefas, pode mudar status, registrar pendências, e enviar foto de conclusão.

### Integração

- **`Index.tsx`**: nova aba "Tarefas" (ícone `ListTodo`) no grid de 10 colunas
- **`MinhaArea.tsx`**: nova aba "Tarefas" no portal do funcionário (grid de 9 colunas)
- **Edge function `login-beneficiario`**: retornar tarefas do funcionário (filtro por CPF, departamento e unidade)

### Arquivos a criar/editar
- **Criar**: migration SQL, `AdminTarefas.tsx`, `PortalTarefas.tsx`
- **Editar**: `Index.tsx` (nova aba admin), `MinhaArea.tsx` (nova aba portal), `login-beneficiario/index.ts` (carregar tarefas)

