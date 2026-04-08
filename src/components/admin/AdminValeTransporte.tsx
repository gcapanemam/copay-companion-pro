import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Upload } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function AdminValeTransporte() {
  const [cpf, setCpf] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valor, setValor] = useState("");
  const [qtdPassagens, setQtdPassagens] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: registros, isLoading } = useQuery({
    queryKey: ["admin-vt"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vale_transporte").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: beneficiarios } = useQuery({
    queryKey: ["beneficiarios-list"],
    queryFn: async () => {
      const { data: t } = await supabase.from("titulares").select("nome, cpf").not("cpf", "is", null).order("nome");
      return t || [];
    },
  });

  const getNome = (cpfVal: string) => (beneficiarios || []).find(x => x.cpf?.replace(/\D/g, "") === cpfVal)?.nome || cpfVal;

  const handleAdd = async () => {
    if (!cpf || !mes || !ano || !valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vale_transporte").insert({
        cpf: cpf.replace(/\D/g, ""),
        mes: Number(mes),
        ano: Number(ano),
        valor: Number(valor),
        quantidade_passagens: qtdPassagens ? Number(qtdPassagens) : null,
        observacao: observacao || null,
      });
      if (error) throw error;
      toast({ title: "Vale-transporte registrado!" });
      setValor("");
      setQtdPassagens("");
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vale_transporte").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
  };

  const handleUploadPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let count = 0;
    for (const row of rows) {
      const rowCpf = String(row.cpf || row.CPF || "").replace(/\D/g, "");
      if (!rowCpf) continue;
      await supabase.from("vale_transporte").insert({
        cpf: rowCpf,
        mes: Number(row.mes || 1),
        ano: Number(row.ano || new Date().getFullYear()),
        valor: Number(row.valor || 0),
        quantidade_passagens: row.quantidade_passagens || row.passagens || null,
        observacao: row.observacao || row.obs || null,
      });
      count++;
    }
    toast({ title: `${count} registros importados!` });
    queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
    e.target.value = "";
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Registrar Vale-Transporte</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Funcionário</Label>
              <Select value={cpf} onValueChange={setCpf}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(beneficiarios || []).map((b) => (
                    <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qtd Passagens</Label>
              <Input type="number" value={qtdPassagens} onChange={(e) => setQtdPassagens(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Adicionar"}
            </Button>
            <Label htmlFor="vt-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="h-4 w-4" />Importar Planilha
              </div>
            </Label>
            <Input id="vt-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadPlanilha} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Registros de Vale-Transporte</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Passagens</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(registros || []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{getNome(r.cpf)}</TableCell>
                    <TableCell>{MESES[(r.mes || 1) - 1]} / {r.ano}</TableCell>
                    <TableCell>{fmt(r.valor)}</TableCell>
                    <TableCell>{r.quantidade_passagens ?? "-"}</TableCell>
                    <TableCell>{r.observacao || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
