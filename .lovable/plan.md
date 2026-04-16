

## Plano: Importação em massa dos documentos do Google Drive

### Situação atual
- 559 funcionários com links do Google Drive nos dados de admissão
- 8 documentos já importados (testes anteriores)
- Edge function `import-drive-files` já existe e suporta modo em lote (sem parâmetro `cpf`)

### O que será feito

**1. Deploy e execução da edge function em massa**
- Fazer deploy da função `import-drive-files`
- Executar via `curl` sem parâmetro `cpf` para processar todos os 559 funcionários
- A função vai varrer todos os campos `dados` buscando URLs do Drive, baixar cada arquivo e salvar no bucket `funcionarios-documentos`
- Timeout pode ser aumentado se necessário (muitos arquivos)

**2. Remover botão "Importar do Drive" da Ficha Funcional**
- Remover a seção de importação manual do `FichaFuncionalDialog.tsx`
- Manter apenas a listagem de documentos já importados com botão de download/visualização

### Limitações
- Arquivos privados no Drive não serão baixados
- Arquivos >100MB podem falhar
- Com 559 funcionários, o processo pode exceder o timeout da edge function (padrão ~60s). Se necessário, será ajustado para processar em lotes

### Arquivos alterados
- `src/components/admin/FichaFuncionalDialog.tsx` — remover botão de importação manual
- Deploy + execução de `supabase/functions/import-drive-files`

