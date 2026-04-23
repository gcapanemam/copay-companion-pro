import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Users, Pencil } from "lucide-react";
import { minutosParaHHMM } from "@/lib/pontoCalculos";

const TIPOS = [
  { value: "fixa", label: "Fixa" },
  { value: "flexivel", label: "Flexível" },
  { value: "escala_12x36", label: "Escala 12x36" },
  { value: "escala_6x1", label: "Escala 6x1" },
];

const DIAS_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Jornada = {
  id: string;
  nome: string;
  tipo: string;
  carga_diaria_min: number;
  carga_semanal_min: number;
  intervalo_obrigatorio_min: number;
  tolerancia_min: number;
  dias_semana: number[];
  entrada_padrao: string | null;
  saida_padrao: string | null;
  ativo: boolean;
};

type Vinculo = {
  id: string;
  cpf: string;
  jornada_id: string;
  vigencia_inicio: string;
  vigencia_fim: string | null;
};

type AdmissaoMini = { cpf: string; nome_completo: string | null };

const emptyJornada = (): Partial<Jornada> => ({
  nome: "",
  tipo: "fixa",
  carga_diaria_min: 480,
  carga_semanal_min: 2640,
  intervalo_obrigatorio_min: 60,
  tolerancia_min: 10,
  dias_semana: [1, 2, 3, 4, 5],
  entrada_padrao: "08:00",
  saida_padrao: "17:00",
  ativo: true,
});

