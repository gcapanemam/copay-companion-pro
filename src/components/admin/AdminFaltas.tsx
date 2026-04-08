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
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";

const TIPOS_FALTA = ["Falta", "Atestado", "Licença Médica", "Licença Maternidade", "Licença Paternidade", "Suspensão", "Outro"];

export function AdminFaltas() {
  const [cpf, setCpf] = useState("");
  const [dataFalta, setDataFalta] = useState("");
  const [tipo, setTipo] = useState("Falta");
  const [justificativa, setJustificativa] = useState("");
  const [abonada, setAbonada] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: faltas, isLoading } = useQuery({
    queryKey: ["admin-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faltas").select("*").order("data_falta", { ascending: false });
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
    if (!cpf || !dataFalta) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("faltas").insert({
        cpf: cpf.replace(/\D/g, ""),
        data_falta: dataFalta,
        tipo,
        justificativa: justificativa || null,
        abonada,
      });
      if (error) throw error;
      toast({ title: "Falta registrada!" });
      setDataFalta("");
      setJustificativa("");
      setAbonada(false);
      queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("faltas").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
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
      await supabase.from("faltas").insert({
        cpf: rowCpf,
        data_falta: String(row.data_falta || row.data || ""),
        tipo: String(row.tipo || "Falta"),
        justificativa: row.justificativa || null,
        abonada: row.abonada === true || row.abonada === "sim" || row.abonada === "Sim",
      });
      count++;
    }
    toast({ title: `${count} faltas importadas!` });
    queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Registrar Falta</CardTitle></CardHeader>
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
              <Label>Data</Label>
              <Input type="date" value={dataFalta} onChange={(e) => setDataFalta(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_FALTA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Justificativa</Label>
              <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="abonada" checked={abonada} onCheckedChange={(v) => setAbonada(!!v)} />
              <Label htmlFor="abonada">Abonada</Label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving}>
              <Plus className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Adicionar"}
            </Button>
            <Label htmlFor="faltas-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="h-4 w-4" />Importar Planilha
              </div>
            </Label>
            <Input id="faltas-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadPlanilha} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Faltas Registradas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Justificativa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(faltas || []).map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{getNome(f.cpf)}</TableCell>
                    <TableCell>{new Date(f.data_falta).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{f.tipo}</TableCell>
                    <TableCell>{f.justificativa || "-"}</TableCell>
                    <TableCell>
                      {f.abonada ? <Badge variant="secondary">Abonada</Badge> : <Badge variant="destructive">Não abonada</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
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
