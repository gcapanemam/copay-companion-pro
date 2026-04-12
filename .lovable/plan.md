

## Plano: Melhoria de Desempenho

### Problemas identificados

1. **ChatSidebar — N+1 queries**: `loadConversas` faz um loop com 4-5 queries individuais POR conversa (membros, nome, última mensagem, não lidas). Com 10 conversas = ~50 queries.

2. **ChatWindow — marcação de leitura sequencial**: `loadMensagens` faz `upsert` individual para CADA mensagem não lida ao abrir a conversa, em vez de batch.

3. **useUnreadCounts — sem debounce**: Cada evento realtime dispara imediatamente `fetchCounts`, que faz ~6 queries. Múltiplos eventos simultâneos = rajada de queries.

4. **Realtime sem filtro**: ChatSidebar escuta TODAS as mensagens e status globalmente (sem filtro de conversa). Qualquer mensagem de qualquer usuário recarrega tudo.

5. **Tabs sem lazy loading**: Todos os componentes das abas renderizam simultaneamente, mesmo os não visíveis. Cada um pode disparar queries ao montar.

### Correções

**1. ChatSidebar — Batch queries**
- Buscar TODOS os membros de todas as conversas em 1 query
- Buscar TODOS os nomes de uma vez com `in("cpf", allCpfs)`
- Buscar últimas mensagens de todas as conversas em 1 query
- Buscar status de leitura em batch
- Resultado: ~5 queries em vez de ~50

**2. ChatWindow — Batch upsert de leitura**
- Substituir o loop `for...of` por um único `upsert` com array de todas as mensagens não lidas

**3. useUnreadCounts — Debounce**
- Adicionar debounce de 500ms no `fetchCounts` para agrupar múltiplos eventos realtime
- Evitar re-fetch se cpf está vazio

**4. Realtime com filtros**
- ChatSidebar: filtrar por `conversa_id` nas conversas do usuário
- ChatWindow: já tem filtro por conversa, mas o listener de `chat_mensagem_status` é global — filtrar pelos `msgIds` relevantes

**5. Lazy loading das Tabs (forceMount=false)**
- As `TabsContent` do Radix por padrão já desmontam conteúdo inativo. Verificar que `forceMount` não está sendo usado. Adicionar verificação para que componentes pesados (ChatContainer, AdminTarefas, AdminComunicados) só carreguem dados quando a aba estiver ativa.

### Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/chat/ChatSidebar.tsx` | Refatorar `loadConversas` para batch queries |
| `src/components/chat/ChatWindow.tsx` | Batch upsert de leitura, filtrar realtime de status |
| `src/hooks/useUnreadCounts.ts` | Adicionar debounce de 500ms |
| `src/pages/Index.tsx` | Nenhuma mudança estrutural necessária (tabs já desmontam) |
| `src/pages/MinhaArea.tsx` | Nenhuma mudança estrutural necessária |

### Impacto esperado
- Redução de ~80% no número de queries do chat
- Eliminação de rajadas de queries por eventos realtime
- Interface mais responsiva ao trocar entre abas e conversas

