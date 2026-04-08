

# Portal RH - Sistema Completo para Funcionários

## Resumo

Expandir o portal existente (MinhaArea) para um Portal RH completo com 5 módulos, reutilizando o login CPF/senha já implementado. O admin terá telas para cadastrar dados manualmente e via upload. O funcionário verá tudo no seu portal.

## Módulos

### 1. Plano de Saúde (já existe)
- Manter funcionalidade atual em MinhaArea

### 2. Contracheques
- **Admin**: Upload de PDFs de contracheques, associando ao CPF do funcionário + mês/ano
- **Funcionário**: Lista de contracheques disponíveis com botão para baixar/visualizar o PDF
- **Storage**: Bucket `contracheques` no backend para armazenar os PDFs

### 3. EPIs (Equipamentos de Proteção Individual)
- **Admin**: Formulário para registrar entrega de EPI (funcionário, tipo EPI, data entrega, validade, quantidade)
- **Admin**: Upload de planilha para cadastro em massa
- **Funcionário**: Lista de EPIs recebidos com status (válido/vencido) e alertas de vencimento

### 4. Vale-Transporte
- **Admin**: Formulário para registrar créditos mensais (funcionário, mês, valor, quantidade de passagens)
- **Admin**: Upload de planilha para cadastro em massa
- **Funcionário**: Histórico mensal de vale-transporte recebido

### 5. Controle de Faltas
- **Admin**: Formulário para registrar faltas (funcionário, data, tipo: falta, atestado, licença, etc.)
- **Admin**: Upload de planilha para cadastro em massa
- **Funcionário**: Histórico de faltas com tipo e justificativa

## Estrutura Técnica

### Banco de Dados (novas tabelas)

```text
contracheques
├── id (uuid PK)
├── cpf (text)
├── mes (int)
├── ano (int)
├── arquivo_path (text) -- caminho no storage
├── nome_arquivo (text)
└── created_at (timestamptz)

epis
├── id (uuid PK)
├── cpf (text)
├── tipo_epi (text) -- ex: capacete, luva, bota
├── data_entrega (date)
├── data_validade (date, nullable)
├── quantidade (int)
├── observacao (text, nullable)
└── created_at (timestamptz)

vale_transporte
├── id (uuid PK)
├── cpf (text)
├── mes (int)
├── ano (int)
├── valor (numeric)
├── quantidade_passagens (int, nullable)
├── observacao (text, nullable)
└── created_at (timestamptz)

faltas
├── id (uuid PK)
├── cpf (text)
├── data_falta (date)
├── tipo (text) -- falta, atestado, licença médica, etc.
├── justificativa (text, nullable)
├── abonada (boolean default false)
└── created_at (timestamptz)
```

### Storage
- Bucket `contracheques` (privado, acesso via RLS por CPF)

### Edge Function
- Atualizar `login-beneficiario` para retornar dados de todos os módulos (EPIs, VT, faltas, contracheques)

### Páginas e Componentes

**Admin (área autenticada `/`):**
- Nova navegação lateral ou por abas: Plano de Saúde | Contracheques | EPIs | Vale-Transporte | Faltas
- Cada aba com formulário de cadastro manual + upload de planilha
- Upload de PDFs para contracheques

**Funcionário (`/minha-area`):**
- Após login, navegação por abas entre os módulos
- Cada aba mostra os dados do CPF logado

### Arquivos a criar/modificar

- **Migration**: 4 novas tabelas + bucket storage + RLS
- `src/pages/Index.tsx` — adicionar navegação entre módulos admin
- `src/pages/MinhaArea.tsx` — adicionar abas para os novos módulos
- `src/components/admin/AdminContracheques.tsx` — upload de PDFs
- `src/components/admin/AdminEPIs.tsx` — cadastro e upload planilha
- `src/components/admin/AdminValeTransporte.tsx` — cadastro e upload planilha
- `src/components/admin/AdminFaltas.tsx` — cadastro e upload planilha
- `src/components/portal/PortalContracheques.tsx` — visualização funcionário
- `src/components/portal/PortalEPIs.tsx` — visualização funcionário
- `src/components/portal/PortalValeTransporte.tsx` — visualização funcionário
- `src/components/portal/PortalFaltas.tsx` — visualização funcionário
- `supabase/functions/login-beneficiario/index.ts` — incluir novos dados na resposta

### RLS
- Todas as tabelas: admin (authenticated) tem acesso total
- Acesso do funcionário via edge function (service role), não direto

