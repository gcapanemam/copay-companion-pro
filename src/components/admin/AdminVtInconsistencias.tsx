import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RefreshCw, Loader2 } from "lucide-react";
import { ROTULOS_REGRA, type RegraVt, analisarVtInconsistencias } from "@/lib/analisarVtInconsistencias";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  justificada: "Justificada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const STATUS_VARIANT: Record<string, any> = {
  pendente: "secondary",
  justificada: "default",
  aprovada: "default",
  rejeitada: "destructive",
};

export function AdminVtInconsistencias() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [filtroCpf, setFiltroCpf] = useState<string>("__all__");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all__");
  const [filtroRegra, setFiltroRegra] = useState<string>("__all__");
  const [obsTemp, setObsTemp] = useState<Record<string, string>>({});
  const [reanalisando, setReanalisando] = useState(false);

  const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const finMonth = new Date(Number(ano), Number(mes), 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${finMonth}`;

  const { data: incs, isLoading } = useQuery({
    queryKey: ["vt-incs", ini, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vt_inconsistencias")
        .select("*")
        .gte("data_hora", `${ini}T00:00:00`)
        .lte("data_hora", `${fim}T23:59:59`)
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: beneficiarios } = useQuery({
    queryKey: ["beneficiarios-list-inc"],
    queryFn: async () => {
      const { data: t } = await supabase.from("titulares").select("nome, cpf").not("cpf", "is", null).order("nome");
      return t || [];
    },
  });

  const getNome = (cpf: string | null) =>
    !cpf ? "-" : (beneficiarios || []).find((b) => b.cpf?.replace(/\D/g, "") === cpf)?.nome || cpf;

  const filtradas = useMemo(() => {
    return (incs || []).filter((i: any) => {
      if (filtroCpf !== "__all__" && i.cpf !== filtroCpf) return false;
      if (filtroStatus !== "__all__" && i.status !== filtroStatus) return false;
      if (filtroRegra !== "__all__" && i.regra !== filtroRegra) return false;
      return true;
    });
  }, [incs, filtroCpf, filtroStatus, filtroRegra]);

  const decidir = async (id: string, status: "aprovada" | "rejeitada") => {
    const observacao = obsTemp[id] || null;
    const { error } = await supabase
      .from("vt_inconsistencias")
      .update({
        status,
        observacao_admin: observacao,
        decisao_em: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: status === "aprovada" ? "Justificativa aprovada" : "Justificativa rejeitada" });
    qc.invalidateQueries({ queryKey: ["vt-incs"] });
  };

  const reanalisarPeriodo = async () => {
    setReanalisando(true);
    try {
      // Carrega tudo necessário
      const [{ data: usos }, { data: cartoes }, { data: cal }, { data: fer }, { data: vigs }] = await Promise.all([
        supabase.from("vt_usos").select("*").gte("data_hora", `${ini}T00:00:00`).lte("data_hora", `${fim}T23:59:59`),
        supabase.from("vt_cartoes").select("*"),
        supabase.from("vt_calendario").select("*"),
        supabase.from("vt_ferias").select("*"),
        supabase.from("funcionario_jornada").select("cpf, vigencia_inicio, vigencia_fim, jornada_id"),
      ]);
      const { data: jornadas } = await supabase
        .from("jornadas_trabalho")
        .select("id, dias_semana, entrada_padrao, saida_padrao");

      const jornadaMap = new Map<string, any>();
      (jornadas || []).forEach((j: any) => jornadaMap.set(j.id, j));

      const vigencias = (vigs || [])
        .map((v: any) => {
          const j = jornadaMap.get(v.jornada_id);
          if (!j) return null;
          return {
            cpf: v.cpf,
            vigencia_inicio: v.vigencia_inicio,
            vigencia_fim: v.vigencia_fim,
            jornada: {
              dias_semana: Array.isArray(j.dias_semana) ? j.dias_semana : [1, 2, 3, 4, 5],
              entrada_padrao: j.entrada_padrao,
              saida_padrao: j.saida_padrao,
            },
          };
        })
        .filter(Boolean) as any[];

      const resultado = analisarVtInconsistencias({
        usos: (usos || []).map((u: any) => ({
          id: u.id,
          cpf: u.cpf,
          numero_cartao: u.numero_cartao,
          data_hora: u.data_hora,
          linha: u.linha,
          valor: Number(u.valor),
        })),
        vigencias,
        cartoes: (cartoes || []).map((c: any) => ({
          numero_cartao: c.numero_cartao,
          linhas: Array.isArray(c.linhas) ? c.linhas : [],
        })),
        calendario: (cal || []).map((c: any) => ({ data: c.data, tipo: c.tipo })),
        ferias: (fer || []).map((f: any) => ({
          cpf: f.cpf,
          data_inicio: f.data_inicio,
          data_fim: f.data_fim,
        })),
      });

      // Apaga inconsistências do período (somente as que ainda estão pendentes — preserva justificadas/decididas)
      const usoIds = (usos || []).map((u: any) => u.id);
      if (usoIds.length > 0) {
        await supabase
          .from("vt_inconsistencias")
          .delete()
          .in("uso_id", usoIds)
          .eq("status", "pendente");
      }

      // Insere as novas (ignorando as que já existem para o uso — pois UNIQUE(uso_id))
      if (resultado.length > 0) {
        const payload = resultado.map((r) => ({
          uso_id: r.uso_id,
          cpf: r.cpf,
          numero_cartao: r.numero_cartao,
          data_hora: r.data_hora,
          linha: r.linha,
          valor: r.valor,
          regra: r.regra,
          detalhe: r.detalhe,
        }));
        for (let i = 0; i < payload.length; i += 200) {
          const batch = payload.slice(i, i + 200);
          await supabase
            .from("vt_inconsistencias")
            .upsert(batch, { onConflict: "uso_id", ignoreDuplicates: true });
        }
      }

      toast({ title: `${resultado.length} inconsistências detectadas no período` });
      qc.invalidateQueries({ queryKey: ["vt-incs"] });
    } catch (err: any) {
      toast({ title: "Erro ao reanalisar", description: err.message, variant: "destructive" });
    } finally {
      setReanalisando(false);
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inconsistências de Vale-Transporte</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Input type="number" min={1} max={12} value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Funcionário</Label>
            <Select value={filtroCpf} onValueChange={setFiltroCpf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {(beneficiarios || []).map((b) => (
                  <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="justificada">Justificada</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="rejeitada">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Regra</Label>
            <Select value={filtroRegra} onValueChange={setFiltroRegra}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {(Object.keys(ROTULOS_REGRA) as RegraVt[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROTULOS_REGRA[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">&nbsp;</Label>
            <Button variant="outline" className="w-full" onClick={reanalisarPeriodo} disabled={reanalisando}>
              {reanalisando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Reanalisar
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Linha</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Detalhe / Justificativa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">{fmtDateTime(i.data_hora)}</TableCell>
                  <TableCell>{getNome(i.cpf)}</TableCell>
                  <TableCell>{i.linha || "-"}</TableCell>
                  <TableCell>{fmt(Number(i.valor))}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ROTULOS_REGRA[i.regra as RegraVt] || i.regra}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <div className="text-xs text-muted-foreground">{i.detalhe}</div>
                    {i.justificativa && (
                      <div className="mt-1 text-sm">
                        <span className="font-medium">Funcionário: </span>{i.justificativa}
                      </div>
                    )}
                    {i.observacao_admin && (
                      <div className="mt-1 text-xs italic">
                        <span className="font-medium">Admin: </span>{i.observacao_admin}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    {i.status === "justificada" || i.status === "pendente" ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="Observação (opcional)"
                          value={obsTemp[i.id] || ""}
                          onChange={(e) => setObsTemp({ ...obsTemp, [i.id]: e.target.value })}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => decidir(i.id, "aprovada")}>
                            <Check className="h-4 w-4 mr-1" />Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => decidir(i.id, "rejeitada")}>
                            <X className="h-4 w-4 mr-1" />Rejeitar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {i.decisao_em ? new Date(i.decisao_em).toLocaleDateString("pt-BR") : ""}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Nenhuma inconsistência encontrada para os filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
