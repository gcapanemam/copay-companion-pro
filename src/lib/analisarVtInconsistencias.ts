// Análise de inconsistências de uso de Vale-Transporte.
// Aplica 4 regras em ordem; a primeira que falhar marca o uso e as demais são puladas.

export type RegraVt =
  | "dia_nao_util"
  | "fora_horario"
  | "linha_repetida_curto_intervalo"
  | "linha_nao_cadastrada"
  | "cadastro_incompleto_jornada"
  | "cadastro_incompleto_linhas";

export interface UsoVt {
  id: string;
  cpf: string | null;
  numero_cartao: string;
  data_hora: string; // ISO
  linha: string | null;
  valor: number;
}

export interface JornadaVt {
  dias_semana: number[]; // 0=dom..6=sab
  entrada_padrao: string | null; // "HH:mm"
  saida_padrao: string | null;
}

export interface VigenciaJornada {
  cpf: string;
  vigencia_inicio: string; // "YYYY-MM-DD"
  vigencia_fim: string | null;
  jornada: JornadaVt;
}

export interface CartaoLinhas {
  numero_cartao: string;
  linhas: string[];
}

export interface CalendarioItem {
  data: string; // "YYYY-MM-DD"
  tipo: "feriado" | "recesso" | "sabado_letivo";
}

export interface FeriasItem {
  cpf: string;
  data_inicio: string;
  data_fim: string;
}

export interface InconsistenciaResultado {
  uso_id: string;
  cpf: string | null;
  numero_cartao: string;
  data_hora: string;
  linha: string | null;
  valor: number;
  regra: RegraVt;
  detalhe: string;
}