export function AdminJornadas() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [openJornada, setOpenJornada] = useState(false);
  const [editJornada, setEditJornada] = useState<Partial<Jornada> | null>(null);
  const [openVinc, setOpenVinc] = useState(false);
  const [vincForm, setVincForm] = useState<{ cpf: string; jornada_id: string; vigencia_inicio: string; vigencia_fim: string }>({
    cpf: "",
    jornada_id: "",
    vigencia_inicio: new Date().toISOString().slice(0, 10),
    vigencia_fim: "",
  });

  const { data: jornadas = [], isLoading: loadingJ } = useQuery<Jornada[]>({
    queryKey: ["admin-jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornadas_trabalho")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []).map((j) => ({
        ...j,
        dias_semana: Array.isArray(j.dias_semana) ? (j.dias_semana as number[]) : [1, 2, 3, 4, 5],
      })) as Jornada[];
    },
  });

  const { data: vinculos = [] } = useQuery<Vinculo[]>({
    queryKey: ["admin-jornadas-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionario_jornada")
        .select("*")
        .order("vigencia_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery<AdmissaoMini[]>({
    queryKey: ["admin-jornadas-funcs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissoes")
        .select("cpf, nome_completo")
        .order("nome_completo", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const jornadaById = useMemo(() => {
    const m = new Map<string, Jornada>();
    jornadas.forEach((j) => m.set(j.id, j));
    return m;
  }, [jornadas]);

  const funcByCpf = useMemo(() => {
    const m = new Map<string, AdmissaoMini>();
    funcionarios.forEach((f) => m.set(f.cpf, f));
    return m;
  }, [funcionarios]);

  const startNew = () => { setEditJornada(emptyJornada()); setOpenJornada(true); };
  const startEdit = (j: Jornada) => { setEditJornada({ ...j }); setOpenJornada(true); };

  const saveJornada = async () => {
    const j = editJornada;
    if (!j || !j.nome) {
      toast({ title: "Informe o nome da jornada", variant: "destructive" });
      return;
    }
    const payload = {
      nome: j.nome,
      tipo: j.tipo || "fixa",
      carga_diaria_min: Number(j.carga_diaria_min || 480),
      carga_semanal_min: Number(j.carga_semanal_min || 2640),
      intervalo_obrigatorio_min: Number(j.intervalo_obrigatorio_min || 60),
      tolerancia_min: Number(j.tolerancia_min || 10),
      dias_semana: j.dias_semana || [1, 2, 3, 4, 5],
      entrada_padrao: j.entrada_padrao || null,
      saida_padrao: j.saida_padrao || null,
      ativo: j.ativo !== false,
    };
    if (j.id) {
      const { error } = await supabase.from("jornadas_trabalho").update(payload).eq("id", j.id);
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("jornadas_trabalho").insert(payload);
      if (error) { toast({ title: "Erro ao criar", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Jornada salva" });
    setOpenJornada(false);
    setEditJornada(null);
    qc.invalidateQueries({ queryKey: ["admin-jornadas"] });
  };

  const removeJornada = async (id: string) => {
    if (!confirm("Remover esta jornada?")) return;
    const { error } = await supabase.from("jornadas_trabalho").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Removida" });
    qc.invalidateQueries({ queryKey: ["admin-jornadas"] });
  };

  const saveVinc = async () => {
    if (!vincForm.cpf || !vincForm.jornada_id || !vincForm.vigencia_inicio) {
      toast({ title: "Preencha CPF, jornada e início de vigência", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("funcionario_jornada").insert({
      cpf: vincForm.cpf.replace(/\D/g, ""),
      jornada_id: vincForm.jornada_id,
      vigencia_inicio: vincForm.vigencia_inicio,
      vigencia_fim: vincForm.vigencia_fim || null,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Vínculo criado" });
    setOpenVinc(false);
    setVincForm({ cpf: "", jornada_id: "", vigencia_inicio: new Date().toISOString().slice(0, 10), vigencia_fim: "" });
    qc.invalidateQueries({ queryKey: ["admin-jornadas-vinculos"] });
  };

  const removeVinc = async (id: string) => {
    if (!confirm("Remover este vínculo?")) return;
    const { error } = await supabase.from("funcionario_jornada").delete().eq("id", id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    qc.invalidateQueries({ queryKey: ["admin-jornadas-vinculos"] });
  };

  const toggleDia = (dia: number) => {
    if (!editJornada) return;
    const dias = editJornada.dias_semana || [];
    const next = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort();
    setEditJornada({ ...editJornada, dias_semana: next });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Jornadas de trabalho</CardTitle>
          <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" />Nova jornada</Button>
        </CardHeader>
        <CardContent>
          {loadingJ ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Carga diária</TableHead>
                    <TableHead>Semanal</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Tolerância</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Horário padrão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jornadas.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-medium">{j.nome}</TableCell>
                      <TableCell>{TIPOS.find((t) => t.value === j.tipo)?.label || j.tipo}</TableCell>
                      <TableCell>{minutosParaHHMM(j.carga_diaria_min)}</TableCell>
                      <TableCell>{minutosParaHHMM(j.carga_semanal_min)}</TableCell>
                      <TableCell>{j.intervalo_obrigatorio_min}min</TableCell>
                      <TableCell>{j.tolerancia_min}min</TableCell>
                      <TableCell className="text-xs">{j.dias_semana.map((d) => DIAS_LABEL[d]).join(", ")}</TableCell>
                      <TableCell className="text-xs">{j.entrada_padrao || "—"} → {j.saida_padrao || "—"}</TableCell>
                      <TableCell>{j.ativo ? <Badge variant="secondary">Ativa</Badge> : <Badge variant="outline">Inativa</Badge>}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(j)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => removeJornada(j.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {jornadas.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma jornada cadastrada</TableCell></TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />Vínculos funcionário ↔ jornada</CardTitle>
          <Button size="sm" onClick={() => setOpenVinc(true)}><Plus className="h-4 w-4 mr-1" />Novo vínculo</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Jornada</TableHead>
                  <TableHead>Vigência</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vinculos.map((v) => {
                  const j = jornadaById.get(v.jornada_id);
                  const f = funcByCpf.get(v.cpf);
                  return (
                    <TableRow key={v.id}>
                      <TableCell>{f?.nome_completo || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.cpf}</TableCell>
                      <TableCell>{j?.nome || v.jornada_id}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(`${v.vigencia_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                        {v.vigencia_fim ? ` → ${new Date(`${v.vigencia_fim}T00:00:00`).toLocaleDateString("pt-BR")}` : " → indefinido"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => removeVinc(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {vinculos.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum vínculo. Funcionários sem vínculo usam jornada padrão 8h Seg-Sex.</TableCell></TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Jornada */}
      <Dialog open={openJornada} onOpenChange={setOpenJornada}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editJornada?.id ? "Editar jornada" : "Nova jornada"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input value={editJornada?.nome || ""} onChange={(e) => setEditJornada({ ...editJornada!, nome: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={editJornada?.tipo || "fixa"} onValueChange={(v) => setEditJornada({ ...editJornada!, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editJornada?.ativo === false ? "false" : "true"} onValueChange={(v) => setEditJornada({ ...editJornada!, ativo: v === "true" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Carga diária (min)</Label>
              <Input type="number" value={editJornada?.carga_diaria_min ?? 480} onChange={(e) => setEditJornada({ ...editJornada!, carga_diaria_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Carga semanal (min)</Label>
              <Input type="number" value={editJornada?.carga_semanal_min ?? 2640} onChange={(e) => setEditJornada({ ...editJornada!, carga_semanal_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Intervalo obrigatório (min)</Label>
              <Input type="number" value={editJornada?.intervalo_obrigatorio_min ?? 60} onChange={(e) => setEditJornada({ ...editJornada!, intervalo_obrigatorio_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tolerância (min)</Label>
              <Input type="number" value={editJornada?.tolerancia_min ?? 10} onChange={(e) => setEditJornada({ ...editJornada!, tolerancia_min: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Entrada padrão</Label>
              <Input type="time" value={editJornada?.entrada_padrao || ""} onChange={(e) => setEditJornada({ ...editJornada!, entrada_padrao: e.target.value })} />
            </div>
            <div>
              <Label>Saída padrão</Label>
              <Input type="time" value={editJornada?.saida_padrao || ""} onChange={(e) => setEditJornada({ ...editJornada!, saida_padrao: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Dias da semana</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {DIAS_LABEL.map((dia, idx) => {
                  const ativo = (editJornada?.dias_semana || []).includes(idx);
                  return (
                    <Button key={idx} type="button" size="sm" variant={ativo ? "default" : "outline"} onClick={() => toggleDia(idx)}>{dia}</Button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenJornada(false)}>Cancelar</Button>
            <Button onClick={saveJornada}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Vínculo */}
      <Dialog open={openVinc} onOpenChange={setOpenVinc}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo vínculo de jornada</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Funcionário</Label>
              <Select value={vincForm.cpf} onValueChange={(v) => setVincForm({ ...vincForm, cpf: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.cpf} value={f.cpf}>{f.nome_completo} — {f.cpf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jornada</Label>
              <Select value={vincForm.jornada_id} onValueChange={(v) => setVincForm({ ...vincForm, jornada_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {jornadas.filter((j) => j.ativo).map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início vigência</Label>
                <Input type="date" value={vincForm.vigencia_inicio} onChange={(e) => setVincForm({ ...vincForm, vigencia_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Fim vigência (opcional)</Label>
                <Input type="date" value={vincForm.vigencia_fim} onChange={(e) => setVincForm({ ...vincForm, vigencia_fim: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenVinc(false)}>Cancelar</Button>
            <Button onClick={saveVinc}>Criar vínculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
