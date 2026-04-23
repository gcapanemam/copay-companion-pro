

# Plano: Sistema de Ponto Eletrônico Completo (CLT)

## Estado atual (o que já existe)

- ✅ Tabela `registros_ponto` com 3 pares entrada/saída por dia
- ✅ Tabela `solicitacoes_ponto` (ajustes + atestados) com status pendente/aprovado/rejeitado
- ✅ Tabela `equipamentos_ponto` + integração REP Control iD (sync AFD/NSR)
- ✅ Portal do funcionário: solicitar ajuste manual, enviar atestado (abono dia/horas/comprovante) com upload
- ✅ Painel admin: aprovar/rejeitar, aplicar mudanças nos registros, log embutido em `motivo`
- ❌ Sem cadastro de jornada (carga horária esperada por funcionário)
- ❌ Sem cálculo formal de horas extras / atrasos / banco de horas
- ❌ Sem dashboard de indicadores no Portal
- ❌ Sem exportação (PDF espelho de ponto / Excel)
- ❌ Sem geolocalização nas batidas manuais
- ❌ Sem notificações de "esqueceu de bater ponto"

---

## O que será construído

### 1. Schema (migrations)

**`jornadas_trabalho`** — tipos de jornada cadastráveis:
- `id`, `nome`, `tipo` (`fixa` | `flexivel` | `escala_12x36` | `escala_6x1`), `carga_diaria_min`, `carga_semanal_min`, `intervalo_obrigatorio_min` (default 60), `tolerancia_min` (default 10), `dias_semana` (jsonb dias úteis), `entrada_padrao`, `saida_padrao`, `ativo`

**`funcionario_jornada`** — vincula CPF a uma jornada com vigência:
- `cpf`, `jornada_id`, `vigencia_inicio`, `vigencia_fim`, `created_at`

**`config_horas_extras`** (singleton):
- `adicional_50_pct`, `adicional_100_pct` (domingos/feriados), `tolerancia_min`, `permite_banco_horas` (bool), `expiracao_banco_meses` (default 6)

**`banco_horas_movimentos`** — auditoria do banco:
- `id`, `cpf`, `data_referencia`, `minutos` (positivo = crédito, negativo = débito), `origem` (`extra` | `falta` | `compensacao` | `expiracao`), `descricao`, `registro_ponto_id`, `expira_em`, `created_at`

**`registros_ponto_auditoria`** — log imutável de alterações:
- `id`, `registro_id`, `cpf`, `data`, `campo`, `valor_anterior`, `valor_novo`, `alterado_por`, `motivo`, `solicitacao_id`, `created_at`

**`registros_ponto`** — adicionar colunas:
- `latitude`, `longitude`, `precisao_metros`, `endereco_aproximado` (geo opcional na batida manual)

**`solicitacoes_ponto`** — adicionar coluna:
- `data_fim` (para atestados multi-dia em uma única solicitação)

RLS: anon select/insert para próprio CPF; authenticated full em todas. `registros_ponto_auditoria` somente INSERT (imutável) + SELECT.

Trigger: ao UPDATE em `registros_ponto`, gravar diff em `registros_ponto_auditoria` automaticamente.

---

### 2. Lógica de cálculo (helper compartilhado `src/lib/pontoCalculos.ts`)

Funções puras com testes:
- `calcularJornadaDia(registro, jornada)` → `{ trabalhadas_min, esperadas_min, extras_min, atraso_min, saida_antecipada_min, intervalo_min, irregularidades[] }`
- `calcularBancoHoras(movimentos[], dataRef)` → `{ saldo_min, credito_min, debito_min, prestes_a_expirar_min }`
- `aplicarTolerancia(diferenca, tolerancia)` → diferença efetiva
- `detectarInconsistencias(registro, jornada)` → lista de strings (`"Falta saída_1"`, `"Intervalo abaixo do mínimo"`, etc.)

Regras CLT respeitadas: tolerância diária máx 10min, intervalo mínimo 1h para jornadas > 6h, adicional 50% dia útil / 100% domingo+feriado.

---

### 3. Admin — `AdminPontoEletronico.tsx` (novas abas)

