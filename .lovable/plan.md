## Diagnóstico após leitura do leiaute oficial MTE + biblioteca de referência (convenia/afd-reader)

Comparei o parser atual com a especificação canônica das **Portarias 1510/2009 e 671/2021** e o código de referência da `convenia/afd-reader`. Encontrei mais problemas — **o parser atual usa regex frouxa em vez de leitura posicional fixa**, o que faz ele ignorar registros válidos do leiaute oficial.

### Estrutura oficial AFD (campos posicionais, codificação ISO-8859-1)

Cada linha começa com **NSR(9 dígitos) + Tipo(1 dígito)**, seguido por payload específico:

| Tipo | Significado | Estrutura do payload |
|------|-------------|----------------------|
| 1 | Header | identType(1)+CNPJ/CPF(14)+CEI(12)+nome(150)+serial(17)+dataIni(8)+dataFim(8)+dataGer(8)+horaGer(4) |
| 2 | Alteração de empresa | (ignorável) |
| **3** | **Marcação Portaria 1510** | **DDMMYYYY(8) + HHMM(4) + PIS(12)** = 24 chars |
| **3** | **Marcação Portaria 671** | **AAAA-MM-DDThh:mm:00±ZZZZ(24) + PIS(12) + CRC(4)** |
| **4** | **Ajuste de marcação** | dataAntes(8)+horaAntes(4)+dataDepois(8)+horaDepois(4) — sem PIS |
| **5** | **Cadastro de empregado** | data(8)+hora(4)+operação(1)+PIS(12)+nome(52) ← **mapeamento PIS↔Nome dentro do próprio AFD** |
| 9 | Trailer | (ignorável) |

### Problemas reais no parser atual

1. **Usa `trim()` no início da linha**, descartando espaços internos significativos do leiaute posicional.
2. **Tenta extrair PIS via regex no `rest`** em vez de pegar exatamente os 12 dígitos na posição correta — pode pegar números errados se houver lixo.
3. **Não processa tipo 5 (Employee)** — esse registro contém o **mapeamento PIS↔Nome direto do REP**, ouro para resolver CPFs não cadastrados via fallback por nome.
4. **Ignora completamente tipo 4 (Ajuste)** — esses são marcações legítimas que entram no espelho de ponto.
5. **Regex de fuso horário só aceita `±HHMM`** sem dois pontos. Portaria 671 permite `±HH:MM`.
6. **Variante "sem segundos" inventada** no padrão 3 não existe na especificação — é palpite que pode confundir.

---

## Plano de correção

### A) Reescrever `parseAfd` com leitura posicional fixa (não-regex frouxa)

- Detectar tipo nas posições 0-9 (NSR) e 9 (tipo) por **slicing exato**.
- **Tipo 3 — Portaria 671**: ler ISO-8601 nas posições 10-33 (24 chars) com regex estrita; PIS nas posições 34-45.
- **Tipo 3 — Portaria 1510**: ler DDMMYYYY (10-17), HHMM (18-21), PIS (22-33) por slicing puro.
- **Tipo 4**: ler dataDepois/horaDepois (após o "antes") e gerar uma marcação sem PIS, marcada como `origem: "tipo4_ajuste"` (auditoria, opcionalmente persistida em `marcacoes_brutas` mas sem CPF).
- **Tipo 5**: extrair `{pis, nome}` para construir um mapa PIS↔Nome interno do AFD.
- Não chamar `trim()` na linha inteira; preservar layout posicional.

### B) Estender resolução de CPF com 3 fallbacks novos

Atualmente `resolveCpfFromRest` tenta CPF/PIS/sufixo9. Vou adicionar:

1. **Mapa PIS→CPF construído com tipo 5 do AFD + admissões**: se o tipo 5 lista PIS X com nome "JOÃO SILVA", e existe admissão "JOÃO SILVA" com CPF Y, mapear PIS X → CPF Y automaticamente. Útil quando admissão está sem `numero_pis` cadastrado.
2. **Fallback por nome normalizado** (último recurso, com log): comparar nome do tipo 5 contra `admissoes.nome_completo` ignorando acentos/caso.
3. **Aceitar PIS sem o zero à esquerda** (já parcialmente implementado, formalizar).

### C) Persistir tipo 4 (ajustes) sem perder o histórico

Ajustes (tipo 4) não têm PIS, então ficam órfãos. Opções:
- **(c1)** Salvar em `marcacoes_brutas` do dia correspondente como sufixo "(ajuste)".
- **(c2)** Apenas contar e logar quantos ajustes apareceram, sem persistir.

Vou usar **(c1)** para não perder informação de auditoria.

### D) Reportar contagem por tipo

Toast e console mostrarão: `T1: X • T2: X • T3: X • T4: X • T5: X • T9: X • Tipo 3 falhados: X`. Isso permite diagnosticar instantaneamente se um arquivo tem mais marcações do que está sendo importado.

### E) Validação cruzada com Header

O Header (tipo 1) inclui `dataIni` e `dataFim` do período do AFD. Vou ler esses campos e comparar com as datas das marcações encontradas — se houver discrepância (ex.: header diz mar-jun mas só achei marcações de março), alertar no toast.

---

## Arquivos a modificar

- **`src/components/admin/AdminPontoEletronico.tsx`**:
  - Reescrever `parseAfd` (linhas 332-439) com parsing posicional + tipos 3/4/5.
  - Atualizar `parseAfdHeader` para extrair `dataIni`/`dataFim` do header.
  - Atualizar `resolveCpfFromRest` para receber e usar o mapa Employee (tipo 5) e fallback por nome.
  - Atualizar `confirmManualImport` e `syncEquipamento` (call sites do parser) para passar admissões+nomes e exibir contagens por tipo.
  - Persistir ajustes do tipo 4 no campo `marcacoes_brutas`.

Sem migração de banco — a coluna `marcacoes_brutas` já existe.

---

## Resultado esperado

Após esta correção, **todas** as marcações que o leiaute MTE define como tipo 3 e 4 serão processadas, e o sistema usará o cadastro de empregados (tipo 5) embutido no próprio AFD para resolver CPFs que hoje ficam de fora por falta de PIS na admissão.
