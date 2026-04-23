import { useEffect, useMemo, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, RefreshCw, Pencil, Wifi, WifiOff, Clock, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EquipamentoPontoDialog } from "./EquipamentoPontoDialog";

type Equipamento = Database["public"]["Tables"]["equipamentos_ponto"]["Row"];
type RegistroPonto = Database["public"]["Tables"]["registros_ponto"]["Row"];
type SolicitacaoPonto = Database["public"]["Tables"]["solicitacoes_ponto"]["Row"];
type AdmissaoMini = { cpf: string; nome_completo: string | null; unidade: string | null; departamento: string | null };

type LocalSolicitacaoPonto = {
  id: string;
  cpf: string;
  data: string;
  campo: string;
  valor: string;
  tipo: string;
  motivo: string;
  status: string;
  created_at: string;
};

function readLocalSolicitacoesPonto(): LocalSolicitacaoPonto[] {
  try {
    const raw = localStorage.getItem("copay.solicitacoes_ponto.v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LocalSolicitacaoPonto[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSolicitacoesPonto(items: LocalSolicitacaoPonto[]) {
  localStorage.setItem("copay.solicitacoes_ponto.v1", JSON.stringify(items));
}

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
}

function formatTime(v: string | null) {
  if (!v) return "—";
  const t = String(v);
  return t.length >= 5 ? t.slice(0, 5) : t;
}

type PontoAnexo = {
  tipo: "abono_dia" | "abono_horas" | "comprovante";
  horas_abonadas?: string | null;
  dias?: number | null;
  data_inicio?: string | null;
  bucket: string;
  path: string;
  url: string;
  name: string;
  mime: string;
  size: number;
};

function parsePontoAnexoFromMotivo(motivo: string | null): PontoAnexo | null {
  const m = String(motivo || "");
  const idx = m.lastIndexOf("__PONTO_ANEXO__=");
  if (idx < 0) return null;
  const raw = m.slice(idx + "__PONTO_ANEXO__=".length).trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as PontoAnexo;
    if (!parsed || typeof parsed !== "object") return null;
    if (!("url" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function weekdayShort(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00`);
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return days[d.getDay()] || "—";
}

function minutesFromTime(v: string | null) {
  if (!v) return null;
  const parts = String(v).split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

function formatMinutes(total: number | null) {
  if (total === null) return "—";
  const sign = total < 0 ? "-" : "";
  const t = Math.abs(total);
  const hh = String(Math.floor(t / 60)).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

function minutesToHHMM(total: number) {
  const t = Math.max(0, Math.round(total));
  const hh = String(Math.floor(t / 60)).padStart(2, "0");
  const mm = String(t % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function sumPunchMinutes(r: Pick<RegistroPonto, "entrada_1" | "saida_1" | "entrada_2" | "saida_2" | "entrada_3" | "saida_3">) {
  const pairs: Array<[string | null, string | null]> = [
    [r.entrada_1, r.saida_1],
    [r.entrada_2, r.saida_2],
    [r.entrada_3, r.saida_3],
  ];
  let total = 0;
  let hasAny = false;
  for (const [e, s] of pairs) {
    const em = minutesFromTime(e);
    const sm = minutesFromTime(s);
    if (em === null && sm === null) continue;
    hasAny = true;
    if (em === null || sm === null) continue;
    total += Math.max(0, sm - em);
  }
  return hasAny ? total : null;
}

function sumWorkedMinutes(r: RegistroPonto) {
  const credit = minutesFromTime(r.duracao);
  const punches = sumPunchMinutes(r);
  if (credit === null) return punches;
  const base = punches ?? 0;
  return base + Math.max(0, credit);
}

function listDatesInclusive(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const s = start <= end ? start : end;
  const e = start <= end ? end : start;
  const out: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function toMonthValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthRange(monthValue: string): { start: string; end: string } {
  const [yStr, mStr] = String(monthValue || "").split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date();
    const fallback = toMonthValue(now);
    return monthRange(fallback);
  }
  const start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function formatCpf(v: string) {
  const n = normalizeCpf(v);
  if (!n) return "";
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

function isOnline(ultima: string | null) {
  if (!ultima) return false;
  const diff = Date.now() - new Date(ultima).getTime();
  return diff < 24 * 60 * 60 * 1000;
}

function normalizeCpf(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0").slice(-11);
}

function normalizeHost(host: string): string {
  return host.replace(/\s/g, "").replace(/\/+$/, "");
}

function buildBaseUrl(host: string, porta: number | null): string {
  const h = normalizeHost(host);
  if (/^https?:\/\//i.test(h)) return h;
  const p = porta || 443;
  const scheme = p === 80 ? "http" : "https";
  return `${scheme}://${h}:${p}`;
}

type AdmissaoRow = { cpf: string | null; numero_pis: string | null };

type RegistroPontoUpsert = {
  cpf: string;
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  entrada_3: string | null;
  saida_3: string | null;
  duracao: string | null;
  ocorrencia: string | null;
  motivo: string | null;
  equipamento_id: string | null;
  nsr: number | null;
  data_hora: string | null;
  tipo_marcacao: string | null;
};

type AfdMark = { nsr: number; dt: Date; cpf: string; date: string; time: string };

function firstDigits(value: string, len: number): string | null {
  const m = String(value || "").match(new RegExp(`\\d{${len}}`));
  return m ? m[0] : null;
}

async function readResponseTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function summarizeBody(text: string): string {
  const t = String(text || "").trim();
  if (!t) return "";
  return t.length > 300 ? `${t.slice(0, 300)}…` : t;
}

async function localProxyFetch(url: string, init: { method: string; headers: Record<string, string>; body?: unknown }) {
  const res = await fetch("/controlid-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
    }),
  });
  return res;
}

function resolveCpfFromRest(
  rest: string,
  cpfsValidos: Set<string>,
  pisToCpf: Map<string, string>,
  afdPisToCpf: Map<string, string>,
  cpfSuffix9ToCpf: Map<string, string | null>,
): { cpf: string; tipo: "cpf" | "pis" } | null {
  const seqs = [...String(rest || "").matchAll(/\d{9,20}/g)].map((m) => m[0]);
  for (const raw of seqs) {
    const digits = raw.replace(/\D/g, "");

    const tryPis = (pisRaw: string) => {
      const p = String(pisRaw || "").replace(/\D/g, "");
      if (p.length !== 12) return null;
      const pisCandidate = p.startsWith("0") ? p.slice(1) : p;
      const mapped = pisToCpf.get(p) || pisToCpf.get(pisCandidate) || afdPisToCpf.get(p) || afdPisToCpf.get(pisCandidate);
      if (!mapped) return null;
      if (cpfsValidos.size === 0 || cpfsValidos.has(mapped)) return { cpf: mapped, tipo: "pis" as const };
      return null;
    };

    if (digits.length >= 12) {
      const candidates = Array.from(new Set([digits.slice(0, 12), digits.slice(-12), digits.length === 12 ? digits : ""])).filter(Boolean);
      for (const c of candidates) {
        const mapped = tryPis(c);
        if (mapped) return mapped;
      }
    }

    if (digits.length >= 11) {
      const cpfCandidate = normalizeCpf(digits.slice(-11));
      if (!cpfCandidate) continue;
      if (cpfsValidos.size === 0) {
        if (digits.length === 11 || digits.startsWith("0000")) return { cpf: cpfCandidate, tipo: "cpf" };
      } else if (cpfsValidos.has(cpfCandidate)) {
        return { cpf: cpfCandidate, tipo: "cpf" };
      }
    }

    if (digits.length >= 9) {
      const suffix9 = digits.slice(-9);
      const mapped = cpfSuffix9ToCpf.get(suffix9);
      if (mapped && (cpfsValidos.size === 0 || cpfsValidos.has(mapped))) return { cpf: mapped, tipo: "cpf" };
    }
  }
  return null;
}

function parseAfd(afdText: string): Array<{ nsr: number; dt: Date; date: string; time: string; rest: string }> {
  const marks: Array<{ nsr: number; dt: Date; date: string; time: string; rest: string }> = [];
  const lines = afdText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (!trimmed) continue;

    const iso = trimmed.match(/^(\d{9})(\d)(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-\d{4})(.*)$/);
    if (iso) {
      const [, nsr, tipo, ts, rest] = iso;
      if (tipo !== "3") continue;
      const nsrNum = Number(nsr);
      if (!Number.isFinite(nsrNum) || nsrNum <= 0) continue;
      const dt = new Date(ts);
      if (Number.isNaN(dt.getTime())) continue;
      const date = ts.slice(0, 10);
      const time = ts.slice(11, 16);
      marks.push({ nsr: nsrNum, dt, date, time, rest: rest || "" });
      continue;
    }

    const compact = trimmed.match(/^(\d{9})(\d)(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(.*)$/);
    if (compact) {
      const [, nsr, tipo, dd, mm, yyyy, hh, mi, ss, rest] = compact;
      if (tipo !== "3") continue;
      const ddNum = Number(dd);
      const mmNum = Number(mm);
      if (ddNum < 1 || ddNum > 31 || mmNum < 1 || mmNum > 12) continue;
      const nsrNum = Number(nsr);
      if (!Number.isFinite(nsrNum) || nsrNum <= 0) continue;
      const dt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}-03:00`);
      if (Number.isNaN(dt.getTime())) continue;
      const date = `${yyyy}-${mm}-${dd}`;
      const time = `${hh}:${mi}`;
      marks.push({ nsr: nsrNum, dt, date, time, rest: rest || "" });
      continue;
    }
  }
  return marks;
}

function groupMarksIntoDailyRecords(
  marks: AfdMark[],
  equipamentoId: string,
  existingByKey: Map<string, RegistroPonto>,
): { records: RegistroPontoUpsert[]; maiorNsr: number } {
  let maiorNsr = 0;
  const byKey = new Map<string, AfdMark[]>();
  for (const m of marks) {
    if (m.nsr > maiorNsr) maiorNsr = m.nsr;
    const key = `${m.cpf}__${m.date}`;
    const arr = byKey.get(key) || [];
    arr.push(m);
    byKey.set(key, arr);
  }

  const records: RegistroPontoUpsert[] = [];
  for (const [key, arr] of byKey.entries()) {
    const [cpf, data] = key.split("__");
    const existing = existingByKey.get(key) || null;
    const sortedNew = [...arr].sort((a, b) => a.dt.getTime() - b.dt.getTime());
    const newTimes = sortedNew.map((x) => x.time);

    const existingTimes = existing
      ? [
          existing.entrada_1,
          existing.saida_1,
          existing.entrada_2,
          existing.saida_2,
          existing.entrada_3,
          existing.saida_3,
        ].map((t) => (t ? String(t).slice(0, 5) : null))
      : [null, null, null, null, null, null];

    let merged: Array<string | null>;
    if (existing && existing.tipo_marcacao) {
      const used = new Set(existingTimes.filter(Boolean) as string[]);
      const add = newTimes.filter((t) => t && !used.has(t));
      const addSorted = add
        .map((t) => ({ t, m: minutesFromTime(`${t}:00`) ?? 0 }))
        .sort((a, b) => a.m - b.m)
        .map((x) => x.t);
      merged = [...existingTimes];
      for (const t of addSorted) {
        const idx = merged.findIndex((x) => !x);
        if (idx < 0) break;
        merged[idx] = t;
      }
    } else {
      const all = [...(existingTimes.filter(Boolean) as string[]), ...newTimes]
        .map((t) => String(t).slice(0, 5))
        .filter(Boolean);
      const uniq = Array.from(new Set(all));
      merged = uniq
        .map((t) => ({ t, m: minutesFromTime(`${t}:00`) ?? 0 }))
        .sort((a, b) => a.m - b.m)
        .map((x) => x.t)
        .slice(0, 6);
      while (merged.length < 6) merged.push(null);
    }

    const pick = (i: number) => (merged[i] ? `${merged[i]}:00` : null);
    const lastNew = sortedNew.reduce((acc, cur) => (cur.nsr > acc.nsr ? cur : acc), sortedNew[0]);
    const existingDt = existing?.data_hora ? new Date(existing.data_hora) : null;
    const lastDt = existingDt && !Number.isNaN(existingDt.getTime()) && existingDt > lastNew.dt ? existingDt : lastNew.dt;
    records.push({
      cpf,
      data,
      entrada_1: pick(0),
      saida_1: pick(1),
      entrada_2: pick(2),
      saida_2: pick(3),
      entrada_3: pick(4),
      saida_3: pick(5),
      duracao: existing?.duracao ?? null,
      ocorrencia: existing?.ocorrencia ?? null,
      motivo: existing?.motivo ?? null,
      equipamento_id: equipamentoId,
      nsr: Math.max(existing?.nsr ?? 0, lastNew?.nsr ?? 0) || (lastNew?.nsr ?? null),
      data_hora: lastDt ? lastDt.toISOString() : null,
      tipo_marcacao: existing?.tipo_marcacao ?? null,
    });
  }

  return { records, maiorNsr };
}

export function AdminPontoEletronico() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Equipamento | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [tabRegistros, setTabRegistros] = useState<"lista" | "calendario" | "solicitacoes">("lista");
  const [filtroEquipamento, setFiltroEquipamento] = useState<string>("__all__");
  const [busca, setBusca] = useState<string>("");
  const [dataDe, setDataDe] = useState<string>("");
  const [dataAte, setDataAte] = useState<string>("");
  const [calCpf, setCalCpf] = useState<string>("");
  const [calBuscaFuncionario, setCalBuscaFuncionario] = useState<string>("");
  const [calMes, setCalMes] = useState<string>(() => toMonthValue(new Date()));
  const [calMesAutoCpf, setCalMesAutoCpf] = useState<string>("");
  const [solStatus, setSolStatus] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const [solFonte, setSolFonte] = useState<"todos" | "remoto" | "local">("todos");
  const [solProcessingId, setSolProcessingId] = useState<string | null>(null);
  const [solLocalVersion, setSolLocalVersion] = useState(0);
  const [solicitacoesEnabled, setSolicitacoesEnabled] = useState(true);
  const [solicitacoesMode, setSolicitacoesMode] = useState<"remote" | "local">("remote");

  const { data: equipamentos = [], isLoading: loadingEquip } = useQuery({
    queryKey: ["equipamentos_ponto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_ponto")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Equipamento[];
    },
  });

  const ativos = useMemo(() => equipamentos.filter((e) => e.ativo), [equipamentos]);
  const equipamentoNomeById = useMemo(() => new Map(equipamentos.map((e) => [e.id, e.nome])), [equipamentos]);

  const { data: funcionariosMini = [] } = useQuery({
    queryKey: ["admissoes_mini_ponto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissoes")
        .select("cpf, nome_completo, unidade, departamento")
        .order("nome_completo", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return ((data || []) as Array<{ cpf: string | null; nome_completo: string | null; unidade: string | null; departamento: string | null }>)
        .map((f) => ({ ...f, cpf: normalizeCpf(f.cpf) }))
        .filter((f) => Boolean(f.cpf)) as AdmissaoMini[];
    },
  });

  const funcionarioSelecionado = useMemo(() => {
    const cpf = normalizeCpf(calCpf);
    if (!cpf) return null;
    return funcionariosMini.find((f) => normalizeCpf(f.cpf) === cpf) || null;
  }, [calCpf, funcionariosMini]);

  const sugestoesFuncionario = useMemo(() => {
    const term = calBuscaFuncionario.trim().toLowerCase();
    const cpfDigits = calBuscaFuncionario.replace(/\D/g, "");
    if (!term && !cpfDigits) return [];
    return funcionariosMini
      .filter((f) => {
        if (cpfDigits) return normalizeCpf(f.cpf).includes(cpfDigits);
        return (f.nome_completo || "").toLowerCase().includes(term);
      })
      .slice(0, 10);
  }, [calBuscaFuncionario, funcionariosMini]);

  type RegistroView = RegistroPonto & {
    cpf: string;
    nome_completo: string | null;
    unidade: string | null;
    departamento: string | null;
  };

  const { data: registros = [], isLoading: loadingRegistros } = useQuery({
    queryKey: ["registros_ponto", filtroEquipamento, dataDe, dataAte],
    queryFn: async () => {
      let q = supabase
        .from("registros_ponto")
        .select("*")
        .order("data", { ascending: false })
        .order("cpf", { ascending: true })
        .limit(500);

      if (filtroEquipamento !== "__all__") q = q.eq("equipamento_id", filtroEquipamento);
      if (dataDe) q = q.gte("data", dataDe);
      if (dataAte) q = q.lte("data", dataAte);

      const { data, error } = await q;
      if (error) throw error;
      const rows = ((data || []) as RegistroPonto[]).map((r) => ({ ...r, cpf: normalizeCpf(r.cpf) }));
      const cpfs = Array.from(new Set(rows.map((r) => r.cpf).filter(Boolean)));

      let admMap = new Map<string, AdmissaoMini>();
      if (cpfs.length > 0) {
        const { data: adms, error: admErr } = await supabase
          .from("admissoes")
          .select("cpf, nome_completo, unidade, departamento")
          .in("cpf", cpfs);
        if (admErr) throw admErr;
        admMap = new Map(
          (adms || []).map((a) => {
            const cpf = normalizeCpf(a.cpf);
            return [
              cpf,
              {
                cpf,
                nome_completo: a.nome_completo ?? null,
                unidade: a.unidade ?? null,
                departamento: a.departamento ?? null,
              },
            ];
          }),
        );
      }

      return rows.map((r) => {
        const adm = admMap.get(r.cpf);
        return {
          ...(r as RegistroPonto),
          cpf: r.cpf,
          nome_completo: adm?.nome_completo ?? null,
          unidade: adm?.unidade ?? null,
          departamento: adm?.departamento ?? null,
        } satisfies RegistroView;
      });
    },
  });

  const registrosFiltrados = useMemo(() => {
    const term = busca.trim().toLowerCase();
    if (!term) return registros;
    const cpfTerm = busca.replace(/\D/g, "");
    return registros.filter((r) => {
      if (cpfTerm) return r.cpf.includes(cpfTerm);
      return (r.nome_completo || "").toLowerCase().includes(term);
    });
  }, [registros, busca]);

  const calCpfNorm = useMemo(() => normalizeCpf(calCpf), [calCpf]);

  const calendarioPeriodo = useMemo(() => {
    const fallback = monthRange(calMes);
    const start = (dataDe || fallback.start).slice(0, 10);
    const end = (dataAte || fallback.end).slice(0, 10);
    return start <= end ? { start, end } : { start: end, end: start };
  }, [dataDe, dataAte, calMes]);

  const calendarioDias = useMemo(
    () => listDatesInclusive(calendarioPeriodo.start, calendarioPeriodo.end),
    [calendarioPeriodo.start, calendarioPeriodo.end],
  );

  const funcionariosComRegistro = useMemo(() => {
    const byCpf = new Map<string, AdmissaoMini>();
    for (const r of registrosFiltrados) {
      const cpf = normalizeCpf(r.cpf);
      if (!cpf) continue;
      if (byCpf.has(cpf)) continue;
      byCpf.set(cpf, {
        cpf,
        nome_completo: r.nome_completo ?? null,
        unidade: r.unidade ?? null,
        departamento: r.departamento ?? null,
      });
    }
    return Array.from(byCpf.values()).sort((a, b) => (a.nome_completo || a.cpf).localeCompare(b.nome_completo || b.cpf, "pt-BR"));
  }, [registrosFiltrados]);

  const sugestoesFuncionarioCalendario = useMemo(() => {
    const term = calBuscaFuncionario.trim().toLowerCase();
    const cpfDigits = calBuscaFuncionario.replace(/\D/g, "");
    if (!term && !cpfDigits) return [];
    return funcionariosComRegistro
      .filter((f) => {
        if (cpfDigits) return normalizeCpf(f.cpf).includes(cpfDigits);
        return (f.nome_completo || "").toLowerCase().includes(term);
      })
      .slice(0, 10);
  }, [calBuscaFuncionario, funcionariosComRegistro]);

  const resolveCpfCalendarioFromInput = (raw: string) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length >= 11) {
      const cpf = normalizeCpf(digits);
      return funcionariosComRegistro.some((f) => f.cpf === cpf) ? cpf : null;
    }
    const matches = funcionariosComRegistro.filter((f) => f.cpf.endsWith(digits));
    if (matches.length === 1) return matches[0].cpf;
    return null;
  };

  const registrosCalendario = useMemo(() => {
    if (!calCpfNorm) return [];
    const { start, end } = calendarioPeriodo;
    return registrosFiltrados.filter((r) => r.cpf === calCpfNorm && r.data >= start && r.data <= end) as RegistroPonto[];
  }, [registrosFiltrados, calCpfNorm, calendarioPeriodo]);

  const ultimoDiaCpf = useMemo(() => {
    if (!calCpfNorm) return null;
    let max: string | null = null;
    for (const r of registrosFiltrados) {
      if (r.cpf !== calCpfNorm) continue;
      const d = String(r.data || "").slice(0, 10);
      if (!d) continue;
      if (!max || d > max) max = d;
    }
    return max;
  }, [registrosFiltrados, calCpfNorm]);

  useEffect(() => {
    if (!calCpfNorm) return;
    if (!ultimoDiaCpf) return;
    if (calMesAutoCpf === calCpfNorm) return;
    setCalMes(ultimoDiaCpf.slice(0, 7));
    setCalMesAutoCpf(calCpfNorm);
  }, [calCpfNorm, ultimoDiaCpf, calMesAutoCpf]);

  useEffect(() => {
    if (tabRegistros !== "calendario") return;
    if (normalizeCpf(calCpf)) return;
    if (funcionariosComRegistro.length === 0) return;
    const first = funcionariosComRegistro[0];
    setCalCpf(first.cpf);
    setCalBuscaFuncionario(`${first.nome_completo || "—"} • ${formatCpf(first.cpf)}`);
  }, [tabRegistros, calCpf, funcionariosComRegistro]);

  const calendarioMap = useMemo(() => {
    const m = new Map<string, RegistroPonto>();
    for (const r of registrosCalendario) {
      const key = String(r.data || "").slice(0, 10);
      if (key) m.set(key, r);
    }
    return m;
  }, [registrosCalendario]);

  type SolicitacaoBase = Pick<
    SolicitacaoPonto,
    | "id"
    | "cpf"
    | "data"
    | "campo"
    | "valor"
    | "tipo"
    | "motivo"
    | "status"
    | "created_at"
    | "aprovado_em"
    | "aprovado_por"
    | "rejeitado_em"
    | "rejeitado_por"
    | "observacao_admin"
  >;

  type SolicitacaoView = SolicitacaoBase & {
    cpf_norm: string;
    nome_completo: string | null;
    unidade: string | null;
    departamento: string | null;
    source: "remote" | "local";
  };

  const { data: solicitacoes = [], isLoading: loadingSolicitacoes } = useQuery({
    queryKey: ["solicitacoes_ponto", solStatus, solFonte, solLocalVersion],
    queryFn: async () => {
      const runLocal = () => {
        const local = readLocalSolicitacoesPonto()
          .filter((s) => s.status === solStatus)
          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""), "pt-BR"))
          .slice(0, 200);
        const baseRows: Array<SolicitacaoBase & { source: "local" }> = local.map((s) => ({
          id: s.id,
          cpf: s.cpf,
          data: s.data,
          campo: s.campo,
          valor: s.valor,
          tipo: s.tipo,
          motivo: s.motivo,
          status: s.status,
          created_at: s.created_at,
          aprovado_em: null,
          aprovado_por: null,
          rejeitado_em: null,
          rejeitado_por: null,
          observacao_admin: null,
          source: "local",
        }));
        return baseRows;
      };

      const runRemote = async () => {
        const { data, error } = await supabase
          .from("solicitacoes_ponto")
          .select("*")
          .eq("status", solStatus)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) {
          const m = String(error.message || "").toLowerCase();
          const missing = m.includes("solicitacoes_ponto") && (m.includes("could not find the table") || m.includes("schema cache"));
          if (missing) {
            setSolicitacoesEnabled(false);
            setSolicitacoesMode("local");
            return [] as Array<SolicitacaoPonto & { source: "remote" }>;
          }
          throw error;
        }
        if (!solicitacoesEnabled) setSolicitacoesEnabled(true);
        if (solicitacoesMode !== "remote") setSolicitacoesMode("remote");
        return ((data || []) as SolicitacaoPonto[]).map((s) => ({ ...s, source: "remote" as const }));
      };

      const localRows = solFonte !== "remoto" ? runLocal() : [];
      const remoteRows = solFonte !== "local" ? await runRemote() : [];

      const mergedByKey = new Map<string, SolicitacaoBase & { source: "remote" | "local" }>();
      for (const s of remoteRows) mergedByKey.set(`remote:${s.id}`, s);
      for (const s of localRows) mergedByKey.set(`local:${s.id}`, s);
      const merged = Array.from(mergedByKey.values()).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""), "pt-BR"));

      const cpfs = Array.from(new Set(merged.map((r) => normalizeCpf(r.cpf)).filter(Boolean)));
      let admMap = new Map<string, AdmissaoMini>();
      if (cpfs.length > 0) {
        const { data: adms, error: admErr } = await supabase
          .from("admissoes")
          .select("cpf, nome_completo, unidade, departamento")
          .in("cpf", cpfs);
        if (admErr) throw admErr;
        admMap = new Map(
          (adms || []).map((a) => {
            const cpf = normalizeCpf(a.cpf);
            return [
              cpf,
              {
                cpf,
                nome_completo: a.nome_completo ?? null,
                unidade: a.unidade ?? null,
                departamento: a.departamento ?? null,
              },
            ];
          }),
        );
      }
      return merged.map((s) => {
        const cpf_norm = normalizeCpf(s.cpf);
        const adm = admMap.get(cpf_norm);
        return {
          ...s,
          cpf_norm,
          nome_completo: adm?.nome_completo ?? null,
          unidade: adm?.unidade ?? null,
          departamento: adm?.departamento ?? null,
          source: s.source,
        } satisfies SolicitacaoView;
      });
    },
  });

  const applyToRegistros = async (s: SolicitacaoView) => {
    const allowed = new Set(["entrada_1", "saida_1", "entrada_2", "saida_2", "entrada_3", "saida_3"]);
    const campo = String(s.campo || "").trim();
    if (!allowed.has(campo)) throw new Error("Campo inválido");
    const cpfNorm = normalizeCpf(s.cpf_norm || s.cpf);
    const suffix9 = cpfNorm.slice(-9);
    const dia = String(s.data || "").slice(0, 10);
    if (!cpfNorm || !suffix9 || !dia) throw new Error("CPF/Data inválidos");
    const rawValor = String(s.valor || "").trim();
    const valor = /^\d{2}:\d{2}$/.test(rawValor) ? `${rawValor}:00` : rawValor;

    const { data: rows, error: findErr } = await supabase
      .from("registros_ponto")
      .select("*")
      .like("cpf", `%${suffix9}`)
      .eq("data", dia)
      .limit(50);
    if (findErr) throw findErr;
    const candidates = (rows || []) as RegistroPonto[];
    const exact = candidates.find((r) => normalizeCpf(r.cpf) === cpfNorm) || null;
    const best =
      exact ||
      [...candidates].sort((a, b) => String(b.cpf || "").replace(/\D/g, "").length - String(a.cpf || "").replace(/\D/g, "").length)[0] ||
      null;

    const baseMotivo = String(s.motivo || "").trim();
    const motivo = best?.motivo ? `${best.motivo}\nAjuste aprovado: ${baseMotivo}` : `Ajuste aprovado: ${baseMotivo}`;
    const payload = {
      cpf: best?.cpf || cpfNorm,
      data: dia,
      entrada_1: best?.entrada_1 ?? null,
      saida_1: best?.saida_1 ?? null,
      entrada_2: best?.entrada_2 ?? null,
      saida_2: best?.saida_2 ?? null,
      entrada_3: best?.entrada_3 ?? null,
      saida_3: best?.saida_3 ?? null,
      nsr: best?.nsr ?? null,
      equipamento_id: best?.equipamento_id ?? null,
      data_hora: best?.data_hora ?? null,
      tipo_marcacao: "ajuste",
      ocorrencia: "Ajuste aprovado",
      motivo,
      [campo]: valor,
    } as unknown as Record<string, unknown>;

    if (best?.id) {
      const { error: updErr } = await supabase.from("registros_ponto").update(payload).eq("id", best.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("registros_ponto").insert(payload);
      if (insErr) throw insErr;
    }
  };

  const applyAtestadoToRegistros = async (s: SolicitacaoView) => {
    const cpfNorm = normalizeCpf(s.cpf_norm || s.cpf);
    const suffix9 = cpfNorm.slice(-9);
    const dia = String(s.data || "").slice(0, 10);
    if (!cpfNorm || !suffix9 || !dia) throw new Error("CPF/Data inválidos");

    const anexo = parsePontoAnexoFromMotivo(s.motivo);
    const tipo = (anexo?.tipo || String(s.tipo || "").trim()) as "abono_dia" | "abono_horas" | "comprovante";
    if (!["abono_dia", "abono_horas", "comprovante"].includes(tipo)) throw new Error("Tipo de atestado inválido");

    const { data: rows, error: findErr } = await supabase
      .from("registros_ponto")
      .select("*")
      .like("cpf", `%${suffix9}`)
      .eq("data", dia)
      .limit(50);
    if (findErr) throw findErr;
    const candidates = (rows || []) as RegistroPonto[];
    const exact = candidates.find((r) => normalizeCpf(r.cpf) === cpfNorm) || null;
    const best =
      exact ||
      [...candidates].sort((a, b) => String(b.cpf || "").replace(/\D/g, "").length - String(a.cpf || "").replace(/\D/g, "").length)[0] ||
      null;

    const baseMotivo = String(s.motivo || "").trim();
    const motivo = best?.motivo ? `${best.motivo}\nAtestado aprovado: ${baseMotivo}` : `Atestado aprovado: ${baseMotivo}`;

    const worked = best ? sumPunchMinutes(best) : 0;
    let creditMinutes: number | null = null;
    if (tipo === "abono_dia") {
      const base = 8 * 60;
      creditMinutes = Math.max(0, base - Math.max(0, worked ?? 0));
    } else if (tipo === "abono_horas") {
      const m = minutesFromTime(anexo?.horas_abonadas ?? String(s.valor || ""));
      if (m === null) throw new Error("Horas abonadas inválidas");
      creditMinutes = Math.max(0, m);
    } else {
      creditMinutes = null;
    }

    const duracao = creditMinutes && creditMinutes > 0 ? minutesToHHMM(creditMinutes) : null;
    const payload = {
      cpf: best?.cpf || cpfNorm,
      data: dia,
      entrada_1: best?.entrada_1 ?? null,
      saida_1: best?.saida_1 ?? null,
      entrada_2: best?.entrada_2 ?? null,
      saida_2: best?.saida_2 ?? null,
      entrada_3: best?.entrada_3 ?? null,
      saida_3: best?.saida_3 ?? null,
      nsr: best?.nsr ?? null,
      equipamento_id: best?.equipamento_id ?? null,
      data_hora: best?.data_hora ?? null,
      tipo_marcacao: "atestado",
      ocorrencia: tipo === "comprovante" ? "Comprovante aprovado" : "Atestado aprovado",
      motivo,
      duracao,
    } satisfies Record<string, unknown>;

    if (best?.id) {
      const { error: updErr } = await supabase.from("registros_ponto").update(payload).eq("id", best.id);
      if (updErr) throw updErr;
    } else {
      const { error: insErr } = await supabase.from("registros_ponto").insert(payload);
      if (insErr) throw insErr;
    }
  };

  const handleApprove = async (s: SolicitacaoView) => {
    setSolProcessingId(s.id);
    try {
      const allowed = new Set(["entrada_1", "saida_1", "entrada_2", "saida_2", "entrada_3", "saida_3"]);
      if (allowed.has(String(s.campo || "").trim())) {
        await applyToRegistros(s);
        qc.invalidateQueries({ queryKey: ["registros_ponto"] });
      }
      if (String(s.campo || "").trim() === "atestado") {
        await applyAtestadoToRegistros(s);
        qc.invalidateQueries({ queryKey: ["registros_ponto"] });
      }
      if (s.source === "local") {
        const all = readLocalSolicitacoesPonto();
        const next = all.map((x) => (x.id === s.id ? { ...x, status: "aprovado" } : x));
        writeLocalSolicitacoesPonto(next);
        setSolLocalVersion((v) => v + 1);
      } else {
        const { error: solErr } = await supabase
          .from("solicitacoes_ponto")
          .update({ status: "aprovado", aprovado_em: new Date().toISOString(), aprovado_por: "admin" })
          .eq("id", s.id);
        if (solErr) throw solErr;
      }
      toast({ title: "Solicitação aprovada", description: `${formatDate(String(s.data))} • ${s.nome_completo || formatCpf(s.cpf_norm)}` });
      qc.invalidateQueries({ queryKey: ["solicitacoes_ponto"] });
    } catch (e: unknown) {
      toast({ title: "Falha ao aprovar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSolProcessingId(null);
    }
  };

  const handleReject = async (s: SolicitacaoView) => {
    setSolProcessingId(s.id);
    try {
      if (s.source === "local") {
        const all = readLocalSolicitacoesPonto();
        const next = all.map((x) => (x.id === s.id ? { ...x, status: "rejeitado" } : x));
        writeLocalSolicitacoesPonto(next);
        setSolLocalVersion((v) => v + 1);
      } else {
        const { error } = await supabase
          .from("solicitacoes_ponto")
          .update({ status: "rejeitado", rejeitado_em: new Date().toISOString(), rejeitado_por: "admin" })
          .eq("id", s.id);
        if (error) throw error;
      }
      toast({ title: "Solicitação rejeitada" });
      qc.invalidateQueries({ queryKey: ["solicitacoes_ponto"] });
    } catch (e: unknown) {
      toast({ title: "Falha ao rejeitar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSolProcessingId(null);
    }
  };

  const syncEquipamento = async (equip: Equipamento) => {
    if (!equip.host) throw new Error("Host/URL não configurado");
    const baseUrl = buildBaseUrl(equip.host, equip.porta);
    const usuario = equip.usuario || "admin";
    const initialNsr = Number(equip.ultimo_nsr || 0) + 1;

    const { data: senhaPlana, error: senhaErr } = await supabase.rpc("obter_senha_equipamento", { p_id: equip.id });
    if (senhaErr) throw senhaErr;
    const senha = String(senhaPlana || "");
    if (!senha) throw new Error("Senha não configurada");

    const loginUrl = `${baseUrl}/login.fcgi`;
    const loginInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: { login: usuario, password: senha },
    };
    let loginRes: Response;
    try {
      loginRes = await localProxyFetch(loginUrl, loginInit);
    } catch {
      loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: loginInit.headers,
        body: JSON.stringify(loginInit.body),
        credentials: "include",
      });
    }
    if (!loginRes.ok) {
      const body = summarizeBody(await readResponseTextSafe(loginRes));
      throw new Error(`Login falhou: HTTP ${loginRes.status}${body ? ` — ${body}` : ""}`);
    }
    const loginJson = (await loginRes.json().catch(() => ({}))) as { session?: string };
    const session = loginJson.session;
    if (!session) throw new Error("Sessão não retornada pelo equipamento");

    let afdText = "";
    const candidates: Array<{ label: string; url: string; method: "GET" | "POST"; body?: unknown }> = [
      {
        label: "POST get_afd (full + session query)",
        url: `${baseUrl}/get_afd.fcgi?session=${encodeURIComponent(session)}&mode=full`,
        method: "POST",
        body: { initial_nsr: initialNsr },
      },
      {
        label: "GET get_afd (full + session query)",
        url: `${baseUrl}/get_afd.fcgi?session=${encodeURIComponent(session)}&mode=full`,
        method: "GET",
      },
      {
        label: "POST get_afd (complete + session query)",
        url: `${baseUrl}/get_afd.fcgi?session=${encodeURIComponent(session)}&mode=complete`,
        method: "POST",
        body: { initial_nsr: initialNsr },
      },
      {
        label: "GET get_afd (complete + session query)",
        url: `${baseUrl}/get_afd.fcgi?session=${encodeURIComponent(session)}&mode=complete`,
        method: "GET",
      },
      {
        label: "POST get_afd (full no query, cookie)",
        url: `${baseUrl}/get_afd.fcgi?mode=full`,
        method: "POST",
        body: { initial_nsr: initialNsr },
      },
      {
        label: "GET get_afd (full no query, cookie)",
        url: `${baseUrl}/get_afd.fcgi?mode=full`,
        method: "GET",
      },
    ];

    let lastErr = "";
    for (const c of candidates) {
      try {
        const headers = {
          ...(c.method === "POST" ? { "Content-Type": "application/json" } : {}),
          "Accept": "text/plain,*/*",
        };
        let res: Response;
        try {
          res = await localProxyFetch(c.url, { method: c.method, headers, body: c.body });
        } catch {
          res = await fetch(c.url, {
            method: c.method,
            headers,
            body: c.method === "POST" ? JSON.stringify(c.body ?? {}) : undefined,
            credentials: "include",
          });
        }
        if (!res.ok) {
          const body = summarizeBody(await readResponseTextSafe(res));
          lastErr = `${c.label}: HTTP ${res.status}${body ? ` — ${body}` : ""}`;
          continue;
        }
        const t = await res.text();
        if (t && t.trim().length > 0) {
          afdText = t;
          break;
        }
        lastErr = `${c.label}: resposta vazia`;
      } catch (e: unknown) {
        lastErr = `${c.label}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    if (!afdText.trim()) throw new Error(`Não foi possível baixar o AFD. ${lastErr ? `(${lastErr})` : ""}`);

    if (!afdText.trim()) return { diasImportados: 0, marcacoesLidas: 0, cpfsNaoEncontrados: 0, maiorNsr: Number(equip.ultimo_nsr || 0) };

    const afdPisToCpf = new Map<string, string>();
    for (const line of afdText.split(/\r?\n/)) {
      const t = String(line || "").trim();
      if (!t) continue;
      const pisMatch = t.match(/[IA](\d{12})/);
      if (!pisMatch) continue;
      const pis = pisMatch[1];
      const start = (pisMatch.index ?? 0) + pisMatch[0].length;
      const tailDigits = t.slice(start).replace(/\D/g, "");
      const cpfCandidate = normalizeCpf(tailDigits.slice(-11));
      if (pis && cpfCandidate) {
        afdPisToCpf.set(pis, cpfCandidate);
        if (pis.startsWith("0")) afdPisToCpf.set(pis.slice(1), cpfCandidate);
      }
    }

    const { data: admissoes } = await supabase.from("admissoes").select("cpf, numero_pis");
    const cpfsValidos = new Set<string>();
    const pisToCpf = new Map<string, string>();
    (admissoes as AdmissaoRow[] | null || []).forEach((a) => {
      const c = normalizeCpf(a.cpf);
      if (c) cpfsValidos.add(c);
      const pis = String(a.numero_pis ?? "").replace(/\D/g, "");
      if (pis && c) pisToCpf.set(pis, c);
    });
    const cpfSuffix9ToCpf = new Map<string, string | null>();
    for (const cpf of cpfsValidos) {
      const suffix9 = cpf.slice(-9);
      const existing = cpfSuffix9ToCpf.get(suffix9);
      if (existing && existing !== cpf) cpfSuffix9ToCpf.set(suffix9, null);
      else if (existing === undefined) cpfSuffix9ToCpf.set(suffix9, cpf);
    }

    const parsed = parseAfd(afdText);
    if (parsed.length === 0) {
      const preview = summarizeBody(afdText);
      const hint = preview ? `Conteúdo recebido: ${preview}` : "Conteúdo vazio";
      throw new Error(`AFD retornou conteúdo em formato inesperado. ${hint}`);
    }
    const marks: AfdMark[] = [];
    let cpfsNaoEncontrados = 0;
    let cpfResolvido = 0;
    let pisResolvido = 0;
    for (const p of parsed) {
      const resolved = resolveCpfFromRest(p.rest, cpfsValidos, pisToCpf, afdPisToCpf, cpfSuffix9ToCpf);
      if (!resolved) {
        cpfsNaoEncontrados++;
        continue;
      }
      if (resolved.tipo === "cpf") cpfResolvido++;
      else pisResolvido++;
      marks.push({ nsr: p.nsr, dt: p.dt, cpf: resolved.cpf, date: p.date, time: p.time });
    }

    const existingByKey = new Map<string, RegistroPonto>();
    if (marks.length > 0) {
      const cpfs = Array.from(new Set(marks.map((m) => m.cpf)));
      const dates = marks.map((m) => m.date).filter(Boolean).sort();
      const minDate = dates[0] || "";
      const maxDate = dates[dates.length - 1] || "";
      for (let i = 0; i < cpfs.length; i += 200) {
        const chunk = cpfs.slice(i, i + 200);
        let q = supabase.from("registros_ponto").select("*").in("cpf", chunk);
        if (minDate) q = q.gte("data", minDate);
        if (maxDate) q = q.lte("data", maxDate);
        const { data, error } = await q;
        if (error) throw error;
        (data as RegistroPonto[] | null || []).forEach((r) => {
          const cpf = normalizeCpf(r.cpf || "");
          const dataIso = String(r.data || "").slice(0, 10);
          if (!cpf || !dataIso) return;
          existingByKey.set(`${cpf}__${dataIso}`, r);
        });
      }
    }

    const { records, maiorNsr } = groupMarksIntoDailyRecords(marks, equip.id, existingByKey);
    if (records.length === 0) {
      const dica = cpfsValidos.size === 0
        ? "Nenhum funcionário encontrado na tabela de admissões."
        : "Nenhuma marcação mapeou para CPFs/PIS cadastrados em admissões.";
      throw new Error(
        `Nenhum registro gerado. Linhas AFD: ${parsed.length} • Marcações válidas: ${marks.length} • Não mapeadas: ${cpfsNaoEncontrados}. ${dica}`,
      );
    }

    for (let i = 0; i < records.length; i += 200) {
      const batch = records.slice(i, i + 200);
      const { error } = await supabase
        .from("registros_ponto")
        .upsert(batch, { onConflict: "cpf,data" });
      if (error) throw error;
    }

    const { error: updErr } = await supabase
      .from("equipamentos_ponto")
      .update({ ultimo_nsr: maiorNsr, ultima_sincronizacao: new Date().toISOString() })
      .eq("id", equip.id);
    if (updErr) throw updErr;

    return {
      diasImportados: records.length,
      marcacoesLidas: marks.length,
      cpfsNaoEncontrados,
      maiorNsr,
      cpfResolvido,
      pisResolvido,
    };
  };

  const handleSync = async (equipamentoId: string | null) => {
    const targets = equipamentoId ? ativos.filter((e) => e.id === equipamentoId) : ativos;
    if (targets.length === 0) {
      toast({ title: "Nenhum equipamento ativo encontrado", variant: "destructive" });
      return;
    }
    setSyncingId(equipamentoId || "all");
    try {
      let totalDias = 0;
      let totalMarcacoes = 0;
      let totalNaoMapeadas = 0;
      for (const e of targets) {
        const r = await syncEquipamento(e);
        totalDias += r.diasImportados;
        totalMarcacoes += r.marcacoesLidas;
        totalNaoMapeadas += r.cpfsNaoEncontrados;
      }
      toast({
        title: "Sincronização concluída",
        description: `${totalDias} dia(s) importado(s) • ${totalMarcacoes} marcação(ões)` + (totalNaoMapeadas ? ` • ${totalNaoMapeadas} não mapeada(s)` : ""),
      });
      qc.invalidateQueries({ queryKey: ["equipamentos_ponto"] });
      qc.invalidateQueries({ queryKey: ["registros_ponto"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const dica = "O portal precisa estar acessando o equipamento na mesma rede.";
      toast({ title: "Falha na sincronização", description: `${msg} — ${dica}`, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ponto Eletrônico</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSync(null)} disabled={syncingId !== null || ativos.length === 0}>
            {syncingId === "all" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Sincronizar Todos
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Equipamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEquip ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : equipamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum equipamento cadastrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nº Série</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead>Último NSR</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipamentos.map((e) => {
                    const online = isOnline(e.ultima_sincronizacao);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.ativo ? (
                            online ? (
                              <Badge variant="default" className="gap-1">
                                <Wifi className="h-3 w-3" />
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <WifiOff className="h-3 w-3" />
                                Sem dados 24h
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="font-mono text-xs">{e.numero_serie || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{e.host ? `${e.host}${e.porta ? `:${e.porta}` : ""}` : "—"}</TableCell>
                        <TableCell>{formatDateTime(e.ultima_sincronizacao)}</TableCell>
                        <TableCell>{e.ultimo_nsr || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSync(e.id)}
                              disabled={syncingId !== null || !e.ativo}
                              title="Sincronizar"
                            >
                              {syncingId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setDialogOpen(true); }} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ponto</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tabRegistros} onValueChange={(v) => setTabRegistros(v as "lista" | "calendario" | "solicitacoes")}>
            <TabsList>
              <TabsTrigger value="lista">Lista</TabsTrigger>
              <TabsTrigger value="calendario">Calendário</TabsTrigger>
              <TabsTrigger value="solicitacoes">Solicitações de ajuste</TabsTrigger>
            </TabsList>

            <TabsContent value="lista" className="space-y-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={filtroEquipamento} onValueChange={setFiltroEquipamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os equipamentos</SelectItem>
                    {equipamentos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
                <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />

                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome ou CPF"
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                {registrosFiltrados.length} registro(s)
                {busca.trim() ? ` (filtrado de ${registros.length})` : ""}
              </div>

              {loadingRegistros ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : registrosFiltrados.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum registro encontrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Departamento</TableHead>
                        <TableHead>Marcações</TableHead>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>NSR</TableHead>
                        <TableHead>Última</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosFiltrados.map((r) => (
                        <TableRow key={`${r.cpf}-${r.data}`}>
                          <TableCell className="whitespace-nowrap">{formatDate(r.data)}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{r.nome_completo || "—"}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatCpf(r.cpf) || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.unidade || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.departamento || "—"}</TableCell>
                          <TableCell>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                              <div className="whitespace-nowrap">E1 {formatTime(r.entrada_1)}</div>
                              <div className="whitespace-nowrap">S1 {formatTime(r.saida_1)}</div>
                              <div className="whitespace-nowrap">E2 {formatTime(r.entrada_2)}</div>
                              <div className="whitespace-nowrap">S2 {formatTime(r.saida_2)}</div>
                              <div className="whitespace-nowrap">E3 {formatTime(r.entrada_3)}</div>
                              <div className="whitespace-nowrap">S3 {formatTime(r.saida_3)}</div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{equipamentoNomeById.get(r.equipamento_id || "") || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{r.nsr ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateTime(r.data_hora)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendario" className="space-y-4">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
                <Select
                  value={normalizeCpf(calCpf) || "__none__"}
                  onValueChange={(v) => {
                    if (v === "__none__") {
                      setCalCpf("");
                      setCalBuscaFuncionario("");
                      return;
                    }
                    const f = funcionariosComRegistro.find((x) => x.cpf === v) || null;
                    setCalCpf(v);
                    setCalBuscaFuncionario(f ? `${f.nome_completo || "—"} • ${formatCpf(f.cpf)}` : formatCpf(v));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione um funcionário</SelectItem>
                    {funcionariosComRegistro.map((f) => (
                      <SelectItem key={f.cpf} value={f.cpf}>
                        {(f.nome_completo || "—") + " • " + formatCpf(f.cpf)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={calBuscaFuncionario}
                    onChange={(e) => setCalBuscaFuncionario(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      const resolved = resolveCpfCalendarioFromInput(calBuscaFuncionario);
                      if (!resolved) return;
                      const f = funcionariosComRegistro.find((x) => x.cpf === resolved) || null;
                      setCalCpf(resolved);
                      setCalBuscaFuncionario(f ? `${f.nome_completo || "—"} • ${formatCpf(f.cpf)}` : formatCpf(resolved));
                    }}
                    onBlur={() => {
                      const resolved = resolveCpfCalendarioFromInput(calBuscaFuncionario);
                      if (!resolved) return;
                      const f = funcionariosComRegistro.find((x) => x.cpf === resolved) || null;
                      setCalCpf(resolved);
                      setCalBuscaFuncionario(f ? `${f.nome_completo || "—"} • ${formatCpf(f.cpf)}` : formatCpf(resolved));
                    }}
                    placeholder="Buscar funcionário por nome ou CPF"
                    className="pl-8"
                  />
                  {sugestoesFuncionarioCalendario.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-background p-1 shadow">
                      {sugestoesFuncionarioCalendario.map((f) => (
                        <button
                          key={f.cpf}
                          type="button"
                          className="w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-accent"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setCalCpf(normalizeCpf(f.cpf));
                            setCalBuscaFuncionario(`${f.nome_completo || "—"} • ${formatCpf(f.cpf)}`);
                          }}
                        >
                          {f.nome_completo || "—"} • {formatCpf(f.cpf)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
                <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />

                <Select value={filtroEquipamento} onValueChange={setFiltroEquipamento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Equipamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os equipamentos</SelectItem>
                    {equipamentos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-muted-foreground">
                {funcionarioSelecionado
                  ? `${funcionarioSelecionado.nome_completo || "—"} • ${formatCpf(funcionarioSelecionado.cpf)}`
                  : normalizeCpf(calCpf)
                    ? `CPF: ${formatCpf(normalizeCpf(calCpf))}`
                    : "Selecione um funcionário para ver o calendário."}
              </div>
              {normalizeCpf(calCpf) ? (
                <div className="text-sm text-muted-foreground">
                  Último registro encontrado: {ultimoDiaCpf ? formatDate(ultimoDiaCpf) : "—"}
                </div>
              ) : null}

              {loadingRegistros ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !normalizeCpf(calCpf) ? (
                <p className="text-center text-muted-foreground py-8">Selecione um funcionário.</p>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    Período: {formatDate(calendarioPeriodo.start)} a {formatDate(calendarioPeriodo.end)} • {registrosCalendario.length} dia(s) com registro em{" "}
                    {calendarioDias.length} dia(s)
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dia</TableHead>
                          <TableHead>Semana</TableHead>
                          <TableHead>Ent. 1</TableHead>
                          <TableHead>Saí. 1</TableHead>
                          <TableHead>Ent. 2</TableHead>
                          <TableHead>Saí. 2</TableHead>
                          <TableHead>Ent. 3</TableHead>
                          <TableHead>Saí. 3</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>NSR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calendarioDias.map((dia) => {
                          const r = calendarioMap.get(dia) || null;
                          const pairMissing =
                            r &&
                            (Boolean(r.entrada_1) !== Boolean(r.saida_1) ||
                              Boolean(r.entrada_2) !== Boolean(r.saida_2) ||
                              Boolean(r.entrada_3) !== Boolean(r.saida_3));
                          const total = r ? sumWorkedMinutes(r) : null;
                          return (
                            <TableRow key={dia} className={pairMissing ? "bg-destructive/5" : undefined}>
                              <TableCell className="whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span>{formatDate(dia)}</span>
                                  {r ? (
                                    pairMissing ? (
                                      <Badge variant="destructive">Incompleto</Badge>
                                    ) : (
                                      <Badge variant="secondary">OK</Badge>
                                    )
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{weekdayShort(dia)}</TableCell>
                              <TableCell className={r && r.entrada_1 && !r.saida_1 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.entrada_1) : "—"}
                              </TableCell>
                              <TableCell className={r && r.saida_1 && !r.entrada_1 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.saida_1) : "—"}
                              </TableCell>
                              <TableCell className={r && r.entrada_2 && !r.saida_2 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.entrada_2) : "—"}
                              </TableCell>
                              <TableCell className={r && r.saida_2 && !r.entrada_2 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.saida_2) : "—"}
                              </TableCell>
                              <TableCell className={r && r.entrada_3 && !r.saida_3 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.entrada_3) : "—"}
                              </TableCell>
                              <TableCell className={r && r.saida_3 && !r.entrada_3 ? "text-destructive font-medium" : undefined}>
                                {r ? formatTime(r.saida_3) : "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{r ? formatMinutes(total) : "—"}</TableCell>
                              <TableCell className="whitespace-nowrap">{r?.nsr ?? "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="solicitacoes" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-medium">Solicitações de ajuste</div>
                <div className="flex gap-2">
                  <Select value={solFonte} onValueChange={(v) => setSolFonte(v as "todos" | "remoto" | "local")}>
                    <SelectTrigger className="w-[170px]">
                      <SelectValue placeholder="Fonte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      <SelectItem value="remoto">Remotas</SelectItem>
                      <SelectItem value="local">Locais</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={solStatus} onValueChange={(v) => setSolStatus(v as "pendente" | "aprovado" | "rejeitado")}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendentes</SelectItem>
                      <SelectItem value="aprovado">Aprovadas</SelectItem>
                      <SelectItem value="rejeitado">Rejeitadas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSolLocalVersion((vv) => vv + 1);
                      qc.invalidateQueries({ queryKey: ["solicitacoes_ponto"] });
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Atualizar
                  </Button>
                </div>
              </div>

              {!solicitacoesEnabled ? (
                <div className="text-sm text-muted-foreground">
                  Banco remoto sem tabela solicitacoes_ponto. As solicitações locais (deste navegador) continuam disponíveis.
                </div>
              ) : null}

              {loadingSolicitacoes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : solicitacoes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma solicitação.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fonte</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Campo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Anexo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {solicitacoes.map((s) => (
                        (() => {
                          const anexo = parsePontoAnexoFromMotivo(s.motivo);
                          const label =
                            anexo?.tipo === "abono_dia"
                              ? `Abona dia${anexo.dias && anexo.dias > 1 ? ` (${anexo.dias} dias)` : ""}`
                            : anexo?.tipo === "abono_horas"
                              ? `Abona horas${anexo.horas_abonadas ? ` (${formatTime(anexo.horas_abonadas)})` : ""}${anexo.dias && anexo.dias > 1 ? ` (${anexo.dias} dias)` : ""}`
                            : anexo?.tipo === "comprovante" ? "Comprovante"
                            : "";
                          return (
                        <TableRow key={`${s.source}:${s.id}`}>
                          <TableCell className="whitespace-nowrap">
                            {s.source === "local" ? <Badge variant="outline">Local</Badge> : <Badge variant="secondary">Remoto</Badge>}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(String(s.data))}</TableCell>
                          <TableCell className="whitespace-nowrap">{s.nome_completo || "—"}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{formatCpf(s.cpf_norm) || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{s.campo}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatTime(String(s.valor || ""))}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {anexo?.url ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{label || "Anexo"}</Badge>
                                <a className="text-sm underline" href={anexo.url} target="_blank" rel="noreferrer">
                                  Ver
                                </a>
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[420px] truncate" title={s.motivo || ""}>
                            {s.motivo || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {s.status === "pendente" ? (
                              <Badge variant="outline">Pendente</Badge>
                            ) : s.status === "aprovado" ? (
                              <Badge variant="secondary">Aprovado</Badge>
                            ) : (
                              <Badge variant="destructive">Rejeitado</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {s.status === "pendente" ? (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" onClick={() => handleApprove(s)} disabled={solProcessingId !== null}>
                                  {solProcessingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleReject(s)} disabled={solProcessingId !== null}>
                                  Rejeitar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                          );
                        })()
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>1) O sistema faz login no equipamento com usuário/senha.</div>
          <div>2) Baixa o AFD completo e consolida as marcações por CPF e data.</div>
          <div>3) Salva em Registros de Ponto no banco.</div>
        </CardContent>
      </Card>

      <EquipamentoPontoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipamento={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["equipamentos_ponto"] })}
      />
    </div>
  );
}
