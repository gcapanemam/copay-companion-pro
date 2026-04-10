

## Correção: Visualização de Funcionário pelo Admin

### Problema identificado
1. **Edge function `login-beneficiario`**: Na action `admin-view`, o código exige que o CPF exista em `titulares` ou `dependentes`. Funcionários que estão apenas na tabela `admissoes` recebem erro 404 "Beneficiário não encontrado".
2. **Tabela duplicada**: `AdminFuncionarios.tsx` tem colunas duplicadas no header (Departamento e Origem aparecem duas vezes, e há uma coluna vazia extra).

### Correções

**1. Edge function (`login-beneficiario/index.ts`)**
- Após verificar `titulares` e `dependentes`, se ambos forem null, buscar na tabela `admissoes` pelo CPF
- Se encontrar na `admissoes`, usar o nome de lá e continuar com mensalidades/coparticipações vazias
- Só retornar 404 se não existir em nenhuma das 3 tabelas

**2. AdminFuncionarios.tsx**
- Remover as colunas duplicadas do header da tabela (linhas 142-143 que repetem "Departamento" e "Origem")
- Remover o `<TableHead>` vazio extra (linha 134)

### Arquivos a editar
- `supabase/functions/login-beneficiario/index.ts` — fallback para admissoes
- `src/components/admin/AdminFuncionarios.tsx` — corrigir header duplicado