const DIAS_NOME = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const toDateStr = (iso: string) => {
  // mantém data local (não UTC) usando string ISO truncada — assumimos timezone local consistente
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const parseHHmm = (s: string | null): number | null => {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
};

const minutosDoDia = (iso: string): number => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const fmtHora = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const dentroPeriodo = (data: string, ini: string, fim: string) =>
  data >= ini && data <= fim;

const acharVigencia = (
  vigencias: VigenciaJornada[],
  cpf: string,
  data: string
): VigenciaJornada | null => {
  const candidatas = vigencias.filter(
    (v) =>
      v.cpf === cpf &&
      v.vigencia_inicio <= data &&
      (!v.vigencia_fim || v.vigencia_fim >= data)
  );
  // pega a mais recente
  candidatas.sort((a, b) => b.vigencia_inicio.localeCompare(a.vigencia_inicio));
  return candidatas[0] || null;
};

export interface AnaliseInput {
  usos: UsoVt[];
  vigencias: VigenciaJornada[];
  cartoes: CartaoLinhas[];
  calendario: CalendarioItem[];
  ferias: FeriasItem[];
}

export function analisarVtInconsistencias(
  input: AnaliseInput
): InconsistenciaResultado[] {
  const { usos, vigencias, cartoes, calendario, ferias } = input;

  // index calendário por data
  const calMap = new Map<string, CalendarioItem["tipo"]>();
  for (const c of calendario) calMap.set(c.data, c.tipo);

  // cartão -> linhas
  const cartaoMap = new Map<string, string[]>();
  for (const c of cartoes) cartaoMap.set(c.numero_cartao, c.linhas || []);

  // ordena usos por (cartao, linha, data) para regra 3
  const usosOrdenadosPorCartaoLinha = [...usos].sort((a, b) => {
    if (a.numero_cartao !== b.numero_cartao)
      return a.numero_cartao.localeCompare(b.numero_cartao);
    const la = a.linha || "";
    const lb = b.linha || "";
    if (la !== lb) return la.localeCompare(lb);
    return a.data_hora.localeCompare(b.data_hora);
  });

  // pré-calcula "uso anterior na mesma linha+cartão"
  const anteriorMap = new Map<string, UsoVt | null>();
  for (let i = 0; i < usosOrdenadosPorCartaoLinha.length; i++) {
    const u = usosOrdenadosPorCartaoLinha[i];
    const prev = usosOrdenadosPorCartaoLinha[i - 1];
    const mesmoBucket =
      prev && prev.numero_cartao === u.numero_cartao && (prev.linha || "") === (u.linha || "");
    anteriorMap.set(u.id, mesmoBucket ? prev : null);
  }

  const resultados: InconsistenciaResultado[] = [];

  for (const u of usos) {
    const dataStr = toDateStr(u.data_hora);
    const dt = new Date(u.data_hora);
    const dow = dt.getDay(); // 0..6

    // ---- Regra 1: dia não útil ----
    const calTipo = calMap.get(dataStr);
    const ehSabadoLetivo = calTipo === "sabado_letivo";
    const ehFimDeSemana = dow === 0 || dow === 6;
    const ehFeriadoOuRecesso = calTipo === "feriado" || calTipo === "recesso";
    const ehFerias =
      u.cpf != null &&
      ferias.some((f) => f.cpf === u.cpf && dentroPeriodo(dataStr, f.data_inicio, f.data_fim));

    if (!ehSabadoLetivo && (ehFimDeSemana || ehFeriadoOuRecesso || ehFerias)) {
      let detalhe = "";
      if (ehFerias) detalhe = "Funcionário em férias";
      else if (calTipo === "feriado") detalhe = "Feriado";
      else if (calTipo === "recesso") detalhe = "Recesso";
      else detalhe = DIAS_NOME[dow];
      resultados.push(mk(u, "dia_nao_util", detalhe));
      continue;
    }

    // ---- Regra 2: fora do horário de trabalho ----
    if (u.cpf) {
      const v = acharVigencia(vigencias, u.cpf, dataStr);
      if (!v) {
        resultados.push(mk(u, "cadastro_incompleto_jornada", "Sem jornada vigente"));
        continue;
      }
      const ent = parseHHmm(v.jornada.entrada_padrao);
      const sai = parseHHmm(v.jornada.saida_padrao);
      if (ent != null && sai != null) {
        const m = minutosDoDia(u.data_hora);
        const min = ent - 60;
        const max = sai + 60;
        if (m < min || m > max) {
          resultados.push(
            mk(
              u,
              "fora_horario",
              `Jornada ${v.jornada.entrada_padrao}–${v.jornada.saida_padrao}, uso às ${fmtHora(u.data_hora)}`
            )
          );
          continue;
        }
      }
      // se não há entrada/saída padrão, pula a regra 2 silenciosamente (jornada flexível)
    } else {
      resultados.push(mk(u, "cadastro_incompleto_jornada", "Cartão sem CPF vinculado"));
      continue;
    }

    // ---- Regra 3: mesma linha em curto intervalo ----
    if (u.linha) {
      const prev = anteriorMap.get(u.id);
      if (prev && prev.linha === u.linha) {
        const diffMin = (new Date(u.data_hora).getTime() - new Date(prev.data_hora).getTime()) / 60000;
        if (diffMin < 60) {
          resultados.push(
            mk(
              u,
              "linha_repetida_curto_intervalo",
              `Linha ${u.linha} usada às ${fmtHora(prev.data_hora)} e ${fmtHora(u.data_hora)} (intervalo ${Math.round(diffMin)} min)`
            )
          );
          continue;
        }
      }
    }

    // ---- Regra 4: linha não cadastrada ----
    const linhasCartao = cartaoMap.get(u.numero_cartao);
    if (!linhasCartao || linhasCartao.length === 0) {
      resultados.push(mk(u, "cadastro_incompleto_linhas", "Cartão sem linhas cadastradas"));
      continue;
    }
    if (u.linha && !linhasCartao.includes(u.linha)) {
      resultados.push(
        mk(
          u,
          "linha_nao_cadastrada",
          `Linha ${u.linha} não está cadastrada para o cartão`
        )
      );
      continue;
    }
  }

  return resultados;
}

function mk(u: UsoVt, regra: RegraVt, detalhe: string): InconsistenciaResultado {
  return {
    uso_id: u.id,
    cpf: u.cpf,
    numero_cartao: u.numero_cartao,
    data_hora: u.data_hora,
    linha: u.linha,
    valor: u.valor,
    regra,
    detalhe,
  };
}

export const ROTULOS_REGRA: Record<RegraVt, string> = {
  dia_nao_util: "Dia não útil",
  fora_horario: "Fora do horário",
  linha_repetida_curto_intervalo: "Linha repetida (<1h)",
  linha_nao_cadastrada: "Linha não cadastrada",
  cadastro_incompleto_jornada: "Cadastro incompleto: jornada",
  cadastro_incompleto_linhas: "Cadastro incompleto: linhas",
};

/**
 * Extrai entrada e saída de um texto livre como:
 *   "9:30 as 19:30"
 *   "7:00 às 13:00"
 *   "07 DA MANHÃ Á 12:00"
 *   "8h às 17h"
 *   "08:00-18:00"
 * Retorna { entrada: "HH:mm", saida: "HH:mm" } ou null se não conseguir.
 *
 * Heurística: extrai todos os horários (com ou sem minutos), com tratamento
 * para "manhã/manha" (AM) e "tarde/noite" (PM, soma 12h se < 12).
 */
export function parseHorarioTrabalho(
  texto: string | null | undefined
): { entrada: string; saida: string } | null {
  if (!texto) return null;
  const t = String(texto).toLowerCase();

  // Captura números de hora opcionalmente seguidos de :MM ou hMM, com possível sufixo am/pm/manha/tarde/noite
  // Ex: "07", "7:00", "8h30", "7:00 da manhã"
  const re =
    /(\d{1,2})(?:[:h](\d{2}))?\s*(?:da\s+)?(manh[aã]|tarde|noite|am|pm)?/g;

  const horarios: Array<{ h: number; m: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(t)) !== null) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const sufixo = match[3];
    if (Number.isNaN(h) || h > 24 || m > 59) continue;
    if (sufixo === "tarde" || sufixo === "noite" || sufixo === "pm") {
      if (h < 12) h += 12;
    }
    if (sufixo === "manha" || sufixo === "manhã" || sufixo === "am") {
      if (h === 12) h = 0;
    }
    if (h === 24) h = 0;
    horarios.push({ h, m });
  }

  if (horarios.length < 2) return null;

  const entrada = horarios[0];
  const saida = horarios[horarios.length - 1];
  const fmt = (x: { h: number; m: number }) =>
    `${String(x.h).padStart(2, "0")}:${String(x.m).padStart(2, "0")}`;
  return { entrada: fmt(entrada), saida: fmt(saida) };
}
