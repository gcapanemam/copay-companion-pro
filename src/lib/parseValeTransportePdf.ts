// Parser de PDF de Utilização de Cartão de Usuário (CITbus / transfacil)
// Extrai: data, hora, linha do ônibus, valor, operadora, tipo de tarifa
// e o número do cartão (do cabeçalho).

import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite consegue lidar com worker via ?url
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerUrl;

export interface VtUso {
  data_hora: string; // ISO
  linha: string;
  valor: number;
  operadora?: string;
  tipo_tarifa?: string;
}

export interface VtPdfParseResult {
  numeroCartao: string | null;
  titular: string | null;
  periodo: string | null;
  usos: VtUso[];
}

const RE_CARTAO = /Cart[ãa]o\s*:?\s*([0-9-]{8,})/i;
const RE_TITULAR = /Titular\s*:?\s*([^\n]+?)(?:\s+Dependente|\s*$)/i;
const RE_PERIODO = /Per[íi]odo\s+de\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i;
const RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const RE_HORA = /^\d{2}:\d{2}:\d{2}$/;
// valor no formato 5,75 ou 5,5 ou 0,25
const RE_VALOR = /^\d+,\d{1,2}$/;

function parseValor(s: string): number {
  return Number(s.replace(",", "."));
}

function toIso(data: string, hora: string): string {
  const [d, m, y] = data.split("/");
  return `${y}-${m}-${d}T${hora}-03:00`;
}

/**
 * Estratégia: extrai todos os tokens (palavras) das páginas em ordem de leitura,
 * depois varre a sequência detectando o padrão:
 *   <data> <hora> ... <linha> <valor>
 * onde a "linha" é o token IMEDIATAMENTE anterior ao valor (ex.: 1505, S84, 504, PR01, SD01, 3001, 3502).
 * Os tokens entre hora e linha (carga, tipo, qtd, descrição, operadora, leitura) são ignorados,
 * mas guardamos operadora/tipo se reconhecidos.
 */
export async function parseValeTransportePdf(
  file: File | ArrayBuffer
): Promise<VtPdfParseResult> {
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await (pdfjsLib as any).getDocument({ data }).promise;

  const allTokens: string[] = [];
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // ordena por y (top -> bottom) e dentro da linha por x (left -> right)
    const items = (content.items as any[])
      .filter((it) => typeof it.str === "string" && it.str.trim().length > 0)
      .map((it) => ({
        str: String(it.str).trim(),
        x: it.transform[4],
        y: it.transform[5],
      }))
      .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x));

    // agrupa em linhas (mesmo y aproximado) para reconstruir texto humano
    const linesMap = new Map<number, { x: number; str: string }[]>();
    for (const it of items) {
      const key = Math.round(it.y / 4) * 4;
      if (!linesMap.has(key)) linesMap.set(key, []);
      linesMap.get(key)!.push({ x: it.x, str: it.str });
    }
    const lines = Array.from(linesMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, arr]) => arr.sort((a, b) => a.x - b.x).map((t) => t.str).join(" "));

    fullText += "\n" + lines.join("\n");

    for (const it of items) {
      // separa tokens por espaço dentro do mesmo item
      for (const tok of it.str.split(/\s+/)) {
        if (tok) allTokens.push(tok);
      }
    }
  }

  const cartaoMatch = fullText.match(RE_CARTAO);
  const titularMatch = fullText.match(RE_TITULAR);
  const periodoMatch = fullText.match(RE_PERIODO);

  const usos: VtUso[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < allTokens.length - 2; i++) {
    const dataTok = allTokens[i];
    const horaTok = allTokens[i + 1];
    if (!RE_DATA.test(dataTok) || !RE_HORA.test(horaTok)) continue;

    // procura o próximo valor monetário num intervalo de até 12 tokens
    let valorIdx = -1;
    for (let j = i + 2; j < Math.min(i + 14, allTokens.length); j++) {
      if (RE_VALOR.test(allTokens[j])) {
        valorIdx = j;
        break;
      }
      // se cair em outra data, abandona
      if (RE_DATA.test(allTokens[j])) break;
    }
    if (valorIdx < 0) continue;

    const valor = parseValor(allTokens[valorIdx]);
    // linha = token imediatamente anterior ao valor (não é número de leitura puro de 5+ dígitos seguido de outro número)
    const linha = allTokens[valorIdx - 1] ?? "";
    // operadora normalmente está 2 tokens antes da linha (após "VT" ou descrição)
    const operadora = allTokens[valorIdx - 2] ?? "";
    // tipo de tarifa: heurística — pega "VT" ou "VT COMPLEMENTAR" se aparecer entre hora e linha
    let tipo = "";
    for (let k = i + 2; k < valorIdx - 1; k++) {
      const t = allTokens[k];
      if (/^VT$/i.test(t)) {
        tipo = t;
        // verifica se próximo é "COMPLEMENTAR"
        if (/^COMPLEMENTAR$/i.test(allTokens[k + 1] ?? "")) tipo += " COMPLEMENTAR";
      }
    }

    const iso = toIso(dataTok, horaTok);
    const key = `${iso}|${linha}|${valor}`;
    if (seen.has(key)) continue;
    seen.add(key);

    usos.push({
      data_hora: iso,
      linha: linha,
      valor,
      operadora: operadora || undefined,
      tipo_tarifa: tipo || undefined,
    });
  }

  return {
    numeroCartao: cartaoMatch ? cartaoMatch[1].trim() : null,
    titular: titularMatch ? titularMatch[1].trim() : null,
    periodo: periodoMatch ? `${periodoMatch[1]} a ${periodoMatch[2]}` : null,
    usos,
  };
}
