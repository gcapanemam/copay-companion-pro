

# Importação Manual de AFD (Portaria 671 / CPF)

## O que vou adicionar

Um botão **"Importar AFD (arquivo)"** na barra superior da aba *Equipamentos* (ao lado de "Sincronizar Todos") que abre um seletor de arquivo `.txt` e processa o AFD localmente — sem depender do REP estar online.

## Fluxo

1. Usuário clica em **Importar AFD (arquivo)** → escolhe um ou mais `.txt`
2. Sistema lê o conteúdo no navegador (`FileReader`)
3. Reaproveita a função `parseAfd` já existente (que já entende o layout Portaria 671 REP-C com timestamp ISO + CPF/PIS no final + CRC)
4. Reaproveita `resolveCpfFromRest` (resolve CPF puro de 11 dígitos, CPF zero-padded de 12, ou PIS quando aparecer)
5. Reaproveita `groupMarksIntoDailyRecords` (agrupa em entrada_1..saida_3, mescla com existentes, ordem cronológica, sem deduplicação)
6. Faz upsert em `registros_ponto` (cpf+data)
7. Mostra toast com: **dias importados**, **marcações lidas**, **CPFs não mapeados**, **excedentes (>6 batidas/dia)**, **arquivo processado**

## Diferenças vs. sync automático

| | Sync automático | Importação manual (nova) |
|---|---|---|
| Origem | HTTP no REP | Arquivo `.txt` local |
| `equipamento_id` | ID do equipamento sincronizado | Vínculo opcional: usuário escolhe equipamento ou deixa "Sem vínculo" |
| `ultimo_nsr` | Atualiza no equipamento | **Não** atualiza (importação manual é histórico, não muda cursor de sync) |
| Pré-validação | — | Detecta cabeçalho tipo "1" da Portaria 671 e mostra empresa/CNPJ/REP do arquivo antes de confirmar |

## Tela de pré-visualização

Ao selecionar o arquivo, antes de gravar, abre um pequeno diálogo mostrando:

- Empresa / CNPJ extraídos do header (linha tipo 1)
- Período coberto (primeira → última marcação)
- Total de marcações tipo 3 detectadas
- NSR mínimo e máximo
- Seletor "Vincular ao equipamento" (lista os ativos + opção "Nenhum")
- Botão **Confirmar importação** / **Cancelar**

## Arquivo a alterar

- **`src/components/admin/AdminPontoEletronico.tsx`** — único arquivo. Adiciona:
  - `<input type="file" accept=".txt,text/plain" multiple hidden ref={...} />`
  - Botão "Importar AFD (arquivo)" no header (linha ~1258)
  - Função `handleManualAfdImport(files: FileList)` que reusa `parseAfd` + `resolveCpfFromRest` + `groupMarksIntoDailyRecords` + upsert
  - Mini-diálogo de pré-visualização (`Dialog` shadcn já importado em outras telas)
  - Parser do header (linha tipo "1") para extrair empresa/CNPJ

## Compatibilidade com o arquivo de exemplo

O arquivo `AFD3135796700015900014003750372946REP_C.txt_1.txt` enviado:
- 3.867 linhas, header tipo 1 + 3.866 marcações tipo 3
- Layout: `NSR(9) + Tipo(1) + Timestamp ISO(24) + CPF padded(12) + CRC16(4 hex)` — já reconhecido por `parseAfd`
- CPFs como `07981686016`, `14757861664`, `11497480604` — resolvidos via `cpfsValidos`/`cpfSuffix9ToCpf` em `resolveCpfFromRest`

Sem nova migration, sem nova edge function, sem dependências novas.

