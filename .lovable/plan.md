

# Melhorar Layout de Funcionários com Foto

## Resumo

Redesenhar o dialog de detalhes do funcionário com um layout tipo "ficha funcional" organizado por seções, com suporte a foto do funcionário (upload e exibição). Adicionar coluna `foto_url` na tabela `admissoes` e usar o storage para armazenar as fotos.

## Mudanças

### 1. Banco de Dados
- Adicionar coluna `foto_url TEXT` na tabela `admissoes` para armazenar o caminho da foto no storage
- Criar bucket `funcionarios-fotos` no storage (público para leitura)

### 2. Layout do Dialog (AdminFuncionarios.tsx)
Redesenhar o dialog de detalhes para um layout de "ficha funcional":

```text
┌──────────────────────────────────────────────┐
│  [FOTO]   Nome Completo                      │
│  avatar   CPF: xxx.xxx.xxx-xx                │
│  120px    Função: Serviços Gerais            │
│           Unidade: Santo Agostinho           │
│           Badge: Admissão / Plano / Ambos    │
├──────────────────────────────────────────────┤
│  📋 Dados Pessoais                           │
│  RG | Data Nasc | Sexo | Cor | Estado Civil  │
│  Escolaridade | Local Nascimento             │
├──────────────────────────────────────────────┤
│  📄 Documentos                               │
│  PIS | CTPS | Série | Emissão | Título       │
├──────────────────────────────────────────────┤
│  📍 Endereço                                 │
│  Endereço | Bairro | CEP                     │
├──────────────────────────────────────────────┤
│  👨‍👩‍👧 Família                                  │
│  Mãe | Pai | Cônjuge | Dependentes           │
├──────────────────────────────────────────────┤
│  💼 Profissional                             │
│  Horário | 1º Emprego | VT | Dados Bancários │
├──────────────────────────────────────────────┤
│  📞 Contato                                  │
│  Telefone | E-mail                           │
├──────────────────────────────────────────────┤
│  🏥 Plano de Saúde                           │
│  Interesse | Plano Escolhido                 │
└──────────────────────────────────────────────┘
```

### 3. Upload de Foto
- Botão de upload na área da foto no dialog
- Upload para bucket `funcionarios-fotos` com path `{cpf}.jpg`
- Salvar URL no campo `foto_url` da admissão
- Avatar com iniciais como fallback quando não há foto

### 4. Tabela principal
- Adicionar coluna com avatar/foto miniatura na lista de funcionários

### Arquivos modificados
- `src/components/admin/AdminFuncionarios.tsx` — redesign completo
- Migration SQL — coluna `foto_url` + bucket storage

