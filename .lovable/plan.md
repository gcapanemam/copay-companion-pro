
## Atualização em massa de funcionários a partir do XLS

**Objetivo:** A partir do arquivo `Empregados_em_Excel_-_Apenas_Ativos.xls`:
1. Para cada funcionário **encontrado no arquivo**: atualizar `unidade` (coluna 1) e `primeiro_dia_trabalho` (coluna 3) na tabela `admissoes`.
2. Para cada funcionário **que NÃO aparece no arquivo**: marcar como inativo, preenchendo `data_demissao` com a data de hoje (2026-04-17), se ainda estiver vazio.

**Hoje no banco:** 620 funcionários em `admissoes`. Praticamente nenhum tem `unidade` ou `primeiro_dia_trabalho` preenchidos. O arquivo da folha será a fonte da verdade.

### Como vou casar funcionários (chave de identificação)

A planilha provavelmente traz nome (e talvez matrícula/CPF). Vou usar esta ordem de prioridade para casar com `admissoes`:
1. **CPF** (somente dígitos) — se existir na planilha. Mais confiável.
2. **Matrícula** — se existir.
3. **Nome normalizado** (uppercase, sem acentos, espaços colapsados) — fallback.

Se uma linha do XLS não casar com ninguém, fica num relatório de "não encontrados" para você revisar (não cria funcionário novo automaticamente).

### Etapas da implementação

1. **Inspecionar o XLS** (via script Python com xlrd) para confirmar as colunas reais — no mínimo identificar: Unidade, Nome, Data de Admissão, e qualquer chave (CPF/matrícula).
2. **Mostrar a você** uma prévia: quantas linhas no arquivo, quantas casaram por CPF/nome, quantas serão inativadas. **Aguardar OK antes de gravar.**
3. **Aplicar updates em lote** via insert tool (UPDATE):
   - `UPDATE admissoes SET unidade=?, primeiro_dia_trabalho=? WHERE id=?` para cada match.
   - `UPDATE admissoes SET data_demissao='2026-04-17' WHERE id IN (...) AND data_demissao IS NULL` para os ausentes.
4. **Relatórios finais** salvos em `/mnt/documents/`:
   - `atualizados.csv` — quem foi atualizado (com unidade/admissão).
   - `inativados.csv` — quem foi marcado como demitido hoje.
   - `nao_encontrados.csv` — linhas do XLS sem correspondência (para você decidir).

### Pontos a confirmar antes de gravar

- **Formato da data**: hoje o campo `primeiro_dia_trabalho` é `text` e os existentes estão em formato `dd/mm/aaaa`. Vou manter esse formato.
- **Data de demissão dos inativados**: usarei hoje (2026-04-17). Se preferir outra data (ex.: último dia do mês passado), me avise.
- **Funcionários já com `data_demissao` preenchida**: deixo como estão (não sobrescrevo).
- **Sobrescrever unidade/admissão já preenchidos?** Sim, o XLS é a fonte da verdade — vou sobrescrever.

### Ordem de execução no próximo modo
1. Ler o XLS e mostrar prévia com contagens (sem gravar).
2. Você aprova.
3. Executar updates + gerar os 3 CSVs em `/mnt/documents/`.
