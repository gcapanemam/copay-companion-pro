import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, LogOut, Printer, Heart, FileText, ShieldCheck, Bus, CalendarX, User, Megaphone, MessageCircle, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { NavLink } from "@/components/NavLink";
import { PortalContracheques } from "@/components/portal/PortalContracheques";
import { PortalEPIs } from "@/components/portal/PortalEPIs";
import { PortalValeTransporte } from "@/components/portal/PortalValeTransporte";
import { PortalFaltas } from "@/components/portal/PortalFaltas";
import { PortalMeusDados } from "@/components/portal/PortalMeusDados";
import { PortalComunicados } from "@/components/portal/PortalComunicados";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { PortalTarefas } from "@/components/portal/PortalTarefas";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

const BadgeCount = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-5 min-w-[20px] inline-flex items-center justify-center px-1 font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HAPVIDA_CNPJ = "63.554.067/0001-98";

interface Mensalidade { mes: number; valor: number; }
interface CopartItem { procedimento: string; local: string | null; quantidade: number; valor: number; }
interface Coparticipacao { mes: number; data_utilizacao: string | null; coparticipacao_itens: CopartItem[]; }

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
  const [faltas, setFaltas] = useState<any[]>([]);
  const [registrosPonto, setRegistrosPonto] = useState<any[]>([]);
  const [admissao, setAdmissao] = useState<any>(null);
  const [showIR, setShowIR] = useState(false);
  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACpf, setTwoFACpf] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const { toast } = useToast();
  const unreadCounts = useUnreadCounts({ cpf: userCpf, departamento: admissao?.departamento, unidade: admissao?.unidade });

  // Check for returning Google OAuth session
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

  // Admin impersonation: auto-login when admin_cpf is in URL
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
    setFaltas(data.faltas || []);
    setRegistrosPonto(data.registros_ponto || []);
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
      // Session set, fetch employee data
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
        body: { action: isAdminView ? "admin-view" : "login", cpf: userCpf, senha, ano: selectedAno },
      });
      if (error) throw error;
      if (!data.error) {
        setMensalidades(data.mensalidades || []);
        setCoparticipacoes(data.coparticipacoes || []);
        setContracheques(data.contracheques || []);
        setComunicados(data.comunicados || []);
        setEpis(data.epis || []);
        setValeTransporte(data.vale_transporte || []);
        setFaltas(data.faltas || []);
        setRegistrosPonto(data.registros_ponto || []);
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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="w-full max-w-md">
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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Activity className="h-6 w-6 text-primary" />
                <CardTitle>Verificação em Dois Fatores</CardTitle>
              </div>
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
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  onKeyDown={(e) => e.key === "Enter" && twoFACode.length === 6 && handleVerify2FA()}
                />
              </div>
              <Button className="w-full" onClick={handleVerify2FA} disabled={loading || twoFACode.length !== 6}>
                {loading ? "Verificando..." : "Verificar"}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={() => { setRequires2FA(false); setTwoFACode(""); }}
                >
                  ← Voltar
                </button>
                <button
                  className="text-sm text-muted-foreground hover:text-primary"
                  onClick={handleResend2FA}
                  disabled={loading}
                >
                  Reenviar código
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Activity className="h-6 w-6 text-primary" />
              <CardTitle>Portal do Funcionário</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Acesse seus dados de RH</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input placeholder="000.000.000-00" value={formatCpf(cpf)} onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))} maxLength={14} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" placeholder="Digite sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
            </div>
            <Button className="w-full" onClick={handleLogin} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
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

  return (
    <div className="min-h-screen bg-background">
      {isAdminView && (
        <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
          👁️ Visualizando como: {nome} ({formatCpf(userCpf)}) — <button className="underline" onClick={() => window.close()}>Fechar</button>
        </div>
      )}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Portal do Funcionário</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-sm text-muted-foreground hidden sm:inline">{nome}</span>
            <select className="border rounded px-2 py-1 text-sm bg-background" value={ano} onChange={(e) => handleAnoChange(Number(e.target.value))}>
              {[2024, 2025, 2026].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {!isAdminView && (
              <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); setLoggedIn(false); setSenha(""); }}>
                <LogOut className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sair</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dados" className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-9 h-auto p-1">
            <TabsTrigger value="dados" className="flex items-center gap-1 shrink-0"><User className="h-4 w-4" /><span className="hidden md:inline">Meus Dados</span></TabsTrigger>
            <TabsTrigger value="plano" className="flex items-center gap-1 shrink-0"><Heart className="h-4 w-4" /><span className="hidden md:inline">Plano</span></TabsTrigger>
            <TabsTrigger value="contracheques" className="flex items-center gap-1 shrink-0"><FileText className="h-4 w-4" /><span className="hidden md:inline">Contracheques</span></TabsTrigger>
            <TabsTrigger value="epis" className="flex items-center gap-1 shrink-0"><ShieldCheck className="h-4 w-4" /><span className="hidden md:inline">EPIs</span></TabsTrigger>
            <TabsTrigger value="vt" className="flex items-center gap-1 shrink-0"><Bus className="h-4 w-4" /><span className="hidden md:inline">VT</span></TabsTrigger>
            <TabsTrigger value="faltas" className="flex items-center gap-1 shrink-0"><CalendarX className="h-4 w-4" /><span className="hidden md:inline">Ponto</span></TabsTrigger>
            <TabsTrigger value="comunicados" className="flex items-center gap-1 shrink-0"><Megaphone className="h-4 w-4" /><span className="hidden md:inline">Comunicados</span><BadgeCount count={unreadCounts.comunicados} /></TabsTrigger>
            <TabsTrigger value="tarefas" className="flex items-center gap-1 shrink-0"><ListTodo className="h-4 w-4" /><span className="hidden md:inline">Tarefas</span><BadgeCount count={unreadCounts.tarefas} /></TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1 shrink-0"><MessageCircle className="h-4 w-4" /><span className="hidden md:inline">Chat</span><BadgeCount count={unreadCounts.chat} /></TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <PortalMeusDados admissao={admissao} nome={nome} cpf={userCpf} />
          </TabsContent>

          <TabsContent value="plano">
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
          </TabsContent>

          <TabsContent value="contracheques">
            <PortalContracheques contracheques={contracheques} />
          </TabsContent>

          <TabsContent value="epis">
            <PortalEPIs epis={epis} />
          </TabsContent>

          <TabsContent value="vt">
            <PortalValeTransporte valeTransporte={valeTransporte} />
          </TabsContent>

          <TabsContent value="faltas">
            <PortalFaltas faltas={faltas} registrosPonto={registrosPonto} />
          </TabsContent>

          <TabsContent value="comunicados">
            <PortalComunicados
              comunicados={comunicados}
              cpf={userCpf}
              unidade={admissao?.unidade}
              departamento={admissao?.departamento}
            />
          </TabsContent>

          <TabsContent value="tarefas">
            <PortalTarefas cpf={userCpf} departamento={admissao?.departamento} unidade={admissao?.unidade} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatContainer meuCpf={userCpf} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MinhaArea;
