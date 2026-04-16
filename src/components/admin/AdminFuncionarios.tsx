import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, Search, Users, UserX, Eye, Trash2, CloudDownload } from "lucide-react";
import { FichaFuncionalDialog } from "./FichaFuncionalDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function normalizeCpf(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 11) return "";
  return digits.padStart(11, "0");
}

export function AdminFuncionarios() {
  const [filtroUnidade, setFiltroUnidade] = useState("__all__");
  const [filtroDepartamento, setFiltroDepartamento] = useState("__all__");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [selectedCpfs, setSelectedCpfs] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ running: boolean; progress: number; total: number; success: number; errors: number; already: number } | null>(null);
  const importAbortRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: admissoes, isLoading: loadingAdmissoes } = useQuery({
    queryKey: ["admin-admissoes-func"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissoes").select("*").order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const { data: titulares, isLoading: loadingTitulares } = useQuery({
    queryKey: ["admin-titulares-func"],
    queryFn: async () => {
      const { data, error } = await supabase.from("titulares").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const formatCpf = (v: string) => {
    const n = normalizeCpf(v);
    if (!n) return "";
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
  };

  const funcionarios = (() => {
    const map = new Map<string, any>();
    (titulares || []).forEach((t) => {
      const cpf = normalizeCpf(t.cpf);
      if (cpf) map.set(cpf, { nome: t.nome, cpf, origem: "Plano de Saúde", dados: {}, titularId: t.id });
    });
    (admissoes || []).forEach((a) => {
      const dados = (a.dados || {}) as Record<string, any>;
      const cpf = normalizeCpf(a.cpf) || normalizeCpf(dados.cpf);
      const nome = dados.nome_completo || a.nome_completo || "";
      if (!cpf) return;
      if (map.has(cpf)) {
        const existing = map.get(cpf)!;
        existing.origem = "Ambos";
        existing.dados = dados;
        existing.admissao = a;
      } else {
        map.set(cpf, { nome, cpf, origem: "Admissão", dados, admissao: a });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  })();

  const unidades = [...new Set(funcionarios.map(f => f.dados?.unidade || f.admissao?.unidade || "").filter(Boolean))].sort();
  const departamentos = [...new Set(funcionarios.map(f => f.dados?.departamento || f.admissao?.departamento || "").filter(Boolean))].sort();

  const applyFilters = (list: any[]) => {
    return list.filter((f) => {
      const term = busca.toLowerCase();
      const matchNome = f.nome.toLowerCase().includes(term) || f.cpf.includes(busca.replace(/\D/g, ""));
      const uni = f.dados?.unidade || f.admissao?.unidade || "";
      const dep = f.dados?.departamento || f.admissao?.departamento || "";
      const matchUnidade = filtroUnidade === "__all__" || uni === filtroUnidade;
      const matchDep = filtroDepartamento === "__all__" || dep === filtroDepartamento;
      return matchNome && matchUnidade && matchDep;
    });
  };

  const isInativo = (f: any) => {
    const demissao = f.admissao?.data_demissao || f.dados?.data_demissao;
    return !!demissao;
  };

  const ativos = applyFilters(funcionarios.filter(f => !isInativo(f)));
  const inativos = applyFilters(funcionarios.filter(f => isInativo(f)));

  const getFotoUrl = (f: any) => {
    const fotoUrl = f.admissao?.foto_url;
    if (!fotoUrl) return null;
    const { data } = supabase.storage.from("funcionarios-fotos").getPublicUrl(fotoUrl);
    return data?.publicUrl || null;
  };

  const toggleCpf = (cpf: string) => {
    setSelectedCpfs(prev => {
      const next = new Set(prev);
      if (next.has(cpf)) next.delete(cpf);
      else next.add(cpf);
      return next;
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const cpfsToDelete = Array.from(selectedCpfs);
      const funcsToDelete = funcionarios.filter(f => cpfsToDelete.includes(f.cpf));

      for (const func of funcsToDelete) {
        if (func.admissao) {
          const { error } = await supabase.from("admissoes").delete().eq("id", func.admissao.id);
          if (error) throw error;
        }
        if (func.titularId) {
          await supabase.from("dependentes").delete().eq("titular_id", func.titularId);
          const { error } = await supabase.from("titulares").delete().eq("id", func.titularId);
          if (error) throw error;
        }
      }

      toast.success(`${cpfsToDelete.length} funcionário(s) excluído(s) com sucesso.`);
      setSelectedCpfs(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-admissoes-func"] });
      queryClient.invalidateQueries({ queryKey: ["admin-titulares-func"] });
    } catch (err: any) {
      toast.error("Erro ao excluir: " + (err.message || "Tente novamente."));
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkImport = useCallback(async () => {
    importAbortRef.current = false;
    const totalFuncs = funcionarios.length;
    setImportStatus({ running: true, progress: 0, total: totalFuncs, success: 0, errors: 0, already: 0 });
    
    let totalSuccess = 0;
    let totalErrors = 0;
    let totalAlready = 0;
    const batchSize = 2;
    
    for (let offset = 0; offset < totalFuncs; offset += batchSize) {
      if (importAbortRef.current) break;
      
      try {
        const { data, error } = await supabase.functions.invoke("import-drive-files", {
          body: { limit: batchSize, offset },
        });
        
        if (error) {
          totalErrors += batchSize;
        } else {
          const result = data as any;
          totalSuccess += result.success || 0;
          totalErrors += result.errors || 0;
          totalAlready += result.already_imported || 0;
        }
      } catch {
        totalErrors += batchSize;
      }
      
      setImportStatus({
        running: true,
        progress: Math.min(offset + batchSize, totalFuncs),
        total: totalFuncs,
        success: totalSuccess,
        errors: totalErrors,
        already: totalAlready,
      });
    }
    
    setImportStatus(prev => prev ? { ...prev, running: false } : null);
    toast.success(`Importação concluída: ${totalSuccess} importados, ${totalAlready} já existiam, ${totalErrors} erros.`);
    queryClient.invalidateQueries({ queryKey: ["admin-admissoes-func"] });
  }, [funcionarios.length, queryClient]);

  const renderTable = (list: any[], showDemissao = false) => {
    if (!list.length) {
      return <p className="text-muted-foreground text-center py-4">Nenhum funcionário encontrado.</p>;
    }

    return (
      <div className="max-h-[500px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={list.length > 0 && list.every(f => selectedCpfs.has(f.cpf))}
                  onCheckedChange={() => {
                    const allSelected = list.every(f => selectedCpfs.has(f.cpf));
                    setSelectedCpfs(prev => {
                      const next = new Set(prev);
                      list.forEach(f => allSelected ? next.delete(f.cpf) : next.add(f.cpf));
                      return next;
                    });
                  }}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Departamento</TableHead>
              {showDemissao && <TableHead>Demissão</TableHead>}
              <TableHead>Origem</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((f) => {
              const foto = getFotoUrl(f);
              return (
                <TableRow key={f.cpf} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(f)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedCpfs.has(f.cpf)}
                      onCheckedChange={() => toggleCpf(f.cpf)}
                    />
                  </TableCell>
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      {foto && <AvatarImage src={foto} />}
                      <AvatarFallback className="text-xs">{getInitials(f.nome)}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{f.nome}</TableCell>
                  <TableCell>{formatCpf(f.cpf)}</TableCell>
                  <TableCell>{f.dados?.funcao || f.admissao?.funcao || "-"}</TableCell>
                  <TableCell>{f.dados?.unidade || f.admissao?.unidade || "-"}</TableCell>
                  <TableCell>{f.dados?.departamento || f.admissao?.departamento || "-"}</TableCell>
                  {showDemissao && (
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        {f.admissao?.data_demissao || f.dados?.data_demissao || "-"}
                      </Badge>
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={f.origem === "Ambos" ? "default" : "secondary"}>{f.origem}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Ver como funcionário"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/minha-area?admin_cpf=${f.cpf}`, "_blank");
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  const isLoading = loadingAdmissoes || loadingTitulares;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Funcionários ({funcionarios.length})</CardTitle>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {selectedCpfs.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedCpfs.size})
              </Button>
            )}
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas Unidades</SelectItem>
                {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos Departamentos</SelectItem>
                {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : (
            <Tabs defaultValue="ativos">
              <TabsList className="mb-4">
                <TabsTrigger value="ativos" className="gap-2">
                  <Users className="h-4 w-4" />
                  Ativos ({ativos.length})
                </TabsTrigger>
                <TabsTrigger value="inativos" className="gap-2">
                  <UserX className="h-4 w-4" />
                  Inativos ({inativos.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="ativos">
                {renderTable(ativos)}
              </TabsContent>
              <TabsContent value="inativos">
                {renderTable(inativos, true)}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <FichaFuncionalDialog
        funcionario={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedCpfs.size} funcionário(s)? Esta ação não pode ser desfeita.
              Os registros serão removidos das tabelas de admissão e plano de saúde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
