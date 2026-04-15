import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Loader2, Eye, Image as ImageIcon, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  em_andamento: "bg-blue-100 text-blue-800",
  concluida: "bg-green-100 text-green-800",
};

export function AdminTarefas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [filtroStatus, setFiltroStatus] = useState("__all__");
  const [saving, setSaving] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipoDestinatario, setTipoDestinatario] = useState("funcionario");
  const [valorDestinatario, setValorDestinatario] = useState("");
  const [dataPrevista, setDataPrevista] = useState<Date | undefined>();
  const [fotos, setFotos] = useState<File[]>([]);

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["admin-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pendencias } = useQuery({
    queryKey: ["admin-pendencias-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_atualizacoes")
        .select("*, tarefas(titulo, valor_destinatario, tipo_destinatario)")
        .eq("tipo", "pendencia")
        .eq("resolvida", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleResolver = async (id: string) => {
    try {
      const { error } = await supabase.from("tarefa_atualizacoes").update({ resolvida: true }).eq("id", id);
      if (error) throw error;
      toast({ title: "Pendência resolvida!" });
      queryClient.invalidateQueries({ queryKey: ["admin-pendencias-abertas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const { data: admissoes } = useQuery({
    queryKey: ["admin-admissoes-tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissoes").select("cpf, nome_completo, departamento, unidade").order("nome_completo");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: taskFotos } = useQuery({
    queryKey: ["admin-tarefa-fotos", detailTask?.id],
    queryFn: async () => {
      if (!detailTask) return [];
      const { data, error } = await supabase.from("tarefa_fotos").select("*").eq("tarefa_id", detailTask.id).order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!detailTask,
  });

  const { data: taskUpdates } = useQuery({
    queryKey: ["admin-tarefa-atualizacoes", detailTask?.id],
    queryFn: async () => {
      if (!detailTask) return [];
      const { data, error } = await supabase.from("tarefa_atualizacoes").select("*").eq("tarefa_id", detailTask.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!detailTask,
  });

  const unidades = [...new Set((admissoes || []).map(a => a.unidade).filter(Boolean))];
  const departamentos = [...new Set((admissoes || []).map(a => a.departamento).filter(Boolean))];

  const resetForm = () => {
    setTitulo(""); setDescricao(""); setTipoDestinatario("funcionario");
    setValorDestinatario(""); setDataPrevista(undefined); setFotos([]);
  };

  const handleSave = async () => {
    if (!titulo.trim() || !valorDestinatario.trim()) {
      toast({ title: "Erro", description: "Título e destinatário são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: tarefa, error } = await supabase.from("tarefas").insert({
        titulo,
        descricao,
        tipo_destinatario: tipoDestinatario,
        valor_destinatario: valorDestinatario,
        data_prevista: dataPrevista ? format(dataPrevista, "yyyy-MM-dd") : null,
        criado_por: "admin",
      }).select().single();
      if (error) throw error;

      // Upload photos
      for (const foto of fotos) {
        const path = `${tarefa.id}/${Date.now()}_${foto.name}`;
        const { error: upErr } = await supabase.storage.from("tarefas-fotos").upload(path, foto);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("tarefas-fotos").getPublicUrl(path);
        await supabase.from("tarefa_fotos").insert({ tarefa_id: tarefa.id, foto_url: urlData.publicUrl, tipo: "descricao" });
      }

      toast({ title: "Tarefa criada!" });
      resetForm();
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-tarefas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = (tarefas || []).filter(t => filtroStatus === "__all__" || t.status === filtroStatus);

  const getDestinatarioLabel = (t: any) => {
    if (t.tipo_destinatario === "funcionario") {
      const func = (admissoes || []).find(a => a.cpf === t.valor_destinatario);
      return func ? func.nome_completo : t.valor_destinatario;
    }
    return `${t.tipo_destinatario === "departamento" ? "Depto" : "Unidade"}: ${t.valor_destinatario}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Limpeza do setor" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Destinar para</Label>
                <Select value={tipoDestinatario} onValueChange={v => { setTipoDestinatario(v); setValorDestinatario(""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="departamento">Departamento</SelectItem>
                    <SelectItem value="unidade">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Destinatário *</Label>
                {tipoDestinatario === "funcionario" ? (
                  <Select value={valorDestinatario} onValueChange={setValorDestinatario}>
                    <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
                    <SelectContent>
                      {(admissoes || []).map(a => (
                        <SelectItem key={a.cpf} value={a.cpf}>{a.nome_completo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : tipoDestinatario === "departamento" ? (
                  <Select value={valorDestinatario} onValueChange={setValorDestinatario}>
                    <SelectTrigger><SelectValue placeholder="Selecionar departamento" /></SelectTrigger>
                    <SelectContent>
                      {departamentos.map(d => <SelectItem key={d} value={d!}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={valorDestinatario} onValueChange={setValorDestinatario}>
                    <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u} value={u!}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data prevista de conclusão</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left", !dataPrevista && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPrevista ? format(dataPrevista, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataPrevista} onSelect={setDataPrevista} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fotos</Label>
                <Input type="file" accept="image/*" multiple onChange={e => setFotos(Array.from(e.target.files || []))} />
                {fotos.length > 0 && <p className="text-xs text-muted-foreground">{fotos.length} foto(s) selecionada(s)</p>}
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando...</> : "Criar Tarefa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada.</TableCell></TableRow>
                ) : filtered.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.titulo}</TableCell>
                    <TableCell className="text-sm">{getDestinatarioLabel(t)}</TableCell>
                    <TableCell>{t.data_prevista ? format(new Date(t.data_prevista + "T12:00:00"), "dd/MM/yyyy") : "-"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[t.status] || ""}>{STATUS_LABELS[t.status] || t.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(t.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setDetailTask(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={!!detailTask} onOpenChange={v => { if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detailTask?.titulo}</DialogTitle></DialogHeader>
          {detailTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_COLORS[detailTask.status]}>{STATUS_LABELS[detailTask.status]}</Badge>
                <span className="text-sm text-muted-foreground">→ {getDestinatarioLabel(detailTask)}</span>
              </div>
              {detailTask.descricao && <p className="text-sm whitespace-pre-wrap">{detailTask.descricao}</p>}
              {detailTask.data_prevista && (
                <p className="text-sm text-muted-foreground">Prazo: {format(new Date(detailTask.data_prevista + "T12:00:00"), "dd/MM/yyyy")}</p>
              )}
              {detailTask.concluido_em && (
                <p className="text-sm text-green-600">Concluída em: {format(new Date(detailTask.concluido_em), "dd/MM/yyyy HH:mm")}</p>
              )}

              {/* Photos */}
              {taskFotos && taskFotos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Fotos</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {taskFotos.map(f => (
                      <a key={f.id} href={f.foto_url} target="_blank" rel="noopener noreferrer">
                        <img src={f.foto_url} alt="Foto" className="w-full h-24 object-cover rounded border" />
                        <span className="text-xs text-muted-foreground">{f.tipo === "conclusao" ? "Conclusão" : "Descrição"}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Updates timeline */}
              {taskUpdates && taskUpdates.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Atualizações</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {taskUpdates.map(u => (
                      <div key={u.id} className="border rounded p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {u.tipo === "status" ? "Status" : u.tipo === "pendencia" ? "Pendência" : "Comentário"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{format(new Date(u.created_at), "dd/MM/yyyy HH:mm")}</span>
                        </div>
                        {u.tipo === "status" && <p className="mt-1">{STATUS_LABELS[u.status_anterior || ""] || u.status_anterior} → {STATUS_LABELS[u.status_novo || ""] || u.status_novo}</p>}
                        {u.conteudo && <p className="mt-1 text-muted-foreground">{u.conteudo}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
