import { useState } from "react";
import { Activity, LogOut, Printer, Heart, FileText, ShieldCheck, Bus, CalendarX, User, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { PortalContracheques } from "@/components/portal/PortalContracheques";
import { PortalEPIs } from "@/components/portal/PortalEPIs";
import { PortalValeTransporte } from "@/components/portal/PortalValeTransporte";
import { PortalFaltas } from "@/components/portal/PortalFaltas";
import { PortalMeusDados } from "@/components/portal/PortalMeusDados";
import { PortalComunicados } from "@/components/portal/PortalComunicados";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HAPVIDA_CNPJ = "63.554.067/0001-98";

interface Mensalidade { mes: number; valor: number; }
interface CopartItem { procedimento: string; local: string | null; quantidade: number; valor: number; }
interface Coparticipacao { mes: number; data_utilizacao: string | null; coparticipacao_itens: CopartItem[]; }

const MinhaArea = () => {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
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
  const { toast } = useToast();

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
      setLoggedIn(true);
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
        body: { action: "login", cpf: userCpf, senha, ano: selectedAno },
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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Portal do Funcionário</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{nome}</span>
            <select className="border rounded px-2 py-1 text-sm bg-background" value={ano} onChange={(e) => handleAnoChange(Number(e.target.value))}>
              {[2024, 2025, 2026].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <Button variant="ghost" size="sm" onClick={() => { setLoggedIn(false); setSenha(""); }}>
              <LogOut className="h-4 w-4 mr-1" />Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dados" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="dados" className="flex items-center gap-1"><User className="h-4 w-4" />Meus Dados</TabsTrigger>
            <TabsTrigger value="plano" className="flex items-center gap-1"><Heart className="h-4 w-4" />Plano de Saúde</TabsTrigger>
            <TabsTrigger value="contracheques" className="flex items-center gap-1"><FileText className="h-4 w-4" />Contracheques</TabsTrigger>
            <TabsTrigger value="epis" className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" />EPIs</TabsTrigger>
            <TabsTrigger value="vt" className="flex items-center gap-1"><Bus className="h-4 w-4" />Vale-Transporte</TabsTrigger>
            <TabsTrigger value="faltas" className="flex items-center gap-1"><CalendarX className="h-4 w-4" />Ponto e Faltas</TabsTrigger>
            <TabsTrigger value="comunicados" className="flex items-center gap-1"><Megaphone className="h-4 w-4" />Comunicados</TabsTrigger>
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
            <PortalFaltas faltas={faltas} registrosPonto={registrosPonto} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MinhaArea;
