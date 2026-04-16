

## Plano: Integração com relógio Control iD via iDCloud

### Contexto da imagem
O equipamento mostrado é um **REP iDClass (REP-C)**, série `00014003750021988`, com **iDCloud habilitado** e comunicação ativa nas últimas 24h. Isso confirma que o caminho viável é **via iDCloud** (não comunicação direta com IP local `192.168.000.023`, que é endereço de rede interna do cliente).

### Arquitetura proposta

```text
[Relógio REP-C] → push → [iDCloud MySQL] ← pull ← [Edge Function] → [registros_ponto]
```

### O que será construído

**1. Migração de banco**
- Tabela `equipamentos_ponto`: cadastro dos relógios (nome, modelo, número de série, NSR, última sincronização)
- Tabela `registros_ponto`: marcações importadas (cpf, data_hora, nsr, equipamento_id, tipo)
- Tabela `idcloud_config`: credenciais MySQL do iDCloud (host, porta, user, password, database) — criptografadas via secrets
- RLS: apenas admins acessam

**2. Edge function `sync-controlid`**
- Conecta no MySQL do iDCloud usando driver Deno (`https://deno.land/x/mysql`)
- Lê tabela `afd` filtrando por NSR > último importado
- Faz match por CPF com `admissoes` e insere em `registros_ponto`
- Atualiza `equipamentos_ponto.ultimo_nsr` e `ultima_sincronizacao`
- Retorna relatório (novos registros, erros, CPFs não encontrados)

**3. UI no Admin**
- Nova aba "Ponto Eletrônico" no `AdminDashboard`
- Lista de equipamentos cadastrados com status (online/offline baseado em última comunicação)
- Botão "Sincronizar Agora" por equipamento + botão "Sincronizar Todos"
- Tabela de últimas marcações com filtros (funcionário, data, equipamento)
- Formulário de cadastro do relógio + configuração iDCloud (credenciais MySQL)

**4. UI no Portal do Funcionário**
- Nova seção "Meu Ponto" mostrando últimas marcações do funcionário logado

### Pré-requisitos do usuário
Antes de implementar, preciso que você tenha em mãos:
1. **Credenciais MySQL do iDCloud** (host, porta, usuário, senha, nome do banco) — fornecidas pelo time comercial da Control iD
2. **Liberação de IP** no firewall do iDCloud (precisaremos do IP de saída do Supabase, posso fornecer depois do deploy)

### Secrets necessários
- `IDCLOUD_MYSQL_HOST`
- `IDCLOUD_MYSQL_PORT`
- `IDCLOUD_MYSQL_USER`
- `IDCLOUD_MYSQL_PASSWORD`
- `IDCLOUD_MYSQL_DATABASE`

### Detalhes técnicos
- Driver MySQL: `https://deno.land/x/mysql@v2.12.1/mod.ts`
- Sincronização incremental por NSR (Número Sequencial do Registro) para não duplicar
- Cron job opcional (pg_cron) para sincronizar automaticamente a cada 15min
- Se cliente usa múltiplos relógios, todos vão pra mesma instância iDCloud — basta uma conexão MySQL para puxar tudo

### Arquivos
- `supabase/migrations/` (novas tabelas)
- `supabase/functions/sync-controlid/index.ts` (novo)
- `src/components/admin/AdminPontoEletronico.tsx` (novo)
- `src/components/admin/EquipamentoFormDialog.tsx` (novo)
- `src/components/portal/PortalMeuPonto.tsx` (novo)
- `src/components/admin/AdminDashboard.tsx` (adicionar aba)
- `src/pages/MinhaArea.tsx` (adicionar aba)

