import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, LogOut, Printer, Heart, FileText, ShieldCheck, Bus, User, Megaphone, MessageCircle, ListTodo, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lovable } from "@/integrations/lovable/index";
import { NavLink } from "@/components/NavLink";
import { PortalContracheques } from "@/components/portal/PortalContracheques";
import { PortalEPIs } from "@/components/portal/PortalEPIs";
import { PortalValeTransporte } from "@/components/portal/PortalValeTransporte";
import { PortalMeusDados } from "@/components/portal/PortalMeusDados";
import { PortalComunicados } from "@/components/portal/PortalComunicados";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { PortalTarefas } from "@/components/portal/PortalTarefas";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import {
  SidebarProvider, SidebarTrigger,
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { calcularJornadaDia, calcularBancoHoras, JORNADA_PADRAO, minutosParaHHMM, corStatus, labelStatus, type JornadaLike, type CalculoDia } from "@/lib/pontoCalculos";

const BadgeCount = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] rounded-full h-5 min-w-[20px] inline-flex items-center justify-center px-1 font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HAPVIDA_CNPJ = "63.554.067/0001-98";

interface Mensalidade { mes: number; valor: number; }
interface CopartItem { procedimento: string; local: string | null; quantidade: number; valor: number; }
interface Coparticipacao { mes: number; data_utilizacao: string | null; coparticipacao_itens: CopartItem[]; }

type Section = "dados" | "plano" | "contracheques" | "epis" | "vt" | "ponto" | "comunicados" | "tarefas" | "chat";

const portalNavGroups = [
  {
    label: "Pessoal",
    items: [
      { id: "dados" as Section, label: "Meus Dados", icon: User },
    ],
  },
  {
    label: "Documentos",
    items: [
      { id: "contracheques" as Section, label: "Contracheques", icon: FileText },
      { id: "vt" as Section, label: "Vale Transporte", icon: Bus },
      { id: "ponto" as Section, label: "Ponto", icon: Clock },
    ],
  },
  {
    label: "Benefícios",
    items: [
      { id: "plano" as Section, label: "Plano de Saúde", icon: Heart },
      { id: "epis" as Section, label: "EPIs", icon: ShieldCheck },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { id: "comunicados" as Section, label: "Comunicados", icon: Megaphone, badge: "comunicados" as const },
      { id: "tarefas" as Section, label: "Tarefas", icon: ListTodo, badge: "tarefas" as const },
      { id: "chat" as Section, label: "Chat", icon: MessageCircle, badge: "chat" as const },
    ],
  },
];

