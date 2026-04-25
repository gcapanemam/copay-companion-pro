
# Inconsistências de Vale-Transporte

## Visão geral

Após cada importação de PDF de uso, o sistema avalia cada passagem em ordem (a primeira regra que falhar marca o uso como inconsistente; as demais não são testadas):

1. **Dia não útil** — fim de semana, feriado, recesso ou férias do funcionário, exceto se a data estiver marcada como sábado letivo.
2. **Fora do horário de trabalho** — uso antes de (entrada − 1h) ou depois de (saída + 1h) da jornada vigente.
3. **Mesma linha em curto intervalo** — mesma linha usada com menos de 1h de diferença.
4. **Linha não cadastrada** — linha do uso não está na lista de linhas do cartão.

Casos especiais:
- Sem jornada vigente → marca **"Cadastro incompleto: jornada"** (regras 2 não roda).
- Cartão sem linhas cadastradas → marca **"Cadastro incompleto: linhas"** (regra 4 não roda).

Funcionário vê suas inconsistências no portal e envia uma **justificativa**. Admin aprova ou rejeita com observação opcional.

## Novas seções de UI

### Admin → aba "Calendário" (nova, dentro de Vale-Transporte ou ao lado)
- **Feriados / Recessos**: lista (data, descrição, tipo: feriado | recesso | sábado letivo) com adicionar/excluir.
- **Férias por funcionário**: seleciona funcionário, define período `início → fim`.

### Admin → Vale-Transporte → nova aba "Inconsistências"
- Filtros: período (mês/ano), funcionário, status (pendente / justificada / aprovada / rejeitada), tipo de regra.
- Tabela: data/hora, funcionário, linha, valor, **regra violada**, justificativa do funcionário, ação (aprovar/rejeitar com observação).
- Badges coloridos por regra.

### Portal funcionário → aba "Inconsistências do VT"
- Lista apenas as do próprio CPF.
- Para cada item pendente: campo de texto + botão "Enviar justificativa".
- Mostra status (pendente, em análise, aprovada, rejeitada) e a observação do admin quando houver.

## Fluxo de cálculo (automático ao importar PDF)

1. Após `vt_usos.upsert` no `handleConfirmImportPdf`, dispara `analisarInconsistenciasUsos(usos)`.
2. Para cada uso novo, aplica as 4 regras em ordem; ao primeiro hit, grava em `vt_inconsistencias` com `regra` e `detalhe`. 
3. Botão "Reanalisar período" no admin para reprocessar usos antigos (limpa e recalcula inconsistências do período).

## Detalhes técnicos

### Banco

```sql
-- Calendário (feriados, recessos e sábados letivos)
CREATE TABLE public.vt_calendario (
  id uuid PK default gen_random_uuid(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('feriado','recesso','sabado_letivo')),
  descricao text,
  created_at timestamptz default now(),
  UNIQUE(data, tipo)
);

-- Férias individuais
CREATE TABLE public.vt_ferias (
  id uuid PK,
  cpf text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacao text,
  created_at timestamptz default now()
);

-- Inconsistências detectadas
CREATE TABLE public.vt_inconsistencias (
  id uuid PK,
  uso_id uuid NOT NULL REFERENCES public.vt_usos(id) ON DELETE CASCADE,
  cpf text,
  numero_cartao text NOT NULL,
  data_hora timestamptz NOT NULL,
  linha text,
  valor numeric NOT NULL,
  regra text NOT NULL,        -- 'dia_nao_util' | 'fora_horario' | 'linha_repetida_curto_intervalo' | 'linha_nao_cadastrada' | 'cadastro_incompleto_jornada' | 'cadastro_incompleto_linhas'
  detalhe text,                -- ex.: "Domingo", "Saída padrão 17:00 → uso 19:30", "Linha 6062 usada às 08:10 e 08:45"
  justificativa text,
  justificada_em timestamptz,
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'justificada' | 'aprovada' | 'rejeitada'
  decisao_por text,
  decisao_em timestamptz,
  observacao_admin text,
  created_at timestamptz default now(),
  UNIQUE(uso_id)
);
```

RLS: `anon` SELECT/UPDATE (justificativa) em `vt_inconsistencias` e SELECT em calendário/férias; `authenticated` ALL em todas. Padrão consistente com o resto do projeto.

### Lógica (novo arquivo `src/lib/analisarVtInconsistencias.ts`)

Função pura que recebe:
- usos novos (`vt_usos`)
- jornadas vigentes por CPF (busca de `funcionario_jornada` + `jornadas_trabalho`)
- linhas por cartão (`vt_cartoes.linhas`)
- calendário e férias

Retorna a lista de inconsistências para inserir em batch. Aplica as regras em ordem; para a regra 3 ordena os usos do mesmo cartão+linha por timestamp e compara com o anterior.

### UI

- `src/components/admin/AdminVtCalendario.tsx` — nova tela (feriados + férias).
- `src/components/admin/AdminVtInconsistencias.tsx` — tabela com aprovação.
- `src/components/portal/PortalVtInconsistencias.tsx` — lista + justificativa do funcionário.
- Em `AdminValeTransporte.tsx`: adicionar abas "Inconsistências" e "Calendário"; chamar análise dentro de `handleConfirmImportPdf` após inserir.
- Em `MinhaArea.tsx` (portal): adicionar aba "Inconsistências VT" usando o novo componente.

## Pronto para implementar?
Após aprovação eu crio a migration, a função de análise, as 3 telas novas e a integração com o fluxo de importação.
