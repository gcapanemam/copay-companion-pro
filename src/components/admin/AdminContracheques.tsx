import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function AdminContracheques() {
  const [cpf, setCpf] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracheques, isLoading } = useQuery({
    queryKey: ["admin-contracheques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracheques").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
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

  const handleUpload = async () => {
    if (!file || !cpf || !mes || !ano) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const path = `${cleanCpf}/${ano}_${mes.padStart(2, "0")}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("contracheques").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("contracheques").insert({
        cpf: cleanCpf,
        mes: Number(mes),
        ano: Number(ano),
        arquivo_path: path,
        nome_arquivo: file.name,
      });
      if (dbErr) throw dbErr;

      toast({ title: "Contracheque enviado!" });
      setFile(null);
      setCpf("");
      setMes("");
      queryClient.invalidateQueries({ queryKey: ["admin-contracheques"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, path: string) => {
    await supabase.storage.from("contracheques").remove([path]);
    await supabase.from("contracheques").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-contracheques"] });
    toast({ title: "Removido" });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Upload de Contracheque</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Funcionário (CPF)</Label>
              <Select value={cpf} onValueChange={setCpf}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(beneficiarios || []).map((b) => (
                    <SelectItem key={b.cpf} value={b.cpf!}>{b.nome} - {formatCpf(b.cpf!)}</SelectItem>
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
            <div className="space-y-2">
              <Label>PDF</Label>
              <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contracheques Cadastrados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CPF</TableHead>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contracheques || []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatCpf(c.cpf)}</TableCell>
                    <TableCell>{MESES[(c.mes || 1) - 1]} / {c.ano}</TableCell>
                    <TableCell>{c.nome_arquivo}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.arquivo_path)}>
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
