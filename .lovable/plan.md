

## Plan: Migrar documentos do Google Drive para o armazenamento do sistema

### O que acontece

Um processo automatizado varre todos os registros de `admissoes`, identifica links do Google Drive no campo `dados`, baixa cada arquivo e armazena no bucket do sistema. Os links originais são substituídos pelas URLs do armazenamento próprio.

### Requisitos

- Os arquivos no Google Drive **devem** estar com compartilhamento "Qualquer pessoa com o link"

### Mudanças

**1. Novo bucket `funcionarios-documentos`** (migration)
- Bucket público para documentos de funcionários

**2. Nova tabela `funcionario_documentos`** (migration)
- Colunas: `id`, `cpf`, `tipo_documento`, `nome_arquivo`, `arquivo_url`, `drive_url_original`, `created_at`
- RLS: anon SELECT, authenticated ALL

**3. Edge function `import-drive-files`**
- Recebe: `{ cpf }` (ou sem parâmetros para processar todos)
- Varre o campo `dados` do registro de admissão buscando URLs que contenham `drive.google.com`
- Para cada link encontrado:
  - Extrai o file ID da URL
  - Baixa via `https://drive.google.com/uc?export=download&id=FILE_ID`
  - Faz upload para o bucket `funcionarios-documentos` com path `{cpf}/{tipo_documento}`
  - Registra na tabela `funcionario_documentos`
- Retorna relatório de sucesso/falha por arquivo

**4. UI na Ficha Funcional -- seção "Documentos"**
- Lista documentos já migrados com botão de download
- Botão "Importar do Drive" para disparar migração individual
- Botão no admin para migração em lote de todos os funcionários
- Status visual (importado/pendente/erro)

### Fluxo

```text
Admin clica "Importar Documentos do Drive"
        |
        v
Edge Function varre dados JSON → encontra links drive
        |
        v
Baixa arquivo via fetch() → Upload no bucket
        |
        v
Registra na tabela funcionario_documentos
        |
        v
UI mostra documentos com download nativo
```

### Limitações
- Arquivos >100MB podem falhar (interstitial do Google)
- Arquivos privados no Drive não serão baixados
- O processo pode levar alguns minutos para muitos funcionários

### Detalhes técnicos
- Edge function usa `fetch()` para download e Supabase Storage SDK para upload
- Extração de ID via regex de URLs como `/open?id=XXX`, `/file/d/XXX/`
- Campos identificados: `rg_1`, `cpf`, `foto_3x4`, `comprovante_de_resid_ncia`, `certid_o_de_nascimento_ou_casamento`, `diploma_s_enviar_todos_que_possui`, `t_tulo_de_eleitor_incluir_comprovante_ltima_vota_o`, `foto_da_1a_foto_e_2a_dados_da_carteira_de_trabalho`, `certid_o_de_nascimento_dos_filhos_caso_tenha`, `cpf_dependentes`

