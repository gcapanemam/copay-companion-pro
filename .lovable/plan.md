

## Plano: Tornar credenciais de conexão configuráveis por equipamento

### Contexto
Hoje, o sistema usa secrets globais (`IDCLOUD_MYSQL_*`) para conectar ao iDCloud. Mas como mostra a imagem do iDSecure, **cada relógio tem suas próprias informações de conexão** (Host/IP, Porta, Usuário, Senha). Vou tornar isso configurável por equipamento.

### Mudanças

**1. Migração de banco — adicionar colunas em `equipamentos_ponto`**
- `host` TEXT (ex: `192.168.0.23` ou host do iDCloud)
- `porta` INTEGER (ex: 443 ou 3306)
- `usuario` TEXT (ex: `admin`)
- `senha` TEXT (criptografada com pgcrypto via `pgp_sym_encrypt`)
- `tipo_conexao` TEXT — enum textual: `idcloud_mysql` (banco do iDCloud) ou `rep_local` (REST API do relógio na rede local)
- `versao_firmware` TEXT (campo informativo, ex: `0418`)

A senha será armazenada criptografada usando uma chave master em secret (`EQUIPAMENTO_ENCRYPTION_KEY`). A edge function descriptografa no momento da sincronização.

**2. Formulário `EquipamentoFormDialog.tsx` — adicionar campos**
Layout em duas colunas seguindo o padrão da imagem do iDSecure:
- **Aba/seção "Informações Gerais"**: Nome, Modelo (select com REP iDClass, REP iDFace, etc.), Número de Série, Descrição, Ativo
- **Aba/seção "Conexão"**: Tipo de Conexão (radio: iDCloud MySQL / REP Local), Host/IP, Porta, Usuário, Senha (input password com toggle mostrar/ocultar)
- Versão do firmware e última comunicação aparecem em modo read-only (vindos do banco)

**3. Edge function `sync-controlid` — refatorar**
- Em vez de ler secrets globais, lê `host/porta/usuario/senha` do registro do equipamento
- Descriptografa a senha
- Suporta dois modos:
  - `idcloud_mysql`: conexão MySQL (comportamento atual)
  - `rep_local`: chamada REST ao relógio (`POST /session_login.fcgi` + `POST /get_afd.fcgi`) — usado quando o relógio está acessível na rede local/VPN
- Mantém credenciais por equipamento, permitindo múltiplos relógios independentes

**4. Secret necessário (apenas 1)**
- `EQUIPAMENTO_ENCRYPTION_KEY` — chave para criptografar/descriptografar senhas no banco

Os 5 secrets antigos (`IDCLOUD_MYSQL_*`) deixam de ser usados.

### Detalhes técnicos
- **Criptografia**: `pgp_sym_encrypt(senha, 'chave')` na inserção via função RPC `salvar_equipamento_com_senha` (para não expor a chave no client). Leitura só na edge function via `pgp_sym_decrypt`.
- **Migração de senha**: como o usuário ainda não cadastrou nenhum equipamento real, não há dados a migrar.
- **Validação**: porta entre 1-65535, host obrigatório quando `tipo_conexao` for definido.

### Arquivos
- `supabase/migrations/` (novas colunas + função RPC para salvar com senha criptografada)
- `src/components/admin/EquipamentoFormDialog.tsx` (novos campos + RPC ao salvar)
- `supabase/functions/sync-controlid/index.ts` (refatorar para ler credenciais do banco + suportar REST local)

### Pré-requisito
Adicionar 1 secret: `EQUIPAMENTO_ENCRYPTION_KEY` (vou pedir após aprovação do plano)

