# Integração Chat Interno ↔ Google Chat (modo "bot único")

## Objetivo
Mensagens enviadas no chat interno do sistema aparecem em um space do Google Chat e mensagens enviadas naquele space voltam para a conversa correspondente no sistema. Tudo trafega sob a identidade de um único bot ("Sistema RH"), mas o nome real do remetente é mostrado no corpo da mensagem (ex.: `João Silva: bom dia`).

## Como vai funcionar (visão do usuário)

1. Admin abre uma conversa no chat interno (individual ou grupo) e clica em **"Conectar ao Google Chat"**.
2. O sistema mostra um campo para colar a **URL do space** ou da **webhook do Google Chat** que essa conversa deve espelhar.
3. A partir daí:
   - Toda mensagem nova no chat interno é replicada no space.
   - Toda mensagem nova no space é replicada no chat interno (aparece como "via Google Chat — Fulano").
4. Admin pode desconectar a qualquer momento na mesma tela.

## Escopo desta entrega

Incluído:
- Espelhamento de mensagens de texto (ambos os sentidos).
- Vínculo 1-para-1 entre uma conversa interna e um space do Google Chat.
- Tela admin para conectar/desconectar.
- Indicação visual no chat de que a conversa está espelhada.

Fora de escopo (pode virar próximas entregas):
- Espelhar imagens/arquivos anexados.
- Identidade real por usuário (exigiria OAuth por funcionário).
- Edição/exclusão sincronizada de mensagens.
- Reações, threads e formatação rica.

## Detalhes técnicos

### Pré-requisito manual (admin do Google Workspace)
Antes de usar, alguém com acesso ao Google Cloud Console precisa:
1. Criar um projeto no Google Cloud e habilitar a **Google Chat API**.
2. Criar uma **Chat App** com:
   - Conta de serviço (service account) para o sistema autenticar.
   - **Endpoint HTTP** apontando para nossa edge function `google-chat-webhook` (URL que vou gerar).
3. Adicionar o bot ao(s) space(s) que serão espelhados.
4. Salvar o JSON da service account como secret `GOOGLE_CHAT_SERVICE_ACCOUNT` (vou pedir via add_secret quando chegarmos nesse ponto).

Vou documentar esses passos em um README curto dentro do app.

### Banco (nova tabela)
```
chat_google_links
  id uuid pk
  conversa_id uuid  -> chat_conversas.id (unique)
  google_space_name text  (ex.: "spaces/AAAA...")
  criado_por text
  ativo boolean default true
  created_at timestamptz
```
RLS: só admin lê/grava.

### Edge functions (2 novas)

**`google-chat-send`** — disparada quando uma mensagem é inserida no chat interno.
- Trigger: chamada pelo frontend logo após `chat_mensagens.insert`, OU por um trigger no Postgres + `pg_net` (vou usar o caminho frontend, mais simples e já temos o ponto de envio em `ChatWindow.enviar`).
- Lê o link em `chat_google_links` pela `conversa_id`. Se não existir ou `ativo=false`, ignora.
- Autentica na Google Chat API com a service account (JWT → access token).
- `POST https://chat.googleapis.com/v1/{space}/messages` com texto `*Nome*: conteúdo`.

**`google-chat-webhook`** — recebe eventos do Google Chat (mensagens novas no space).
- Valida o token Bearer do Google (verificação do issuer/audience da Chat API).
- Para evento `MESSAGE`: descobre a `conversa_id` pelo `space.name` em `chat_google_links`.
- Insere em `chat_mensagens` com `remetente_cpf = 'google-chat'` e conteúdo `*NomeRemetenteGoogle* (Google Chat): texto`.
- Cria `chat_mensagem_status` para os demais membros (mesmo padrão do envio normal).
- Marca `verify_jwt = false` em `supabase/config.toml` para essa função (Google chama sem JWT do Supabase).

### Frontend
- Em `src/components/chat/ChatWindow.tsx`, no header da conversa (só para admin):
  - Botão **"Google Chat"** que abre dialog.
  - Dialog mostra estado atual (conectado/desconectado), campo para colar `space name` (ex.: `spaces/AAAA...`), botões Conectar/Desconectar.
  - Quando conectado, mostra um badge discreto "Espelhado no Google Chat" abaixo do nome da conversa.
- Em `enviar()` e `enviarArquivo()`: após inserir a mensagem com sucesso, se a conversa tem link ativo, chama `supabase.functions.invoke('google-chat-send', { body: { mensagem_id } })` em fire-and-forget (não bloqueia a UI; erro vai só pro console + toast leve).
- Mensagens que vierem do Google Chat aparecem com avatar diferente (ícone Google) e nome `Google Chat`.

### Tratamento de loop
A edge function `google-chat-send` só envia se `remetente_cpf != 'google-chat'`. Isso impede que mensagens recebidas do Google sejam reenviadas de volta.

## Próximos passos depois da aprovação
1. Criar migração da tabela `chat_google_links`.
2. Criar as 2 edge functions e configurar `verify_jwt = false` para a webhook.
3. Pedir o secret `GOOGLE_CHAT_SERVICE_ACCOUNT`.
4. Construir o dialog e o gancho de envio no `ChatWindow`.
5. Adicionar README curto explicando o setup no Google Cloud Console.

Aprove para implementar, ou me diga se quer ajustar algo (ex.: começar só pelo envio one-way para validar antes do bidirecional).