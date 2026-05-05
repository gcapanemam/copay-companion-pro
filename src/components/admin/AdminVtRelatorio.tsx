import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, ArrowUpDown, Users, Bus, DollarSign } from "lucide-react";
import * as XLSX from "xlsx";

type SortKey = "nome" | "unidade" | "passagens" | "valor" | "dias" | "media" | "inconsistencias";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminVtRelatorio() {
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim] = useState(todayStr());
  const [unidade, setUnidade] = useState<string>("__all__");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: admissoes } = useQuery({
    queryKey: ["adm-vt-rel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admissoes")
        .select("cpf, nome_completo, unidade, data_demissao");
      return data || [];
    },
  });

  const { data: usos, isLoading } = useQuery({
    queryKey: ["vt-usos-rel", dataInicio, dataFim],
    queryFn: async () => {
      const inicio = new Date(dataInicio + "T00:00:00").toISOString();
      const fim = new Date(dataFim + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("vt_usos")
        .select("cpf, valor, linha, data_hora")
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .limit(50000);
      return data || [];
    },
  });

  const { data: inconsist } = useQuery({
    queryKey: ["vt-inc-rel", dataInicio, dataFim],
    queryFn: async () => {
      const inicio = new Date(dataInicio + "T00:00:00").toISOString();
      const fim = new Date(dataFim + "T23:59:59").toISOString();
      const { data } = await supabase
        .from("vt_inconsistencias")
        .select("cpf, status, data_hora")
        .gte("data_hora", inicio)
        .lte("data_hora", fim)
        .limit(50000);
      return data || [];
    },
  });

  const unidades = useMemo(() => {
    const set = new Set<string>();
    (admissoes || []).forEach((a) => a.unidade && set.add(a.unidade));
    return Array.from(set).sort();
  }, [admissoes]);

  const linhas = useMemo(() => {
    const admMap = new Map<string, { nome: string; unidade: string }>();
    (admissoes || []).forEach((a) => {
      if (a.cpf) admMap.set(a.cpf, { nome: a.nome_completo || "", unidade: a.unidade || "" });
    });

    const incMap = new Map<string, number>();
    (inconsist || []).forEach((i) => {
      if (!i.cpf) return;
      incMap.set(i.cpf, (incMap.get(i.cpf) || 0) + 1);
    });

    type Agg = {
      cpf: string;
      nome: string;
      unidade: string;
      passagens: number;
      valor: number;
      linhas: Set<string>;
      dias: Set<string>;
    };
    const map = new Map<string, Agg>();
    (usos || []).forEach((u) => {
      const cpf = u.cpf || "—sem cpf—";
      let agg = map.get(cpf);
      if (!agg) {
        const inf = admMap.get(cpf);
        agg = {
          cpf,
          nome: inf?.nome || "(não vinculado)",
          unidade: inf?.unidade || "—",
          passagens: 0,
          valor: 0,
          linhas: new Set(),
          dias: new Set(),
        };
        map.set(cpf, agg);
      }
      agg.passagens += 1;
      agg.valor += Number(u.valor) || 0;
      if (u.linha) agg.linhas.add(u.linha);
      if (u.data_hora) agg.dias.add(String(u.data_hora).slice(0, 10));
    });

    let arr = Array.from(map.values()).map((a) => ({
      cpf: a.cpf,
      nome: a.nome,
      unidade: a.unidade,
      passagens: a.passagens,
      valor: a.valor,
      linhas: Array.from(a.linhas).sort().join(", "),
      dias: a.dias.size,
      media: a.dias.size ? a.passagens / a.dias.size : 0,
      inconsistencias: incMap.get(a.cpf) || 0,
    }));

    if (unidade !== "__all__") arr = arr.filter((a) => a.unidade === unidade);
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      arr = arr.filter((a) => a.nome.toLowerCase().includes(q) || a.cpf.includes(q));
    }

    arr.sort((a: any, b: any) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [usos, admissoes, inconsist, unidade, busca, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const totalPassagens = linhas.reduce((s, x) => s + x.passagens, 0);
    const totalValor = linhas.reduce((s, x) => s + x.valor, 0);
    return { funcionarios: linhas.length, totalPassagens, totalValor };
  }, [linhas]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "nome" || k === "unidade" ? "asc" : "desc");
    }
  };

  const exportarExcel = () => {
    const rows = linhas.map((l) => ({
      CPF: l.cpf,
      Funcionário: l.nome,
      Unidade: l.unidade,
      Passagens: l.passagens,
      "Valor Total (R$)": Number(l.valor.toFixed(2)),
      "Dias com uso": l.dias,
      "Média/dia": Number(l.media.toFixed(2)),
      "Linhas utilizadas": l.linhas,
      "Inconsistências": l.inconsistencias,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório VT");
    XLSX.writeFile(wb, `relatorio-vt-${dataInicio}-a-${dataFim}.xlsx`);
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
      {children}
      <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Relatório consolidado de uso por funcionário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>Data inicial</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data final</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {unidades.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Buscar</Label>
              <Input placeholder="Nome ou CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <Button onClick={exportarExcel} disabled={!linhas.length}>
              <Download className="h-4 w-4 mr-2" /> Exportar Excel
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Funcionários com uso</p>
                  <p className="text-2xl font-bold">{kpis.funcionarios}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10"><Bus className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de passagens</p>
                  <p className="text-2xl font-bold">{kpis.totalPassagens}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor total</p>
                  <p className="text-2xl font-bold">{fmtMoney(kpis.totalValor)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortBtn k="nome">Funcionário</SortBtn></TableHead>
                  <TableHead><SortBtn k="unidade">Unidade</SortBtn></TableHead>
                  <TableHead className="text-right"><SortBtn k="passagens">Passagens</SortBtn></TableHead>
                  <TableHead className="text-right"><SortBtn k="valor">Valor total</SortBtn></TableHead>
                  <TableHead className="text-right"><SortBtn k="dias">Dias</SortBtn></TableHead>
                  <TableHead className="text-right"><SortBtn k="media">Média/dia</SortBtn></TableHead>
                  <TableHead>Linhas</TableHead>
                  <TableHead className="text-right"><SortBtn k="inconsistencias">Inconsist.</SortBtn></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell></TableRow>
                )}
                {!isLoading && linhas.map((l) => (
                  <TableRow key={l.cpf}>
                    <TableCell>
                      <div className="font-medium">{l.nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.cpf}</div>
                    </TableCell>
                    <TableCell>{l.unidade}</TableCell>
                    <TableCell className="text-right">{l.passagens}</TableCell>
                    <TableCell className="text-right">{fmtMoney(l.valor)}</TableCell>
                    <TableCell className="text-right">{l.dias}</TableCell>
                    <TableCell className="text-right">{l.media.toFixed(2)}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate" title={l.linhas}>{l.linhas || "-"}</TableCell>
                    <TableCell className="text-right">{l.inconsistencias || "-"}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && !linhas.length && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                    Sem usos no período selecionado.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
