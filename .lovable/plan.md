# Substituir chat interno pelo Google Chat (API, por usuário)

## O que o usuário vai ver

1. Ao abrir o módulo **Chat**, se o funcionário ainda não autorizou o Google, aparece tela "Conectar minha conta Google" → faz OAuth → volta para o chat.
2. A barra lateral mostra os **spaces do Google Chat** dele (DMs e grupos) puxados da API.
3. Ao abrir um space, mostra as mensagens reais do Google Chat. Pode enviar texto; a mensagem aparece no Google Chat com o nome/foto real do funcionário (porque foi a conta dele que assinou).
4. Atualização automática a cada poucos segundos (polling). Não há "entregue/lido" — esses indicadores somem.
5. Histórico antigo do chat interno é descartado.

## Pontos importantes que mudam (precisa estar ciente antes de aprovar)

- **Login com Google passa a ser obrigatório no módulo Chat.** Hoje o login é por CPF. Vou adicionar Login com Google e vincular o email Google ao CPF do funcionário (campo `email` já existe em `admissoes`). Quem não logar com Google não usa o chat.
- **Sem "entregue/lido" e sem realtime nativo.** A API do Google Chat não expõe status de leitura nem websocket. Usaremos polling (ex.: 5 s) na conversa aberta. Indicadores de check duplo somem.
- **Anexos, exclusão por admin, grupos criados internamente: deixam de existir** no formato atual. Quem cria grupo é o Google Chat (space). Anexos passam a usar o sistema do próprio Google Chat (envio de arquivo via Drive — pode ficar como melhoria futura; entrega inicial é só texto).
- **Pré-requisito manual no Google Cloud (uma vez, por TI):**
  1. Criar projeto no Google Cloud, habilitar **Google Chat API** e **People API**.
  2. Configurar **OAuth consent screen** interno (Workspace), escopos: `chat.messages`, `chat.spaces.readonly`, `userinfo.email`, `userinfo.profile`.
  3. Criar **OAuth Client ID** (Web), com redirect URI da nossa edge function `google-oauth-callback` (vou gerar a URL).
  4. Guardar `client_id` e `client_secret` como secrets `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` (vou pedir via add_secret na hora certa).

## Detalhes técnicos

### Banco
- **Apagar** (ou ignorar) `chat_conversas`, `chat_membros`, `chat_mensagens`, `chat_mensagem_status`, `chat_google_links` — não serão mais usadas.
- **Nova tabela** `google_chat_tokens`:
  ```
  cpf text pk
  google_email text
  refresh_token text         -- criptografado via pgp_sym_encrypt (mesmo padrão de equipamentos_ponto)
  scopes text
  conectado_em timestamptz
  ```
  RLS: só o próprio CPF lê (via política baseada no CPF da sessão atual).

### Edge functions (todas verificam o CPF do usuário logado)
1. **`google-oauth-start`** — gera URL de autorização Google com `state` assinado contendo o CPF.
2. **`google-oauth-callback`** — recebe `code`, troca por `access_token` + `refresh_token`, valida domínio Workspace, guarda em `google_chat_tokens`, redireciona para `/chat`.
3. **`google-chat-proxy`** — proxy autenticado para a Chat API. Recebe `{ op: 'listSpaces' | 'listMessages' | 'sendMessage', ...args }`, busca o refresh_token do CPF, obtém access_token fresco, chama `chat.googleapis.com` e devolve a resposta. Centraliza refresh de token e evita expor secrets ao frontend.

### Frontend
- Reescrita do módulo Chat:
  - `src/components/chat/ChatContainer.tsx`: checa se o CPF tem token Google. Se não, mostra botão "Conectar Google".
  - `ChatSidebar.tsx`: lista spaces via `google-chat-proxy listSpaces`.
  - `ChatWindow.tsx`: lista mensagens via `listMessages` (polling 5 s), envia via `sendMessage`. Remove status entregue/lido, remove modo selecionar/excluir, remove anexos por enquanto.
  - Remover `ChatNovaConversa.tsx` (criação de conversa passa a ser feita no próprio Google Chat).
- Indicador no header: "Conectado como joao@empresa.com — Desconectar".

### Não incluso nesta entrega (pode virar próximas)
- Anexos (upload via Drive + cartão de mensagem).
- Notificações desktop / contagem de não lidas em tempo real (exigiria Workspace Events API + Pub/Sub).
- Criar space novo a partir do nosso sistema.
- Edição/exclusão de mensagens.

## Ordem de execução depois da aprovação
1. Pedir os secrets `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` (após TI fazer o setup no Google Cloud).
2. Migração: criar `google_chat_tokens` e dropar tabelas do chat antigo.
3. Criar as 3 edge functions.
4. Reescrever os componentes do chat.
5. Remover o plano antigo de espelhamento (`chat_google_links` e companhia).

Aprove para implementar, ou me diga o que ajustar (ex.: manter as tabelas antigas como arquivo em vez de apagar, ou começar só pelo OAuth + listagem de spaces e deixar envio para depois).
