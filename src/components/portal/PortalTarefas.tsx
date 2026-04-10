import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Clock, Play, CheckCircle2, AlertTriangle, Image as ImageIcon } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
};

const STATUS_ICONS: Record<string, any> = {
  pendente: Clock,
  em_andamento: Play,
  concluida: CheckCircle2,
};

interface Props {
  cpf: string;
  departamento?: string | null;
  unidade?: string | null;
}

export function PortalTarefas({ cpf, departamento, unidade }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [pendenciaText, setPendenciaText] = useState("");
  const [fotosConclusao, setFotosConclusao] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["portal-tarefas", cpf],
    queryFn: async () => {
      // Fetch tasks targeted to this user by CPF, department, or unit
      let allTasks: any[] = [];
      const { data: byCpf } = await supabase.from("tarefas").select("*").eq("tipo_destinatario", "funcionario").eq("valor_destinatario", cpf).order("created_at", { ascending: false });
      allTasks.push(...(byCpf || []));

      if (departamento) {
        const { data: byDepto } = await supabase.from("tarefas").select("*").eq("tipo_destinatario", "departamento").eq("valor_destinatario", departamento).order("created_at", { ascending: false });
        allTasks.push(...(byDepto || []));
      }
      if (unidade) {
        const { data: byUnidade } = await supabase.from("tarefas").select("*").eq("tipo_destinatario", "unidade").eq("valor_destinatario", unidade).order("created_at", { ascending: false });
        allTasks.push(...(byUnidade || []));
      }

      // Deduplicate by id
      const seen = new Set<string>();
      return allTasks.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
    },
  });

  const { data: taskFotos } = useQuery({
    queryKey: ["portal-tarefa-fotos", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const { data } = await supabase.from("tarefa_fotos").select("*").eq("tarefa_id", selectedTask.id).order("created_at");
      return data || [];
    },
    enabled: !!selectedTask,
  });

  const { data: taskUpdates } = useQuery({
    queryKey: ["portal-tarefa-updates", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const { data } = await supabase.from("tarefa_atualizacoes").select("*").eq("tarefa_id", selectedTask.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedTask,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["portal-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["portal-tarefa-fotos", selectedTask?.id] });
    queryClient.invalidateQueries({ queryKey: ["portal-tarefa-updates", selectedTask?.id] });
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === "concluida") updateData.concluido_em = new Date().toISOString();

      // Upload conclusion photos
      if (newStatus === "concluida" && fotosConclusao.length > 0) {
        for (const foto of fotosConclusao) {
          const path = `${selectedTask.id}/conclusao_${Date.now()}_${foto.name}`;
          const { error: upErr } = await supabase.storage.from("tarefas-fotos").upload(path, foto);
          if (upErr) throw upErr;
          const { data: urlData } = supabase.storage.from("tarefas-fotos").getPublicUrl(path);
          await supabase.from("tarefa_fotos").insert({ tarefa_id: selectedTask.id, foto_url: urlData.publicUrl, tipo: "conclusao" });
        }
      }

      await supabase.from("tarefas").update(updateData).eq("id", selectedTask.id);
      await supabase.from("tarefa_atualizacoes").insert({
        tarefa_id: selectedTask.id,
        cpf,
        tipo: "status",
        status_anterior: selectedTask.status,
        status_novo: newStatus,
      });

      setSelectedTask({ ...selectedTask, ...updateData });
      setFotosConclusao([]);
      invalidateAll();
      toast({ title: `Status atualizado para "${STATUS_LABELS[newStatus]}"` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePendencia = async () => {
    if (!selectedTask || !pendenciaText.trim()) return;
    setSaving(true);
    try {
      await supabase.from("tarefa_atualizacoes").insert({
        tarefa_id: selectedTask.id,
        cpf,
        tipo: "pendencia",
        conteudo: pendenciaText.trim(),
      });
      setPendenciaText("");
      invalidateAll();
      toast({ title: "Pendência registrada" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const pendentes = (tarefas || []).filter(t => t.status === "pendente");
  const emAndamento = (tarefas || []).filter(t => t.status === "em_andamento");
  const concluidas = (tarefas || []).filter(t => t.status === "concluida");

  const TaskCard = ({ task }: { task: any }) => {
    const Icon = STATUS_ICONS[task.status] || Clock;
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTask(task)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{task.titulo}</h4>
              {task.descricao && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{task.descricao}</p>}
            </div>
            <Icon className={`h-5 w-5 flex-shrink-0 ${task.status === "concluida" ? "text-green-500" : task.status === "em_andamento" ? "text-blue-500" : "text-yellow-500"}`} />
          </div>
          {task.data_prevista && (
            <p className="text-xs text-muted-foreground mt-2">Prazo: {format(new Date(task.data_prevista + "T12:00:00"), "dd/MM/yyyy")}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {(tarefas || []).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma tarefa atribuída.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-yellow-500" />Pendentes ({pendentes.length})</h3>
            {pendentes.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Play className="h-4 w-4 text-blue-500" />Em andamento ({emAndamento.length})</h3>
            {emAndamento.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" />Concluídas ({concluidas.length})</h3>
            {concluidas.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </div>
      )}

      {/* Task detail dialog */}
      <Dialog open={!!selectedTask} onOpenChange={v => { if (!v) { setSelectedTask(null); setPendenciaText(""); setFotosConclusao([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedTask?.titulo}</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <Badge className={selectedTask.status === "concluida" ? "bg-green-100 text-green-800" : selectedTask.status === "em_andamento" ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}>
                {STATUS_LABELS[selectedTask.status]}
              </Badge>
              {selectedTask.descricao && <p className="text-sm whitespace-pre-wrap">{selectedTask.descricao}</p>}
              {selectedTask.data_prevista && <p className="text-sm text-muted-foreground">Prazo: {format(new Date(selectedTask.data_prevista + "T12:00:00"), "dd/MM/yyyy")}</p>}

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

              {/* Action buttons */}
              {selectedTask.status !== "concluida" && (
                <div className="space-y-3 border-t pt-3">
                  {selectedTask.status === "pendente" && (
                    <Button onClick={() => handleChangeStatus("em_andamento")} disabled={saving} className="w-full">
                      <Play className="h-4 w-4 mr-1" />Iniciar Tarefa
                    </Button>
                  )}
                  {selectedTask.status === "em_andamento" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Fotos de conclusão</Label>
                        <Input type="file" accept="image/*" multiple onChange={e => setFotosConclusao(Array.from(e.target.files || []))} />
                        {fotosConclusao.length > 0 && <p className="text-xs text-muted-foreground">{fotosConclusao.length} foto(s)</p>}
                      </div>
                      <Button onClick={() => handleChangeStatus("concluida")} disabled={saving} className="w-full bg-green-600 hover:bg-green-700">
                        <CheckCircle2 className="h-4 w-4 mr-1" />Concluir Tarefa
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Registrar pendência</Label>
                    <Textarea value={pendenciaText} onChange={e => setPendenciaText(e.target.value)} placeholder="Descreva a pendência..." rows={2} />
                    <Button variant="outline" onClick={handlePendencia} disabled={saving || !pendenciaText.trim()} className="w-full">
                      <AlertTriangle className="h-4 w-4 mr-1" />Registrar Pendência
                    </Button>
                  </div>
                </div>
              )}

              {/* Updates */}
              {taskUpdates && taskUpdates.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <h4 className="font-medium text-sm">Histórico</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
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
