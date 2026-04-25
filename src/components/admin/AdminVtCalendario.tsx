import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  feriado: "Feriado",
  recesso: "Recesso",
  sabado_letivo: "Sábado letivo",
};

export function AdminVtCalendario() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Calendário
  const [data, setData] = useState("");
  const [tipo, setTipo] = useState<string>("feriado");
  const [descricao, setDescricao] = useState("");

  // Férias
  const [feriasCpf, setFeriasCpf] = useState("");
  const [feriasIni, setFeriasIni] = useState("");
  const [feriasFim, setFeriasFim] = useState("");
  const [feriasObs, setFeriasObs] = useState("");

  const { data: calendario } = useQuery({
    queryKey: ["vt-calendario"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vt_calendario").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ferias } = useQuery({
    queryKey: ["vt-ferias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vt_ferias").select("*").order("data_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: beneficiarios } = useQuery({
    queryKey: ["beneficiarios-list-cal"],
    queryFn: async () => {
      const { data: t } = await supabase.from("titulares").select("nome, cpf").not("cpf", "is", null).order("nome");
      return t || [];
    },
  });

  const getNome = (cpf: string) =>
    (beneficiarios || []).find((b) => b.cpf?.replace(/\D/g, "") === cpf)?.nome || cpf;

  const addCalendario = async () => {
    if (!data || !tipo) return toast({ title: "Informe data e tipo", variant: "destructive" });
    const { error } = await supabase.from("vt_calendario").insert({ data, tipo, descricao: descricao || null });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Item adicionado!" });
    setData(""); setDescricao("");
    qc.invalidateQueries({ queryKey: ["vt-calendario"] });
  };

  const delCalendario = async (id: string) => {
    await supabase.from("vt_calendario").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["vt-calendario"] });
  };

  const addFerias = async () => {
    if (!feriasCpf || !feriasIni || !feriasFim)
      return toast({ title: "Informe funcionário e período", variant: "destructive" });
    const { error } = await supabase.from("vt_ferias").insert({
      cpf: feriasCpf.replace(/\D/g, ""),
      data_inicio: feriasIni,
      data_fim: feriasFim,
      observacao: feriasObs || null,
    });
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Férias cadastradas!" });
    setFeriasIni(""); setFeriasFim(""); setFeriasObs("");
    qc.invalidateQueries({ queryKey: ["vt-ferias"] });
  };

  const delFerias = async (id: string) => {
    await supabase.from("vt_ferias").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["vt-ferias"] });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Feriados, recessos e sábados letivos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feriado">Feriado</SelectItem>
                  <SelectItem value="recesso">Recesso</SelectItem>
                  <SelectItem value="sabado_letivo">Sábado letivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Natal, Recesso de fim de ano..." />
            </div>
          </div>
          <Button onClick={addCalendario}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(calendario || []).map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.data + "T12:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{TIPO_LABEL[c.tipo] || c.tipo}</TableCell>
                    <TableCell>{c.descricao || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => delCalendario(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!calendario || calendario.length === 0) && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum item.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Férias dos funcionários</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Funcionário</Label>
              <Select value={feriasCpf} onValueChange={setFeriasCpf}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(beneficiarios || []).map((b) => (
                    <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="date" value={feriasIni} onChange={(e) => setFeriasIni(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={feriasFim} onChange={(e) => setFeriasFim(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label>Observação</Label>
              <Input value={feriasObs} onChange={(e) => setFeriasObs(e.target.value)} />
            </div>
          </div>
          <Button onClick={addFerias}><Plus className="h-4 w-4 mr-1" />Cadastrar férias</Button>

          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ferias || []).map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell>{getNome(f.cpf)}</TableCell>
                    <TableCell>{new Date(f.data_inicio + "T12:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{new Date(f.data_fim + "T12:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{f.observacao || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => delFerias(f.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!ferias || ferias.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma férias cadastrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