function PortalSidebar({ active, onNavigate, unreadCounts, nome }: { active: Section; onNavigate: (s: Section) => void; unreadCounts: any; nome: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        {!collapsed && (
          <div className="px-4 py-3 mb-1">
            <div className="h-10 w-10 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg">
              {nome.charAt(0).toUpperCase()}
            </div>
            <p className="mt-2 text-sm font-semibold text-sidebar-foreground truncate">{nome}</p>
          </div>
        )}
        {portalNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      onClick={() => onNavigate(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && item.badge && <BadgeCount count={unreadCounts[item.badge] ?? 0} />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sidebar-primary" />
            <span className="text-xs font-semibold text-sidebar-foreground">Portal do Funcionário</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

type RegistroPontoPortal = {
  id: string;
  cpf: string;
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  entrada_3: string | null;
  saida_3: string | null;
  duracao?: string | null;
  nsr: number | null;
  tipo_marcacao?: string | null;
  motivo?: string | null;
  ocorrencia?: string | null;
};

type SolicitacaoPontoPortal = {
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

function normalizeCpf(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0").slice(-11);
}

function formatCpf(value: string): string {
  const nums = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function formatDate(v: string) {
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("pt-BR");
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

function sumPunchMinutes(r: Pick<RegistroPontoPortal, "entrada_1" | "saida_1" | "entrada_2" | "saida_2" | "entrada_3" | "saida_3">) {
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

function sumWorkedMinutes(r: RegistroPontoPortal) {
  const credit = minutesFromTime(r.duracao ?? null);
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

function cpfMatchesEmployee(recordCpf: string, employeeCpfNorm: string) {
  const recDigits = String(recordCpf || "").replace(/\D/g, "");
  if (!recDigits) return false;
  if (normalizeCpf(recDigits) === employeeCpfNorm) return true;
  if (recDigits.length < 11) return employeeCpfNorm.endsWith(recDigits);
  return employeeCpfNorm.endsWith(recDigits.slice(-9));
}

function isMissingSolicitacoesTableError(message: string) {
  const m = String(message || "").toLowerCase();
  return m.includes("solicitacoes_ponto") && (m.includes("could not find the table") || m.includes("schema cache"));
}

function uuid() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && "randomUUID" in c) return (c as Crypto & { randomUUID: () => string }).randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function readLocalSolicitacoes(): SolicitacaoPontoPortal[] {
  try {
    const raw = localStorage.getItem("copay.solicitacoes_ponto.v1");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SolicitacaoPontoPortal[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSolicitacoes(items: SolicitacaoPontoPortal[]) {
  localStorage.setItem("copay.solicitacoes_ponto.v1", JSON.stringify(items));
}

type TipoAnexoPonto = "abono_dia" | "abono_horas" | "comprovante";

function addDaysIso(dateIso: string, days: number) {
  const d = new Date(`${String(dateIso || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateIso || "").slice(0, 10);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function withAnexoInMotivo(
  motivo: string,
  anexo: {
    tipo: TipoAnexoPonto;
    horas_abonadas?: string | null;
    dias?: number | null;
    data_inicio?: string | null;
    bucket: string;
    path: string;
    url: string;
    name: string;
    mime: string;
    size: number;
  } | null,
) {
  const base = String(motivo || "").trim();
  if (!anexo) return base;
  const payload = encodeURIComponent(JSON.stringify(anexo));
  return `${base}\n\n__PONTO_ANEXO__=${payload}`;
}

function PortalPonto({ cpf }: { cpf: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const cpfNorm = useMemo(() => normalizeCpf(cpf), [cpf]);

  const defaultPeriodo = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    return { de: toIso(start), ate: toIso(end) };
  }, []);

  const [de, setDe] = useState<string>(defaultPeriodo.de);
  const [ate, setAte] = useState<string>(defaultPeriodo.ate);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDia, setManualDia] = useState<string>(defaultPeriodo.ate);
  const [manualCampo, setManualCampo] = useState<string>("entrada_1");
  const [manualHora, setManualHora] = useState<string>("");
  const [manualMotivo, setManualMotivo] = useState<string>("");
  const [manualSaving, setManualSaving] = useState(false);
  const [atestadoOpen, setAtestadoOpen] = useState(false);
  const [atestadoDia, setAtestadoDia] = useState<string>(defaultPeriodo.ate);
  const [atestadoTipo, setAtestadoTipo] = useState<TipoAnexoPonto>("abono_dia");
  const [atestadoDias, setAtestadoDias] = useState<string>("1");
  const [atestadoHorasAbonadas, setAtestadoHorasAbonadas] = useState<string>("");
  const [atestadoMotivo, setAtestadoMotivo] = useState<string>("");
  const [atestadoArquivo, setAtestadoArquivo] = useState<File | null>(null);
  const [atestadoSaving, setAtestadoSaving] = useState(false);
  const [solicitacoesMode, setSolicitacoesMode] = useState<"remote" | "local">("remote");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["portal-ponto", cpfNorm, de, ate],
    queryFn: async () => {
      if (!cpfNorm) return [];
      const suffix9 = cpfNorm.slice(-9);
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("id, cpf, data, entrada_1, saida_1, entrada_2, saida_2, entrada_3, saida_3, duracao, nsr, tipo_marcacao, motivo, ocorrencia")
        .like("cpf", `%${suffix9}`)
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: true });
      if (error) {
        toast({ title: "Erro ao carregar ponto", description: error.message, variant: "destructive" });
        return [];
      }
      return ((data || []) as RegistroPontoPortal[]).filter((r) => cpfMatchesEmployee(r.cpf, cpfNorm));
    },
    enabled: Boolean(cpfNorm && de && ate),
  });

  const { data: solicitacoesPendentes = [] } = useQuery({
    queryKey: ["portal-ponto-solicitacoes", cpfNorm, de, ate],
    queryFn: async () => {
      if (!cpfNorm) return [];
      const suffix9 = cpfNorm.slice(-9);
      const runLocal = () => {
        const all = readLocalSolicitacoes();
        return all
          .filter((s) => cpfMatchesEmployee(s.cpf, cpfNorm))
          .filter((s) => String(s.data || "").slice(0, 10) >= de && String(s.data || "").slice(0, 10) <= ate)
          .filter((s) => s.status === "pendente")
          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""), "pt-BR"));
      };

      const { data, error } = await supabase
        .from("solicitacoes_ponto")
        .select("id, cpf, data, campo, valor, tipo, motivo, status, created_at")
        .like("cpf", `%${suffix9}`)
        .gte("data", de)
        .lte("data", ate)
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingSolicitacoesTableError(error.message)) {
          setSolicitacoesMode("local");
          return runLocal();
        }
        toast({ title: "Erro ao carregar solicitações", description: error.message, variant: "destructive" });
        return solicitacoesMode === "local" ? runLocal() : [];
      }
      if (solicitacoesMode !== "remote") setSolicitacoesMode("remote");
      return ((data || []) as SolicitacaoPontoPortal[]).filter((s) => cpfMatchesEmployee(s.cpf, cpfNorm) && s.status === "pendente");
    },
    enabled: Boolean(cpfNorm && de && ate),
  });

  const solicitacoesByDia = useMemo(() => {
    const m = new Map<string, SolicitacaoPontoPortal[]>();
    for (const s of solicitacoesPendentes) {
      const d = String(s.data || "").slice(0, 10);
      if (!d) continue;
      const arr = m.get(d) || [];
      arr.push(s);
      m.set(d, arr);
    }
    return m;
  }, [solicitacoesPendentes]);

  // ---- Jornada vinculada ao funcionário (com fallback para padrão 8h) ----
  const { data: jornada = JORNADA_PADRAO } = useQuery<JornadaLike>({
    queryKey: ["portal-ponto-jornada", cpfNorm],
    queryFn: async () => {
      if (!cpfNorm) return JORNADA_PADRAO;
      const suffix9 = cpfNorm.slice(-9);
      const today = new Date().toISOString().slice(0, 10);
      const { data: vinc } = await supabase
        .from("funcionario_jornada")
        .select("jornada_id, vigencia_inicio, vigencia_fim")
        .like("cpf", `%${suffix9}`)
        .lte("vigencia_inicio", today)
        .order("vigencia_inicio", { ascending: false })
        .limit(1);
      const v = (vinc || []).find((x) => !x.vigencia_fim || x.vigencia_fim >= today);
      if (!v) return JORNADA_PADRAO;
      const { data: j } = await supabase
        .from("jornadas_trabalho")
        .select("carga_diaria_min, carga_semanal_min, intervalo_obrigatorio_min, tolerancia_min, dias_semana, entrada_padrao, saida_padrao")
        .eq("id", v.jornada_id)
        .maybeSingle();
      if (!j) return JORNADA_PADRAO;
      const dias = Array.isArray(j.dias_semana) ? (j.dias_semana as number[]) : JORNADA_PADRAO.dias_semana;
      return {
        carga_diaria_min: j.carga_diaria_min,
        carga_semanal_min: j.carga_semanal_min,
        intervalo_obrigatorio_min: j.intervalo_obrigatorio_min,
        tolerancia_min: j.tolerancia_min,
        dias_semana: dias,
        entrada_padrao: j.entrada_padrao,
        saida_padrao: j.saida_padrao,
      };
    },
    enabled: Boolean(cpfNorm),
  });

  // ---- Banco de horas: busca movimentos do CPF ----
  const { data: bancoMovimentos = [] } = useQuery({
    queryKey: ["portal-ponto-banco", cpfNorm],
    queryFn: async () => {
      if (!cpfNorm) return [];
      const suffix9 = cpfNorm.slice(-9);
      const { data } = await supabase
        .from("banco_horas_movimentos")
        .select("minutos, data_referencia, expira_em, origem, descricao, created_at")
        .like("cpf", `%${suffix9}`)
        .order("created_at", { ascending: false })
        .limit(60);
      return data || [];
    },
    enabled: Boolean(cpfNorm),
  });

  const saldoBanco = useMemo(() => calcularBancoHoras(bancoMovimentos), [bancoMovimentos]);

  // ---- Cálculo agregado do período (para dashboard cards) ----
  const calculosByDia = useMemo(() => {
    const m = new Map<string, CalculoDia>();
    for (const r of registros || []) {
      const dia = String(r.data || "").slice(0, 10);
      if (!dia) continue;
      m.set(dia, calcularJornadaDia(r, jornada));
    }
    return m;
  }, [registros, jornada]);

  const totaisPeriodo = useMemo(() => {
    let trabalhadas = 0;
    let esperadas = 0;
    let extras = 0;
    let irregularidades = 0;
    for (const c of calculosByDia.values()) {
      trabalhadas += c.trabalhadas_min;
      esperadas += c.esperadas_min;
      extras += c.extras_min;
      if (c.status === "irregular") irregularidades += 1;
    }
    return { trabalhadas, esperadas, extras, irregularidades };
  }, [calculosByDia]);


  const saveManual = async () => {
    const dia = String(manualDia || "").slice(0, 10);
    const motivo = String(manualMotivo || "").trim();
    const hora = String(manualHora || "").trim();
    if (!cpfNorm) return;
    if (!dia) {
      toast({ title: "Informe a data", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dia > today) {
      toast({ title: "Data inválida", description: "Não é permitido lançar marcação em data futura.", variant: "destructive" });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(hora)) {
      toast({ title: "Hora inválida", description: "Use o formato HH:MM.", variant: "destructive" });
      return;
    }
    const hh = Number(hora.slice(0, 2));
    const mm = Number(hora.slice(3, 5));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      toast({ title: "Hora inválida", description: "Use um horário entre 00:00 e 23:59.", variant: "destructive" });
      return;
    }
    if (!motivo) {
      toast({ title: "Informe o motivo", description: "A marcação manual precisa de justificativa.", variant: "destructive" });
      return;
    }

    setManualSaving(true);
    try {
      const existingRecord = (registros || []).find((r) => String(r.data || "").slice(0, 10) === dia) || null;
      const current: RegistroPontoPortal = existingRecord || {
        id: "",
        cpf: cpfNorm,
        data: dia,
        entrada_1: null,
        saida_1: null,
        entrada_2: null,
        saida_2: null,
        entrada_3: null,
        saida_3: null,
        nsr: null,
        motivo: null,
        tipo_marcacao: null,
        ocorrencia: null,
      };

      const dbTime = `${hora}:00`;
      const allowed = new Set(["entrada_1", "saida_1", "entrada_2", "saida_2", "entrada_3", "saida_3"]);
      const campo = String(manualCampo || "").trim();
      if (!allowed.has(campo)) {
        toast({ title: "Campo inválido", variant: "destructive" });
        return;
      }

      const prereq: Record<string, string | null> = {
        saida_1: "entrada_1",
        entrada_2: "saida_1",
        saida_2: "entrada_2",
        entrada_3: "saida_2",
        saida_3: "entrada_3",
      };
      const follow: Record<string, string | null> = {
        entrada_1: "saida_1",
        saida_1: "entrada_2",
        entrada_2: "saida_2",
        saida_2: "entrada_3",
        entrada_3: "saida_3",
      };

      const orderError = (() => {
        const newM = minutesFromTime(dbTime);
        if (newM === null) return "Hora inválida.";
        const p = prereq[campo] || null;
        if (p) {
          const pv = (current as unknown as Record<string, string | null>)[p] ?? null;
          if (!pv) return `Para lançar ${campo.replace("_", " ").toUpperCase()}, informe primeiro ${p.replace("_", " ").toUpperCase()}.`;
          const pm = minutesFromTime(pv);
          if (pm !== null && newM < pm) return "Horário não pode ser menor que a marcação anterior.";
        }
        const f = follow[campo] || null;
        if (f) {
          const fv = (current as unknown as Record<string, string | null>)[f] ?? null;
          if (fv) {
            const fm = minutesFromTime(fv);
            if (fm !== null && newM > fm) return "Horário não pode ser maior que a próxima marcação existente.";
          }
        }
        return null;
      })();
      if (orderError) {
        toast({ title: "Sequência inválida", description: orderError, variant: "destructive" });
        return;
      }

      const alreadyPending = (solicitacoesByDia.get(dia) || []).some((s) => s.campo === campo);
      if (alreadyPending) {
        toast({ title: "Já existe solicitação pendente", description: "Aguarde a aprovação do RH.", variant: "destructive" });
        return;
      }
      const currentValue = (current as unknown as Record<string, string | null>)[campo] ?? null;
      if (currentValue && minutesFromTime(currentValue) === minutesFromTime(dbTime)) {
        toast({ title: "Sem alteração", description: "O valor informado é igual ao atual.", variant: "destructive" });
        return;
      }

      const insertLocal = () => {
        const next: SolicitacaoPontoPortal = {
          id: uuid(),
          cpf: cpfNorm,
          data: dia,
          campo,
          valor: dbTime,
          tipo: campo.startsWith("entrada") ? "entrada" : "saida",
          motivo,
          status: "pendente",
          created_at: new Date().toISOString(),
        };
        const all = readLocalSolicitacoes();
        writeLocalSolicitacoes([next, ...all]);
      };

      const { error: reqErr } = await supabase.from("solicitacoes_ponto").insert({
        cpf: cpfNorm,
        data: dia,
        campo,
        valor: dbTime,
        tipo: campo.startsWith("entrada") ? "entrada" : "saida",
        motivo,
        status: "pendente",
      });

      if (reqErr) {
        if (isMissingSolicitacoesTableError(reqErr.message)) {
          setSolicitacoesMode("local");
          insertLocal();
        } else if (solicitacoesMode === "local") {
          insertLocal();
        } else {
          throw reqErr;
        }
      } else {
        if (solicitacoesMode !== "remote") setSolicitacoesMode("remote");
      }

      toast({
        title: "Pedido enviado para aprovação",
        description: `${campo.replace("_", " ").toUpperCase()} em ${hora} • ${formatDate(dia)}`,
      });
      setManualOpen(false);
      setManualHora("");
      setManualMotivo("");
      qc.invalidateQueries({ queryKey: ["portal-ponto-solicitacoes", cpfNorm] });
    } catch (e: unknown) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setManualSaving(false);
    }
  };

  const saveAtestado = async () => {
    const dia = String(atestadoDia || "").slice(0, 10);
    const motivo = String(atestadoMotivo || "").trim();
    const today = new Date().toISOString().slice(0, 10);
    const diasCount =
      atestadoTipo === "abono_horas"
        ? 1
        : Math.max(1, Math.min(365, Number.parseInt(String(atestadoDias || "1"), 10) || 1));
    if (!cpfNorm) return;
    if (!dia) {
      toast({ title: "Informe a data", variant: "destructive" });
      return;
    }
    if (dia > today) {
      toast({ title: "Data inválida", description: "Não é permitido lançar em data futura.", variant: "destructive" });
      return;
    }
    if (!motivo) {
      toast({ title: "Informe o motivo", variant: "destructive" });
      return;
    }
    if (!atestadoArquivo) {
      toast({ title: "Anexe o arquivo", description: "Envie o atestado/comprovante (PDF ou imagem).", variant: "destructive" });
      return;
    }
    if (atestadoArquivo.size > 15 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 15MB.", variant: "destructive" });
      return;
    }
    if (atestadoTipo === "abono_horas") {
      const t = String(atestadoHorasAbonadas || "").trim();
      if (!/^\d{2}:\d{2}$/.test(t)) {
        toast({ title: "Informe as horas ausente", description: "Use o formato HH:MM.", variant: "destructive" });
        return;
      }
    }

    setAtestadoSaving(true);
    try {
      for (let i = 0; i < diasCount; i++) {
        const d = addDaysIso(dia, i);
        const pending = (solicitacoesByDia.get(d) || []).some((s) => s.campo === "atestado");
        if (pending) {
          toast({ title: "Já existe solicitação pendente", description: `Aguarde a aprovação do RH (${formatDate(d)}).`, variant: "destructive" });
          return;
        }
      }

      const ext = atestadoArquivo.name.includes(".") ? atestadoArquivo.name.split(".").pop() : "";
      const safeExt = String(ext || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const rawName = String(atestadoArquivo.name || "arquivo");
      const baseName = rawName.replace(/\.[^/.]+$/, "");
      const safeName =
        baseName
          .trim()
          .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
          .replace(/\s+/g, "_")
          .slice(0, 60) || "arquivo";
      const path = `ponto-atestados/${cpfNorm}/${dia}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}.${safeExt || "bin"}`;
      const bucket = "funcionarios-documentos";
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, atestadoArquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: atestadoArquivo.type,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      const url = urlData?.publicUrl || "";

      const motivoFinal = withAnexoInMotivo(motivo, {
        tipo: atestadoTipo,
        horas_abonadas: atestadoTipo === "abono_horas" ? `${atestadoHorasAbonadas}:00`.slice(0, 8) : null,
        dias: diasCount,
        data_inicio: dia,
        bucket,
        path,
        url,
        name: rawName,
        mime: atestadoArquivo.type,
        size: atestadoArquivo.size,
      });

      const insertLocal = () => {
        const all = readLocalSolicitacoes();
        const now = new Date().toISOString();
        const batch: SolicitacaoPontoPortal[] = [];
        for (let i = 0; i < diasCount; i++) {
          const d = addDaysIso(dia, i);
          batch.push({
            id: uuid(),
            cpf: cpfNorm,
            data: d,
            campo: "atestado",
            valor: atestadoTipo === "abono_horas" ? `${atestadoHorasAbonadas}:00`.slice(0, 8) : atestadoTipo === "abono_dia" ? "DIA" : "JUST",
            tipo: atestadoTipo,
            motivo: motivoFinal,
            status: "pendente",
            created_at: now,
          });
        }
        writeLocalSolicitacoes([...batch, ...all]);
      };

      const rows = Array.from({ length: diasCount }, (_, i) => ({
        cpf: cpfNorm,
        data: addDaysIso(dia, i),
        campo: "atestado",
        valor: atestadoTipo === "abono_horas" ? `${atestadoHorasAbonadas}:00`.slice(0, 8) : atestadoTipo === "abono_dia" ? "DIA" : "JUST",
        tipo: atestadoTipo,
        motivo: motivoFinal,
        status: "pendente",
      }));

      const { error: reqErr } = await supabase.from("solicitacoes_ponto").insert(rows);

      if (reqErr) {
        if (isMissingSolicitacoesTableError(reqErr.message)) {
          setSolicitacoesMode("local");
          insertLocal();
        } else if (solicitacoesMode === "local") {
          insertLocal();
        } else {
          throw reqErr;
        }
      } else {
        if (solicitacoesMode !== "remote") setSolicitacoesMode("remote");
      }

      toast({ title: "Atestado enviado para aprovação", description: `${formatDate(dia)}` });
      setAtestadoOpen(false);
      setAtestadoMotivo("");
      setAtestadoDias("1");
      setAtestadoHorasAbonadas("");
      setAtestadoArquivo(null);
      setAtestadoTipo("abono_dia");
      qc.invalidateQueries({ queryKey: ["portal-ponto-solicitacoes", cpfNorm] });
    } catch (e: unknown) {
      toast({ title: "Erro ao enviar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setAtestadoSaving(false);
    }
  };

  const periodo = useMemo(() => {
    const s = (de || defaultPeriodo.de).slice(0, 10);
    const e = (ate || defaultPeriodo.ate).slice(0, 10);
    return s <= e ? { start: s, end: e } : { start: e, end: s };
  }, [de, ate, defaultPeriodo.de, defaultPeriodo.ate]);

  const dias = useMemo(() => listDatesInclusive(periodo.start, periodo.end), [periodo.start, periodo.end]);

  const map = useMemo(() => {
    const m = new Map<string, RegistroPontoPortal>();
    for (const r of registros) {
      const key = String(r.data || "").slice(0, 10);
      if (key) m.set(key, r);
    }
    return m;
  }, [registros]);

  const totalPeriodo = useMemo(() => {
    let total = 0;
    let hasAny = false;
    for (const r of registros) {
      const t = sumWorkedMinutes(r);
      if (t === null) continue;
      total += t;
      hasAny = true;
    }
    return hasAny ? total : null;
  }, [registros]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Ponto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dashboard cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Trabalhadas no período</div>
              <div className="mt-1 text-xl font-semibold">{minutosParaHHMM(totaisPeriodo.trabalhadas)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Esperadas no período</div>
              <div className="mt-1 text-xl font-semibold">{minutosParaHHMM(totaisPeriodo.esperadas)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Banco de horas</div>
              <div className={`mt-1 text-xl font-semibold ${saldoBanco.saldo_min < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                {minutosParaHHMM(saldoBanco.saldo_min)}
              </div>
              {saldoBanco.prestes_a_expirar_min > 0 ? (
                <div className="text-[10px] text-amber-600 dark:text-amber-400">
                  {minutosParaHHMM(saldoBanco.prestes_a_expirar_min)} expira em ≤30d
                </div>
              ) : null}
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Pendências</div>
              <div className="mt-1 text-xl font-semibold flex items-center gap-2">
                {solicitacoesPendentes.length}
                {totaisPeriodo.irregularidades > 0 ? (
                  <Badge variant="destructive" className="text-[10px]">{totaisPeriodo.irregularidades} irreg.</Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            <div className="text-sm text-muted-foreground flex items-center">
              Total no período: {formatMinutes(totalPeriodo)}
            </div>
            <div className="flex gap-2 md:justify-end">
              <Button variant="outline" onClick={() => { setManualDia(defaultPeriodo.ate); setManualOpen(true); }}>
                Solicitar ajuste
              </Button>
              <Button variant="outline" onClick={() => { setAtestadoDia(defaultPeriodo.ate); setAtestadoOpen(true); }}>
                Lançar atestado
              </Button>
            </div>
          </div>
          {solicitacoesMode === "local" ? (
            <div className="text-sm text-muted-foreground">Solicitações em modo local (salvas neste navegador).</div>
          ) : null}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
                    <TableHead>Trab.</TableHead>
                    <TableHead>Espe.</TableHead>
                    <TableHead>Saldo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>NSR</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dias.map((dia) => {
                    const r = map.get(dia) || null;
                    const pendentes = solicitacoesByDia.get(dia) || [];
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
                            {r?.tipo_marcacao === "manual" ? <Badge variant="secondary">Manual</Badge> : null}
                            {r?.tipo_marcacao === "ajuste" ? <Badge variant="secondary">Ajuste</Badge> : null}
                            {pendentes.length > 0 ? <Badge variant="outline">Pendente</Badge> : null}
                            {pairMissing ? <Badge variant="destructive">Incompleto</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{weekdayShort(dia)}</TableCell>
                        <TableCell className={r && r.entrada_1 && !r.saida_1 ? "text-destructive font-medium" : undefined}>
                          {r ? r.entrada_1?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className={r && r.saida_1 && !r.entrada_1 ? "text-destructive font-medium" : undefined}>
                          {r ? r.saida_1?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className={r && r.entrada_2 && !r.saida_2 ? "text-destructive font-medium" : undefined}>
                          {r ? r.entrada_2?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className={r && r.saida_2 && !r.entrada_2 ? "text-destructive font-medium" : undefined}>
                          {r ? r.saida_2?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className={r && r.entrada_3 && !r.saida_3 ? "text-destructive font-medium" : undefined}>
                          {r ? r.entrada_3?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className={r && r.saida_3 && !r.entrada_3 ? "text-destructive font-medium" : undefined}>
                          {r ? r.saida_3?.slice(0, 5) || "—" : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{r ? formatMinutes(total) : "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{r?.nsr ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setManualDia(dia);
                              const next =
                                !r || !r.entrada_1 ? "entrada_1"
                                : !r.saida_1 ? "saida_1"
                                : !r.entrada_2 ? "entrada_2"
                                : !r.saida_2 ? "saida_2"
                                : !r.entrada_3 ? "entrada_3"
                                : !r.saida_3 ? "saida_3"
                                : "entrada_1";
                              setManualCampo(next);
                              setManualOpen(true);
                            }}
                          >
                            Solicitar ajuste
                          </Button>
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

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar ajuste de ponto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={manualDia} onChange={(e) => setManualDia(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Campo</Label>
                <Select value={manualCampo} onValueChange={setManualCampo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Campo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada_1">Entrada 1</SelectItem>
                    <SelectItem value="saida_1">Saída 1</SelectItem>
                    <SelectItem value="entrada_2">Entrada 2</SelectItem>
                    <SelectItem value="saida_2">Saída 2</SelectItem>
                    <SelectItem value="entrada_3">Entrada 3</SelectItem>
                    <SelectItem value="saida_3">Saída 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Hora</Label>
                <Input value={manualHora} onChange={(e) => setManualHora(e.target.value)} placeholder="HH:MM" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} placeholder="Descreva o motivo da marcação manual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualOpen(false)} disabled={manualSaving}>
              Cancelar
            </Button>
            <Button onClick={saveManual} disabled={manualSaving}>
              {manualSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={atestadoOpen} onOpenChange={setAtestadoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar atestado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={atestadoDia} onChange={(e) => setAtestadoDia(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={atestadoTipo} onValueChange={(v) => setAtestadoTipo(v as TipoAnexoPonto)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="abono_dia">Atestado que abona o dia</SelectItem>
                    <SelectItem value="abono_horas">Atestado que abona horas</SelectItem>
                    <SelectItem value="comprovante">Comprovante que justifica a ausência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade de dias</Label>
                <Input
                  value={atestadoDias}
                  onChange={(e) => setAtestadoDias(e.target.value)}
                  placeholder="1"
                  disabled={atestadoTipo === "abono_horas"}
                />
              </div>
              {atestadoTipo === "abono_horas" ? (
                <div className="space-y-1">
                  <Label>Horas ausente</Label>
                  <Input value={atestadoHorasAbonadas} onChange={(e) => setAtestadoHorasAbonadas(e.target.value)} placeholder="HH:MM" />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Horas ausente</Label>
                  <Input value="" disabled placeholder="—" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Textarea value={atestadoMotivo} onChange={(e) => setAtestadoMotivo(e.target.value)} placeholder="Descreva o motivo" />
            </div>
            <div className="space-y-1">
              <Label>Anexo</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(e) => setAtestadoArquivo(e.target.files?.[0] || null)} />
              <div className="text-xs text-muted-foreground">{atestadoArquivo ? atestadoArquivo.name : "Obrigatório (PDF ou imagem, até 15MB)."}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtestadoOpen(false)} disabled={atestadoSaving}>
              Cancelar
            </Button>
            <Button onClick={saveAtestado} disabled={atestadoSaving}>
              {atestadoSaving ? "Enviando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MinhaArea = () => {
  const [searchParams] = useSearchParams();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [nome, setNome] = useState("");
  const [userCpf, setUserCpf] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [coparticipacoes, setCoparticipacoes] = useState<Coparticipacao[]>([]);
  const [contracheques, setContracheques] = useState<any[]>([]);
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [epis, setEpis] = useState<any[]>([]);
  const [valeTransporte, setValeTransporte] = useState<any[]>([]);
  const [admissao, setAdmissao] = useState<any>(null);
  const [showIR, setShowIR] = useState(false);
  const [section, setSection] = useState<Section>("dados");
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACpf, setTwoFACpf] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const { toast } = useToast();
  const unreadCounts = useUnreadCounts({ cpf: userCpf, departamento: admissao?.departamento, unidade: admissao?.unidade });

  useEffect(() => {
    const checkGoogleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email && !loggedIn && !searchParams.get("admin_cpf")) {
        setGoogleLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("login-beneficiario", {
            body: { action: "google-login", email: session.user.email, ano },
          });
          if (error) throw error;
          if (data.error) {
            toast({ title: "Erro", description: data.error, variant: "destructive" });
            await supabase.auth.signOut();
            return;
          }
          applyUserData(data);
          setLoggedIn(true);
        } catch (err: any) {
          toast({ title: "Erro", description: err.message, variant: "destructive" });
          await supabase.auth.signOut();
        } finally {
          setGoogleLoading(false);
        }
      }
    };
    checkGoogleSession();
  }, []);

  useEffect(() => {
    const adminCpf = searchParams.get("admin_cpf");
    if (adminCpf && !loggedIn) {
      const doAdminLogin = async () => {
        setLoading(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast({ title: "Erro", description: "Você precisa estar logado como admin.", variant: "destructive" });
            return;
          }
          const { data, error } = await supabase.functions.invoke("login-beneficiario", {
            body: { action: "admin-view", cpf: adminCpf, ano },
          });
          if (error) throw error;
          if (data.error) {
            toast({ title: "Erro", description: data.error, variant: "destructive" });
            return;
          }
          applyUserData(data);
          setIsAdminView(true);
          setLoggedIn(true);
        } catch (err: any) {
          toast({ title: "Erro", description: err.message, variant: "destructive" });
        } finally {
          setLoading(false);
        }
      };
      doAdminLogin();
    }
  }, [searchParams]);

  const applyUserData = (data: any) => {
    setNome(data.nome);
    setUserCpf(data.cpf);
    setMensalidades(data.mensalidades || []);
    setCoparticipacoes(data.coparticipacoes || []);
    setContracheques(data.contracheques || []);
    setComunicados(data.comunicados || []);
    setEpis(data.epis || []);
    setValeTransporte(data.vale_transporte || []);
    setAdmissao(data.admissao || null);
  };

  const formatCpf = (value: string) => {
    const nums = value.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "login", cpf, senha, ano },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      if (data.requires_2fa) {
        setRequires2FA(true);
        setTwoFACpf(data.cpf);
        setMaskedEmail(data.masked_email || "");
        toast({ title: "Código enviado", description: data.masked_email ? `Código enviado para ${data.masked_email}` : "Código de verificação gerado." });
        return;
      }
      applyUserData(data);
      setLoggedIn(true);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "verify-2fa", cpf: twoFACpf, codigo: twoFACode, ano },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        return;
      }
      applyUserData(data);
      setLoggedIn(true);
      setRequires2FA(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/minha-area",
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        toast({ title: "Erro", description: "Falha ao autenticar com Google.", variant: "destructive" });
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data, error } = await supabase.functions.invoke("login-beneficiario", {
          body: { action: "google-login", email: session.user.email, ano },
        });
        if (error) throw error;
        if (data.error) {
          toast({ title: "Erro", description: data.error, variant: "destructive" });
          await supabase.auth.signOut();
          return;
        }
        applyUserData(data);
        setLoggedIn(true);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
      await supabase.auth.signOut();
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResend2FA = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "login", cpf, senha, ano },
      });
      if (error) throw error;
      if (data.requires_2fa) {
        toast({ title: "Código reenviado", description: "Um novo código foi enviado para seu e-mail." });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reloadData = async (selectedAno: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "reload-data", cpf: userCpf, ano: selectedAno },
      });
      if (error) throw error;
      if (!data.error) {
        setMensalidades(data.mensalidades || []);
        setCoparticipacoes(data.coparticipacoes || []);
        setContracheques(data.contracheques || []);
        setComunicados(data.comunicados || []);
        setEpis(data.epis || []);
        setValeTransporte(data.vale_transporte || []);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAnoChange = (newAno: number) => { setAno(newAno); reloadData(newAno); };
  const getMensalidadeMes = (mes: number) => mensalidades.find((x) => x.mes === mes)?.valor || 0;
  const getCopartMes = (mes: number) => coparticipacoes.filter((c) => c.mes === mes).reduce((sum, c) => sum + (c.coparticipacao_itens || []).reduce((s, i) => s + i.valor, 0), 0);
  const totalMensalidades = mensalidades.reduce((s, m) => s + m.valor, 0);
  const totalCopart = coparticipacoes.reduce((s, c) => s + (c.coparticipacao_itens || []).reduce((s2, i) => s2 + i.valor, 0), 0);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (showIR) {
    return (
      <div className="min-h-screen bg-background p-8 print:p-4 print:bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="print:hidden mb-4 flex gap-2">
            <Button onClick={() => setShowIR(false)} variant="outline">Voltar</Button>
            <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          </div>
          <div className="border p-8 print:border-none print:p-0">
            <h1 className="text-xl font-bold text-center mb-1">INFORME DE PAGAMENTOS - PLANO DE SAÚDE</h1>
            <p className="text-center text-sm text-muted-foreground print:text-black mb-6">Ano-Calendário {ano}</p>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div><p className="font-semibold">Operadora:</p><p>HAPVIDA ASSISTÊNCIA MÉDICA LTDA</p><p>CNPJ: {HAPVIDA_CNPJ}</p></div>
              <div><p className="font-semibold">Beneficiário:</p><p>{nome}</p><p>CPF: {formatCpf(userCpf)}</p></div>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="border-b-2 border-foreground print:border-black"><th className="text-left py-2">Mês</th><th className="text-right py-2">Mensalidade</th><th className="text-right py-2">Coparticipação</th><th className="text-right py-2">Total</th></tr></thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
                  const mensal = getMensalidadeMes(mes); const copart = getCopartMes(mes); const total = mensal + copart;
                  if (total === 0) return null;
                  return (<tr key={mes} className="border-b"><td className="py-1">{MESES[mes - 1]}/{ano}</td><td className="text-right py-1">{fmt(mensal)}</td><td className="text-right py-1">{fmt(copart)}</td><td className="text-right py-1 font-medium">{fmt(total)}</td></tr>);
                })}
              </tbody>
              <tfoot><tr className="border-t-2 border-foreground print:border-black font-bold"><td className="py-2">TOTAL</td><td className="text-right py-2">{fmt(totalMensalidades)}</td><td className="text-right py-2">{fmt(totalCopart)}</td><td className="text-right py-2">{fmt(totalMensalidades + totalCopart)}</td></tr></tfoot>
            </table>
            <p className="text-xs text-muted-foreground print:text-gray-600 mt-6">Documento gerado para fins de declaração de Imposto de Renda.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loggedIn) {
    if (googleLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardContent className="py-12 text-center">
              <Activity className="h-8 w-8 text-primary mx-auto animate-spin mb-4" />
              <p className="text-muted-foreground">Autenticando com Google...</p>
            </CardContent>
          </Card>
        </div>
      );
    }
    if (requires2FA) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5">
          <Card className="w-full max-w-md shadow-xl border-0">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
                <Activity className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle>Verificação em Dois Fatores</CardTitle>
              <p className="text-sm text-muted-foreground">
                {maskedEmail
                  ? `Digite o código de 6 dígitos enviado para ${maskedEmail}`
                  : "Digite o código de 6 dígitos de verificação"}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Código de Verificação</Label>
                <Input
                  placeholder="000000"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="text-center text-2xl tracking-[0.5em] font-mono h-12"
                  onKeyDown={(e) => e.key === "Enter" && twoFACode.length === 6 && handleVerify2FA()}
                />
              </div>
              <Button className="w-full h-11" onClick={handleVerify2FA} disabled={loading || twoFACode.length !== 6}>
                {loading ? "Verificando..." : "Verificar"}
              </Button>
              <div className="flex items-center justify-between">
                <button className="text-sm text-muted-foreground hover:text-primary" onClick={() => { setRequires2FA(false); setTwoFACode(""); }}>← Voltar</button>
                <button className="text-sm text-muted-foreground hover:text-primary" onClick={handleResend2FA} disabled={loading}>Reenviar código</button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Portal do Funcionário</CardTitle>
            <p className="text-sm text-muted-foreground">Acesse seus dados de RH</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input placeholder="000.000.000-00" value={formatCpf(cpf)} onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))} maxLength={14} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Digite sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} className="h-11" />
            </div>
            <Button className="w-full h-11 text-base" onClick={handleLogin} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
            </div>
            <Button variant="outline" className="w-full h-11 flex items-center gap-2" onClick={handleGoogleLogin} disabled={googleLoading}>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? "Conectando..." : "Entrar com Google"}
            </Button>
            <div className="text-center">
              <NavLink to="/" className="text-sm text-muted-foreground hover:text-primary">Área administrativa</NavLink>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderContent = () => {
    switch (section) {
      case "dados": return <PortalMeusDados admissao={admissao} nome={nome} cpf={userCpf} />;
      case "plano":
        return (
          <>
            <div className="flex justify-end mb-4">
              <Button variant="outline" size="sm" onClick={() => setShowIR(true)}>
                <Printer className="h-4 w-4 mr-1" />Informe IR
              </Button>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-lg">Resumo Anual - {ano}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Mês</TableHead>
                        <TableHead className="text-right">Mensalidade</TableHead>
                        <TableHead className="text-right">Coparticipação</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => {
                        const mensal = getMensalidadeMes(mes); const copart = getCopartMes(mes);
                        return (
                          <TableRow key={mes}>
                            <TableCell className="font-medium">{MESES[mes - 1]}</TableCell>
                            <TableCell className="text-right">{mensal > 0 ? fmt(mensal) : "-"}</TableCell>
                            <TableCell className="text-right">{copart > 0 ? fmt(copart) : "-"}</TableCell>
                            <TableCell className="text-right font-medium">{mensal + copart > 0 ? fmt(mensal + copart) : "-"}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="font-bold border-t-2">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{fmt(totalMensalidades)}</TableCell>
                        <TableCell className="text-right">{fmt(totalCopart)}</TableCell>
                        <TableCell className="text-right">{fmt(totalMensalidades + totalCopart)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        );
      case "contracheques": return <PortalContracheques contracheques={contracheques} />;
      case "epis": return <PortalEPIs epis={epis} />;
      case "vt": return <PortalValeTransporte valeTransporte={valeTransporte} />;
      case "ponto": return <PortalPonto cpf={userCpf} />;
      case "comunicados": return <PortalComunicados comunicados={comunicados} cpf={userCpf} unidade={admissao?.unidade} departamento={admissao?.departamento} />;
      case "tarefas": return <PortalTarefas cpf={userCpf} departamento={admissao?.departamento} unidade={admissao?.unidade} />;
      case "chat": return <ChatContainer meuCpf={userCpf} />;
      default: return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {isAdminView && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
            👁️ Visualizando como: {nome} ({formatCpf(userCpf)}) — <button className="underline" onClick={() => window.close()}>Fechar</button>
          </div>
        )}
        <PortalSidebar active={section} onNavigate={setSection} unreadCounts={unreadCounts} nome={nome} />

        <div className="flex-1 flex flex-col min-w-0" style={isAdminView ? { marginTop: "28px" } : undefined}>
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">Portal do Funcionário</h1>
            </div>
            <div className="flex items-center gap-2">
              <select className="border rounded-lg px-3 py-1.5 text-sm bg-background" value={ano} onChange={(e) => handleAnoChange(Number(e.target.value))}>
                {[2024, 2025, 2026].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {!isAdminView && (
                <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); setLoggedIn(false); setSenha(""); }}>
                  <LogOut className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sair</span>
                </Button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MinhaArea;
