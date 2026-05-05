## Relatório consolidado de uso de Vale Transporte por funcionário

Adicionar uma nova aba **"Relatório Consolidado"** dentro de `AdminValeTransporte.tsx`, ao lado das abas existentes (Mensal, Usos, Cartões, Inconsistências, Calendário).

### O que o relatório mostra

Para cada funcionário (CPF), no período selecionado, agrega os dados da tabela `vt_usos`:

| Coluna | Descrição |
|---|---|
| Funcionário | Nome (via `admissoes`) + CPF |
| Unidade | Unidade da admissão |
| Total de passagens | Quantidade de registros em `vt_usos` |
| Valor total (R$) | Soma de `valor` |
| Linhas utilizadas | Lista distinta de `linha` |
| Dias com uso | Quantidade de datas distintas |
| Média de passagens/dia | Total ÷ dias com uso |
| Inconsistências | Contagem em `vt_inconsistencias` (status pendente) |

### Filtros

- **Período**: data inicial e final (default: mês corrente)
- **Unidade**: select (todas as unidades existentes)
- **Busca**: por nome ou CPF

### Ações

- **Ordenação** clicável por coluna (padrão: valor total desc)
- **Exportar Excel (.xlsx)**: gera planilha com a mesma estrutura usando a lib `xlsx` (já importada no arquivo)
- **Card de KPIs no topo**: total funcionários, total passagens, valor total no período

### Detalhes técnicos

- Novo arquivo: `src/components/admin/AdminVtRelatorio.tsx`
- Query única em `vt_usos` filtrando por `data_hora` no período, depois agrega no cliente por CPF
- Join com `admissoes` (para nome/unidade) e contagem em `vt_inconsistencias`
- Usa `useQuery` do `@tanstack/react-query`, padrão já adotado no arquivo
- Registrar a aba em `AdminValeTransporte.tsx`:
  - Novo `<TabsTrigger value="relatorio">Relatório</TabsTrigger>`
  - Novo `<TabsContent value="relatorio">` renderizando `<AdminVtRelatorio />`

Nenhuma mudança de schema é necessária.