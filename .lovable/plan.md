

## Plano: Aplicar foto 3x4 ao perfil de cada funcionário

### Situação
- 508 funcionários têm `foto_3x4` no bucket `funcionarios-documentos` (path `{cpf}/foto_3x4.{ext}`)
- 0 dos 620 registros de `admissoes` têm `foto_url` preenchido
- O sistema exibe a foto em vários lugares (`AdminFuncionarios`, `FichaFuncionalDialog`, `PortalMeusDados`) lendo de `admissoes.foto_url` no bucket `funcionarios-fotos`

### O que será feito

**1. Edge function `apply-foto-perfil`** (uma única execução em massa)
- Busca todos os registros em `funcionario_documentos` com `tipo_documento = 'foto_3x4'`
- Para cada CPF:
  - Baixa o arquivo de `funcionarios-documentos/{cpf}/foto_3x4.{ext}`
  - Faz upload para `funcionarios-fotos/{cpf}.{ext}` (mesma convenção já usada no upload manual)
  - Atualiza `admissoes.foto_url = '{cpf}.{ext}'` para todos os registros do CPF
- Pula arquivos `.bin` (content-type desconhecido — não vão renderizar como imagem)
- Suporta `limit`/`offset` para processar em lotes (~50 por vez) e evitar timeout
- Retorna relatório: sucesso, erros, ignorados

**2. Botão na tela de admin de Funcionários**
- "Aplicar Fotos 3x4 ao Perfil" com barra de progresso (mesmo padrão do botão de importar Drive)
- Processa em lotes de 50, com possibilidade de cancelar
- Ao terminar, invalida cache para mostrar fotos imediatamente

### Resultado esperado
- Após executar, ~508 funcionários terão foto de perfil visível em:
  - Lista de funcionários (admin)
  - Ficha funcional
  - Portal "Meus Dados" do funcionário

### Arquivos
- `supabase/functions/apply-foto-perfil/index.ts` (novo)
- `src/components/admin/AdminFuncionarios.tsx` (botão + progresso)

