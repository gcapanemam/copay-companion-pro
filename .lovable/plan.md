

## Plan: Alert system for task pendencies

### What changes

1. **Add `resolvida` boolean column to `tarefa_atualizacoes`** — defaults to `false`, so pendencies can be marked as resolved by the admin.

2. **AdminTarefas: Show pending alerts at the top** — Query all unresolved pendencies (`tipo = 'pendencia' AND resolvida = false`), display them as alert cards with task title, employee name, pendency text, date, and a "Resolver" button.

3. **AdminTarefas: "Resolver" action** — Updates the `tarefa_atualizacoes` row setting `resolvida = true`. Optionally opens the task detail.

4. **PortalTarefas: No changes needed** — pendencies are already inserted with `tipo: "pendencia"` into `tarefa_atualizacoes`.

### Technical details

- **Migration**: `ALTER TABLE tarefa_atualizacoes ADD COLUMN resolvida boolean NOT NULL DEFAULT false;`
- **Admin query**: New `useQuery` fetching unresolved pendencies joined with task title info
- **RLS**: Existing policies already allow anon select and authenticated manage on `tarefa_atualizacoes`; need to add anon UPDATE policy for the `resolvida` column (admin uses authenticated role, already covered)
- **UI**: Alert section with `AlertTriangle` icon, yellow/orange styling, showing above the tasks table

