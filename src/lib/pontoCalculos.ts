// Helpers puros de cálculo de jornada e banco de horas (CLT)

export type RegistroLike = {
  data: string;
  entrada_1?: string | null;
  saida_1?: string | null;
  entrada_2?: string | null;
  saida_2?: string | null;
  entrada_3?: string | null;
  saida_3?: string | null;
};

export type JornadaLike = {
  carga_diaria_min: number;
  carga_semanal_min: number;
  intervalo_obrigatorio_min: number;
  tolerancia_min: number;
  dias_semana: number[]; // 0=Dom, 1=Seg ... 6=Sab
  entrada_padrao?: string | null;
  saida_padrao?: string | null;
};

export type MovimentoBanco = {
  minutos: number;
  data_referencia: string;
  expira_em?: string | null;
};

export type CalculoDia = {
  trabalhadas_min: number;
  esperadas_min: number;
  extras_min: number;
  atraso_min: number;
  saida_antecipada_min: number;
  intervalo_min: number;
  saldo_min: number; // trabalhadas - esperadas (com tolerância)
  irregularidades: string[];
  status: "ok" | "atencao" | "irregular" | "folga";
};

export const JORNADA_PADRAO: JornadaLike = {
  carga_diaria_min: 480,
  carga_semanal_min: 2640,
  intervalo_obrigatorio_min: 60,
  tolerancia_min: 10,
  dias_semana: [1, 2, 3, 4, 5],
  entrada_padrao: "08:00",
  saida_padrao: "17:00",
};

const parseHora = (h?: string | null): number | null => {
  if (!h) return null;
  const m = String(h).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const formatMin = (mins: number): string => {
  const sinal = mins < 0 ? "-" : "";
  const a = Math.abs(mins);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sinal}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const minutosParaHHMM = formatMin;

export const aplicarTolerancia = (diff: number, tolerancia: number): number => {
  if (Math.abs(diff) <= tolerancia) return 0;
  return diff;
};

export const calcularJornadaDia = (
  registro: RegistroLike,
  jornada: JornadaLike = JORNADA_PADRAO,
): CalculoDia => {
  const data = new Date(`${registro.data}T12:00:00`);
  const dow = data.getDay();
  const isDiaUtil = jornada.dias_semana.includes(dow);
  const irregularidades: string[] = [];

  const e1 = parseHora(registro.entrada_1);
  const s1 = parseHora(registro.saida_1);
  const e2 = parseHora(registro.entrada_2);
  const s2 = parseHora(registro.saida_2);
  const e3 = parseHora(registro.entrada_3);
  const s3 = parseHora(registro.saida_3);

  let trabalhadas = 0;
  let intervalo = 0;

  if (e1 !== null && s1 !== null && s1 > e1) trabalhadas += s1 - e1;
  if (e2 !== null && s2 !== null && s2 > e2) trabalhadas += s2 - e2;
  if (e3 !== null && s3 !== null && s3 > e3) trabalhadas += s3 - e3;

  if (s1 !== null && e2 !== null && e2 > s1) intervalo += e2 - s1;
  if (s2 !== null && e3 !== null && e3 > s2) intervalo += e3 - s2;

  const esperadas = isDiaUtil ? jornada.carga_diaria_min : 0;

  // Inconsistências
  if (isDiaUtil) {
    if (e1 === null && s1 === null && e2 === null && s2 === null) {
      irregularidades.push("Sem batidas no dia útil");
    }
    if (e1 !== null && s1 === null) irregularidades.push("Falta saída_1");
    if (s1 !== null && e1 === null) irregularidades.push("Falta entrada_1");
    if (e2 !== null && s2 === null) irregularidades.push("Falta saída_2");
    if (s2 !== null && e2 === null) irregularidades.push("Falta entrada_2");

    if (trabalhadas > 360 && intervalo < jornada.intervalo_obrigatorio_min && intervalo > 0) {
      irregularidades.push(`Intervalo abaixo do mínimo (${intervalo}min)`);
    }

    // Atraso
    const entradaPadrao = parseHora(jornada.entrada_padrao);
    if (entradaPadrao !== null && e1 !== null) {
      const atraso = e1 - entradaPadrao;
      if (atraso > jornada.tolerancia_min) {
        irregularidades.push(`Atraso de ${atraso}min`);
      }
    }
  }

  const atraso_min = (() => {
    const entradaPadrao = parseHora(jornada.entrada_padrao);
    if (!isDiaUtil || entradaPadrao === null || e1 === null) return 0;
    const diff = e1 - entradaPadrao;
    return aplicarTolerancia(Math.max(0, diff), jornada.tolerancia_min);
  })();

  const saida_antecipada_min = (() => {
    const saidaPadrao = parseHora(jornada.saida_padrao);
    const ultimaSaida = s3 ?? s2 ?? s1;
    if (!isDiaUtil || saidaPadrao === null || ultimaSaida === null) return 0;
    const diff = saidaPadrao - ultimaSaida;
    return aplicarTolerancia(Math.max(0, diff), jornada.tolerancia_min);
  })();

  const diffBruto = trabalhadas - esperadas;
  const saldo = aplicarTolerancia(diffBruto, jornada.tolerancia_min);
  const extras = Math.max(0, saldo);

  let status: CalculoDia["status"] = "ok";
  if (!isDiaUtil) status = "folga";
  else if (irregularidades.length > 0) status = "irregular";
  else if (saldo < 0) status = "atencao";

  return {
    trabalhadas_min: trabalhadas,
    esperadas_min: esperadas,
    extras_min: extras,
    atraso_min,
    saida_antecipada_min,
    intervalo_min: intervalo,
    saldo_min: saldo,
    irregularidades,
    status,
  };
};

export type SaldoBanco = {
  saldo_min: number;
  credito_min: number;
  debito_min: number;
  prestes_a_expirar_min: number;
};

export const calcularBancoHoras = (
  movimentos: MovimentoBanco[],
  dataRef: Date = new Date(),
): SaldoBanco => {
  let credito = 0;
  let debito = 0;
  let prestesExpirar = 0;
  const limiteAviso = new Date(dataRef);
  limiteAviso.setDate(limiteAviso.getDate() + 30);

  for (const m of movimentos) {
    if (m.minutos > 0) credito += m.minutos;
    else debito += Math.abs(m.minutos);

    if (m.expira_em && m.minutos > 0) {
      const exp = new Date(`${m.expira_em}T00:00:00`);
      if (exp > dataRef && exp <= limiteAviso) prestesExpirar += m.minutos;
    }
  }

  return {
    saldo_min: credito - debito,
    credito_min: credito,
    debito_min: debito,
    prestes_a_expirar_min: prestesExpirar,
  };
};

export const detectarInconsistencias = (
  registro: RegistroLike,
  jornada: JornadaLike = JORNADA_PADRAO,
): string[] => calcularJornadaDia(registro, jornada).irregularidades;

export const corStatus = (status: CalculoDia["status"]): string => {
  switch (status) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "atencao":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "irregular":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "folga":
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const labelStatus = (status: CalculoDia["status"]): string => {
  switch (status) {
    case "ok":
      return "OK";
    case "atencao":
      return "Atenção";
    case "irregular":
      return "Irregular";
    case "folga":
      return "Folga";
  }
};
