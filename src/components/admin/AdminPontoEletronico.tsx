import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, RefreshCw, Pencil, Wifi, WifiOff, Clock } from "lucide-react";
import { EquipamentoFormDialog } from "./EquipamentoFormDialog";
import { toast } from "sonner";

function formatCpf(c: string) {
  const d = String(c || "").replace(/\D/g, "").padStart(11, "0");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function isOnline(ultima: string | null) {
  if (!ultima) return false;
  const diff = Date.now() - new Date(ultima).getTime();
  return diff < 24 * 60 * 60 * 1000; // 24h
}

export function AdminPontoEletronico() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [filtroCpf, setFiltroCpf] = useState("");
  const [filtroData, setFiltroData] = useState("");

  const { data: equipamentos = [], isLoading: loadingEquip } = useQuery({
    queryKey: ["equipamentos_ponto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_ponto")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: marcacoes = [], isLoading: loadingMarc } = useQuery({
    queryKey: ["registros_ponto_recentes", filtroCpf, filtroData],
    queryFn: async () => {
      let q = supabase
        .from("registros_ponto")
        .select("*")
        .order("data_hora", { ascending: false, nullsFirst: false })
        .limit(100);
      if (filtroCpf) {
        const cpfDigits = filtroCpf.replace(/\D/g, "");
        if (cpfDigits) q = q.ilike("cpf", `%${cpfDigits}%`);
      }
      if (filtroData) q = q.eq("data", filtroData);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const handleSync = async (equipamentoId: string | null) => {
    setSyncing(equipamentoId || "all");
    try {
      const { data, error } = await supabase.functions.invoke("sync-controlid", {
        body: equipamentoId ? { equipamento_id: equipamentoId } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Sincronização concluída: ${data.novos_registros || 0} novos registros` +
          (data.cpfs_nao_encontrados ? ` • ${data.cpfs_nao_encontrados} CPFs não cadastrados` : "") +
          (data.erros?.length ? ` • ${data.erros.length} erros` : ""),
      );
      if (data.erros?.length) {
        console.error("Erros sync:", data.erros);
      }
      qc.invalidateQueries({ queryKey: ["equipamentos_ponto"] });
      qc.invalidateQueries({ queryKey: ["registros_ponto_recentes"] });
    } catch (err: any) {
      toast.error(`Falha na sincronização: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Ponto Eletrônico (Control iD)</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSync(null)}
            disabled={syncing !== null || equipamentos.length === 0}
          >
            {syncing === "all" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Sincronizar Todos
          </Button>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />Novo Equipamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEquip ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : equipamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum equipamento cadastrado. Clique em "Novo Equipamento" para começar.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Nº Série</TableHead>
                    <TableHead>Última Sincronização</TableHead>
                    <TableHead>Último NSR</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipamentos.map((e) => {
                    const online = isOnline(e.ultima_sincronizacao);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          {e.ativo ? (
                            online ? (
                              <Badge variant="default" className="gap-1"><Wifi className="h-3 w-3" />Online</Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" />Sem dados 24h</Badge>
                            )
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell>{e.modelo || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{e.numero_serie || "—"}</TableCell>
                        <TableCell>{formatDateTime(e.ultima_sincronizacao)}</TableCell>
                        <TableCell>{e.ultimo_nsr || 0}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSync(e.id)}
                              disabled={syncing !== null || !e.ativo}
                            >
                              {syncing === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(e); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />Últimas Marcações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Filtrar por CPF"
              value={filtroCpf}
              onChange={(e) => setFiltroCpf(e.target.value)}
              className="sm:max-w-xs"
            />
            <Input
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
              className="sm:max-w-xs"
            />
            {(filtroCpf || filtroData) && (
              <Button variant="ghost" onClick={() => { setFiltroCpf(""); setFiltroData(""); }}>Limpar</Button>
            )}
          </div>
          {loadingMarc ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : marcacoes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma marcação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPF</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>NSR</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marcacoes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">{formatCpf(m.cpf)}</TableCell>
                      <TableCell>{m.data_hora ? formatDateTime(m.data_hora) : `${m.data} ${m.entrada_1 || ""}`}</TableCell>
                      <TableCell>{m.nsr || "—"}</TableCell>
                      <TableCell>{m.tipo_marcacao || m.ocorrencia || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EquipamentoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipamento={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["equipamentos_ponto"] })}
      />
    </div>
  );
}