Adicionar abas a UI já existente:
- **Jornadas** — CRUD de tipos de jornada e vinculação CPF↔jornada com vigência
- **Configurações** — formulário do `config_horas_extras`
- **Banco de Horas** — visualização por funcionário (saldo, histórico, movimentos prestes a expirar), botão para lançar compensação manual
- **Auditoria** — listagem read-only de `registros_ponto_auditoria` com filtros por CPF/data
- **Dashboard** (nova primeira aba) — cards com totais do mês: nº funcionários com inconsistências, total horas extras, faltas, solicitações pendentes; tabela top 10 saldos negativos e top 10 banco positivo

Aba existente "Espelho" passa a mostrar colunas calculadas: Esperado / Trabalhado / Extras / Saldo dia, com cores (verde/vermelho/amarelo).

---

### 4. Portal funcionário — `PortalPonto` em `MinhaArea.tsx`

- **Cabeçalho dashboard**: 4 cards (Horas trabalhadas mês, Horas esperadas mês, Saldo banco de horas, Solicitações pendentes)
- **Tabela espelho** ganha colunas: Esperado / Trabalhado / Saldo dia / Status (badge verde/amarelo/vermelho)
- **Banco de horas**: nova seção com saldo total + lista de últimos 30 movimentos
- **Geolocalização opcional** no diálogo de ajuste manual: checkbox "Anexar minha localização" → captura `navigator.geolocation` e envia em `solicitacoes_ponto.motivo` (campo extra serializado, igual ao `__PONTO_ANEXO__` já usado)
- **Notificações in-app** (badge): card de alerta quando dia anterior não tem batidas completas

---

### 5. Aprovação com auditoria (Admin)

Ao aprovar/rejeitar:
- Inserir registro em `registros_ponto_auditoria` com `solicitacao_id`, valor anterior, valor novo, admin atual, motivo da solicitação
- Para rejeição: tornar campo `observacao_admin` (já existe) **obrigatório** no diálogo
- Após aprovar atestado/ajuste, recalcular jornada do dia e gravar movimento em `banco_horas_movimentos` se gerar saldo

---

### 6. Relatórios e exportação

Nova aba **Relatórios** em Admin:
- **Espelho de ponto PDF** (jsPDF + autoTable): cabeçalho com nome/CPF/cargo/unidade, tabela diária do mês, totalizadores, assinaturas
- **Excel (xlsx)** via SheetJS: planilha por funcionário ou consolidada
- Filtros: período, unidade, departamento, funcionário
- No Portal, botão "Exportar meu espelho" gera o PDF do funcionário logado

---

### 7. Correção dos build errors atuais (bloqueio imediato)

- `AdminPontoEletronico.tsx:857,860` — tipar `payload` como `Database["public"]["Tables"]["registros_ponto"]["Insert"]` em vez de `Record<string, unknown>`
- `vite.config.ts:23-24` — tipar parâmetros: `(server: ViteDevServer)` e `(req: IncomingMessage, res: ServerResponse, next)`
- 3 edge functions (`login-beneficiario`, `parse-pdf`, `send-2fa-email`) — trocar `error.message` por `error instanceof Error ? error.message : String(error)` no catch

---

## Ordem de implementação (após aprovação)

1. **Hotfix** dos build errors (bloqueia tudo)
2. Migrations (jornadas, config, banco horas, auditoria, geo, trigger)
3. `src/lib/pontoCalculos.ts` + testes
4. Admin: abas Jornadas, Configurações, Auditoria
5. Recalcular jornada/banco no fluxo de aprovação existente
6. Portal: dashboard + colunas calculadas + banco de horas + geolocalização
7. Admin: aba Banco de Horas + Dashboard
8. Relatórios PDF/Excel + botão de exportação Portal
9. Notificações in-app de batida ausente

## Detalhes técnicos resumidos

- Stack: React + Tailwind + shadcn (já em uso), TanStack Query, Supabase
- Edge functions: nenhuma nova necessária (cálculo no cliente; auditoria via trigger no DB)
- Bibliotecas a instalar: `jspdf`, `jspdf-autotable`, `xlsx`
- Sem mudança em `client.ts`/`types.ts` (regenerados auto pelas migrations)
- Backward-compatible: registros antigos sem jornada vinculada caem em jornada 8h padrão

