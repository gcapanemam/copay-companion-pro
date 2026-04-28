## Problema

Você está correto: o AFD contém mais marcações do que aparecem no sistema. Após inspeção do código de importação (`AdminPontoEletronico.tsx`, função `confirmManualImport` e `groupMarksIntoDailyRecords`), encontrei **4 causas reais de perda de dados**:

### 1. Limite de 500 registros na listagem (apenas exibição)
Na query de exibição (linha 563): `.limit(500)`. Mesmo que o AFD importe 5.000 dias, a tela só mostra 500. **Os dados estão no banco, só não aparecem.**

### 2. Truncamento silencioso de marcações > 6 batidas/dia
Em `groupMarksIntoDailyRecords` (linha 427-431): se um funcionário tem mais de 6 batidas no dia (entrada/saída de almoço bipadas duas vezes, plantões longos com 8 batidas, etc.), as **excedentes são descartadas** — só ficam as 6 primeiras. O AFD muitas vezes tem isso.

### 3. CPFs não mapeados são descartados sem aviso por linha
Linha 1402-1407: marcações cujo CPF/PIS não bate com nenhuma admissão são contadas em `cpfsNaoEncontrados` mas **nunca persistidas**. Se o CPF veio com formato estranho no AFD (ex.: PIS sem padding), fica fora.

### 4. Mescla com registros existentes pode descartar batidas
Quando o dia já tem registros (importação parcial anterior), o código mescla cronologicamente e **se passar de 6 slots, descarta** as novas (linha 422-431).

### 5. Parser ignora linhas que não casam exatamente
`parseAfd` (linha 331) só aceita dois formatos rígidos. Linhas com espaços extras, BOM no início, ou variações do REP-C podem ser silenciosamente puladas. Hoje não há contagem de linhas tipo 3 ignoradas.

---

## Plano de correção

### A) Diagnóstico transparente no toast e log
- Calcular e mostrar no toast final: **linhas totais**, **linhas tipo 3**, **marcações parseadas**, **mapeadas**, **não mapeadas**, **dias gerados**, **batidas excedentes descartadas**.
- Logar no `console.warn` cada CPF/PIS bruto não mapeado (até 50 amostras) para você identificar quais admissões faltam.

### B) Persistir marcações excedentes (>6 batidas)
Criar **registros adicionais** no mesmo dia (mesmo CPF, mesma data) usando uma chave secundária — ou concatenar todas as batidas em um campo de observação JSON `marcacoes_extras` no `motivo` para não perder o dado bruto. Recomendado: **armazenar o array completo bruto** de marcações do dia em um campo JSON novo, mantendo as 6 principais nos slots.

### C) Aumentar limite de listagem e adicionar paginação
- Subir `.limit(500)` para `.limit(2000)` na query de exibição.
- Adicionar contador "X registros — mostrando primeiros 2000" quando atingir o limite, e botão "Carregar mais".

### D) Parser AFD mais tolerante
- Remover BOM, normalizar espaços antes do match.
- Adicionar terceiro padrão: linhas tipo 3 com separadores ou tamanhos variantes.
- Contar e reportar linhas tipo 3 que falharam no parse.

### E) Fallback de CPF mais agressivo
- Quando a resolução falhar, tentar também: matriz de PIS sem zero à esquerda já presente, mas adicionar busca por **sufixo de 8 dígitos** do CPF e matching por nome (se o AFD tiver razão social), apenas como último recurso e logado.

### F) Validação pós-importação
Após o `upsert`, fazer um `count` no banco filtrado por equipamento/período e comparar com `records.length` esperado. Se divergir, alertar.

---

## Arquivos a modificar

- `src/components/admin/AdminPontoEletronico.tsx`
  - `parseAfd` (linha 331) — parser mais tolerante + contagem de descartes
  - `groupMarksIntoDailyRecords` (linha 372) — preservar batidas excedentes em campo JSON
  - `confirmManualImport` (linha 1357) — diagnóstico detalhado, validação pós-importação
  - Query `registros_ponto` (linha 555) — limite 2000 + indicador de truncamento

- (Opcional) Migração SQL se for adicionar coluna `marcacoes_brutas jsonb` em `registros_ponto` para guardar todas as batidas do dia sem perda.

---

## Pergunta antes de implementar

Para batidas excedentes (>6 no dia), prefere:
- **(a)** Guardar todas as batidas brutas em uma coluna JSON nova (`marcacoes_brutas`) — solução completa, requer migração;
- **(b)** Apenas anexar as excedentes no campo `motivo` como texto — sem migração, dado fica visível mas não estruturado;
- **(c)** Manter o descarte atual mas avisar claramente no toast e console — só transparência.

Posso seguir com **(a)** por padrão se você aprovar o plano sem responder.
