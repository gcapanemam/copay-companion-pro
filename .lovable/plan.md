

# Sistema de Controle de Plano de Saude e Coparticipacao

## Resumo

Sistema para upload de PDFs da Hapvida (faturas mensais e coparticipacao), com parsing dos dados, armazenamento no Supabase e exibicao em tabela anual por titular/dependente.

## Estrutura dos PDFs

**PDF 1 - Fatura Mensal**: Vencimento, nome do titular, dependentes, valor da mensalidade de cada um.
**PDF 2 - Coparticipacao**: Titular, nome de quem utilizou, data, procedimentos realizados, local, valor.

## Plano de Implementacao

### 1. Configurar Supabase (Lovable Cloud)

Criar as seguintes tabelas:

- **titulares**: id, nome, matricula, cpf
- **dependentes**: id, titular_id, nome, matricula, cpf
- **mensalidades**: id, titular_id, dependente_id (nullable), mes, ano, valor
- **coparticipacoes**: id, titular_id, dependente_id (nullable), nome_usuario, data_utilizacao, mes, ano
- **coparticipacao_itens**: id, coparticipacao_id, procedimento, local, quantidade, valor
- **uploads**: id, tipo (mensalidade/coparticipacao), nome_arquivo, data_upload

RLS habilitado. Policies para usuarios autenticados.

### 2. Edge Function para parsing de PDF

Criar uma Supabase Edge Function que:
- Recebe o PDF via upload
- Usa pdf-parse para extrair texto
- Identifica o tipo (fatura mensal vs coparticipacao) pelo conteudo
- Extrai dados estruturados usando regex baseado nos padroes da Hapvida
- Salva no banco de dados

### 3. Pagina Principal - Upload e Tabela

**Componentes:**
- **UploadArea**: Drag-and-drop ou botao para upload de PDFs, com indicador de tipo detectado
- **TabelaAnual**: Tabela principal com:
  - Coluna 1: Nome (titular em negrito, dependentes indentados abaixo)
  - Colunas 2-13: Janeiro a Dezembro, cada celula mostrando:
    - Valor do plano (mensalidade)
    - Valor da coparticipacao (abaixo, em cor diferente)
    - Botao/icone clicavel para ver detalhes dos exames
  - Coluna 14: Total anual
- **DialogExames**: Modal que abre ao clicar no botao, mostrando lista de exames/consultas com data, procedimento, local e valor
- **SeletorAno**: Dropdown para selecionar o ano de visualizacao

### 4. Fluxo do Usuario

1. Usuario faz upload de um ou mais PDFs
2. Sistema detecta o tipo e extrai os dados
3. Dados sao salvos no Supabase
4. Tabela e atualizada automaticamente
5. Usuario pode clicar no botao de cada celula para ver detalhes dos exames

## Detalhes Tecnicos

- **PDF Parsing**: Supabase Edge Function com biblioteca de parsing de texto
- **Banco**: Supabase via Lovable Cloud (migrations para schema, queries via supabase-js)
- **Frontend**: React + shadcn/ui (Table, Dialog, Button, Card)
- **Estado**: React Query para fetch dos dados
- **Autenticacao**: Supabase Auth (login simples para proteger acesso)

## Arquivos a criar/modificar

- Migrations para todas as tabelas
- `src/integrations/supabase/` - client e types
- `supabase/functions/parse-pdf/` - Edge Function
- `src/pages/Index.tsx` - pagina principal
- `src/components/UploadArea.tsx`
- `src/components/TabelaAnual.tsx`
- `src/components/DialogExames.tsx`
- `src/components/SeletorAno.tsx`
- `src/hooks/useTitulares.ts`, `useMensalidades.ts`, `useCoparticipacoes.ts`

