

## Área do Funcionário — Plano

O portal do funcionário já existe em `/minha-area` com as abas de Plano de Saúde, Contracheques, EPIs, Vale-Transporte e Ponto/Faltas. O que falta é:

1. **Adicionar aba "Meus Dados"** — exibir informações pessoais/profissionais do funcionário (nome, CPF, cargo, unidade, departamento, etc.) consultando a tabela `admissoes` pelo CPF.

2. **Atualizar a edge function `login-beneficiario`** — no action `login`, buscar também os dados da tabela `admissoes` pelo CPF e retorná-los na resposta.

3. **Criar componente `PortalMeusDados`** — exibir os campos da admissão (dados pessoais, endereço, dados bancários, função, unidade, departamento, foto) de forma somente-leitura.

4. **Melhorar visibilidade do portal** — adicionar link visível para `/minha-area` na tela de login administrativo.

### Detalhes técnicos

- **Edge function**: adicionar query `supabase.from("admissoes").select("*").eq("cpf", cleanCpf).maybeSingle()` e retornar `admissao` no response do login.
- **PortalMeusDados.tsx**: componente read-only que renderiza campos como nome, CPF, função, unidade, departamento, endereço, dados bancários, foto, e quaisquer campos dinâmicos do JSON `dados`.
- **MinhaArea.tsx**: adicionar nova aba "Meus Dados" com ícone `User` como primeira aba, e state `admissao` para armazenar os dados.
- Nenhuma alteração de banco de dados necessária — a tabela `admissoes` já tem todos os campos.

