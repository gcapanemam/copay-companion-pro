

# Area do Beneficiario - Login por CPF e Informe IR

## Resumo

Criar uma area onde cada beneficiario (titular ou dependente) pode fazer login com CPF e senha, visualizar seus dados de mensalidade e coparticipacao, e gerar um informe para Imposto de Renda.

## Estrutura

### 1. Banco de dados

- Nova tabela `beneficiario_senhas`: `cpf TEXT PRIMARY KEY`, `senha_hash TEXT NOT NULL`, `created_at TIMESTAMPTZ DEFAULT now()`
- O admin (pagina principal) tera um botao para cadastrar/resetar senha de um beneficiario por CPF

### 2. Edge Function `login-beneficiario`

- Recebe `{ cpf, senha }`
- Valida contra `beneficiario_senhas` (usando bcrypt hash)
- Se valido, busca o titular ou dependente pelo CPF e retorna todos os dados de mensalidades e coparticipacoes do ano selecionado
- Retorna os dados diretamente (sem sessao persistente - portal simples)

### 3. Novas paginas

- **`/minha-area`** - Login por CPF + senha, apos login mostra:
  - Nome do beneficiario
  - Tabela com mensalidades e coparticipacoes mes a mes
  - Botao "Informe IR" que gera um resumo anual

### 4. Informe para Imposto de Renda

- Botao gera um resumo em tela (com opcao de imprimir/PDF via `window.print()`)
- Conteudo: Nome, CPF, ano-calendario, total pago em plano de saude (mensalidade + coparticipacao), discriminado por mes
- CNPJ da operadora Hapvida no cabecalho

### 5. Gestao de senhas (area admin)

- Na pagina principal (Index), adicionar um botao/dialog para cadastrar senha por CPF
- Lista de CPFs dos titulares/dependentes com opcao de definir senha

## Arquivos a criar/modificar

- Migration: tabela `beneficiario_senhas`
- `supabase/functions/login-beneficiario/index.ts`
- `src/pages/MinhaArea.tsx` - pagina do beneficiario (login + dashboard + IR)
- `src/components/GerenciarSenhas.tsx` - dialog para admin cadastrar senhas
- `src/pages/Index.tsx` - adicionar botao de gerenciar senhas
- `src/App.tsx` - nova rota `/minha-area`

## Detalhes tecnicos

- Senha hasheada com bcrypt na edge function
- Login sem Supabase Auth (portal simples, sem sessao persistente - dados carregados via edge function)
- Informe IR usa CSS `@media print` para formatacao de impressao
- RLS: tabela `beneficiario_senhas` acessivel apenas via service role (edge function)

