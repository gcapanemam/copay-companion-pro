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
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

export function AdminEPIs() {
  const [cpf, setCpf] = useState("");
  const [tipoEpi, setTipoEpi] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [dataValidade, setDataValidade] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: epis, isLoading } = useQuery({
    queryKey: ["admin-epis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("epis").select("*").order("data_entrega", { ascending: false });
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

  const formatCpf = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  };

  const handleAdd = async () => {
    if (!cpf || !tipoEpi || !dataEntrega) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("epis").insert({
        cpf: cpf.replace(/\D/g, ""),
        tipo_epi: tipoEpi,
        data_entrega: dataEntrega,
        data_validade: dataValidade || null,
        quantidade: Number(quantidade),
        observacao: observacao || null,
      });
      if (error) throw error;
      toast({ title: "EPI registrado!" });
      setTipoEpi("");
      setDataEntrega("");
      setDataValidade("");
      setQuantidade("1");
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["admin-epis"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("epis").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-epis"] });
  };

  const handleUploadPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);

    let count = 0;
    for (const row of rows) {
      const rowCpf = String(row.cpf || row.CPF || "").replace(/\D/g, "");
      if (!rowCpf) continue;
      await supabase.from("epis").insert({
        cpf: rowCpf,
        tipo_epi: String(row.tipo_epi || row.tipo || row.epi || ""),
        data_entrega: String(row.data_entrega || row.entrega || ""),
        data_validade: row.data_validade || row.validade || null,
        quantidade: Number(row.quantidade || row.qtd || 1),
        observacao: row.observacao || row.obs || null,
      });
      count++;
    }
    toast({ title: `${count} EPIs importados!` });
    queryClient.invalidateQueries({ queryKey: ["admin-epis"] });
    e.target.value = "";
  };

  const isVencido = (validade: string | null) => {
    if (!validade) return false;
    return new Date(validade) < new Date();
  };

  const getNome = (cpfVal: string) => {
    const b = (beneficiarios || []).find(x => x.cpf?.replace(/\D/g, "") === cpfVal);
    return b?.nome || cpfVal;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Registrar Entrega de EPI</CardTitle></CardHeader>
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
              <Label>Tipo EPI</Label>
              <Input placeholder="Ex: Capacete, Luva, Bota" value={tipoEpi} onChange={(e) => setTipoEpi(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Data Entrega</Label>
              <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data Validade</Label>
              <Input type="date" value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} />
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
            <Label htmlFor="epi-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="h-4 w-4" />Importar Planilha
              </div>
            </Label>
            <Input id="epi-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadPlanilha} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>EPIs Registrados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(epis || []).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{getNome(e.cpf)}</TableCell>
                    <TableCell>{e.tipo_epi}</TableCell>
                    <TableCell>{new Date(e.data_entrega).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{e.data_validade ? new Date(e.data_validade).toLocaleDateString("pt-BR") : "-"}</TableCell>
                    <TableCell>{e.quantidade}</TableCell>
                    <TableCell>
                      {e.data_validade ? (
                        isVencido(e.data_validade) ? <Badge variant="destructive">Vencido</Badge> : <Badge variant="secondary">Válido</Badge>
                      ) : <Badge variant="outline">Sem validade</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
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
