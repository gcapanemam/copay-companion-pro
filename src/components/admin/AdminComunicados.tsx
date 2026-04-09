import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, Send, Trash2, Users, Building, Briefcase, Globe } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Comunicado {
  id: string;
  titulo: string;
  mensagem: string;
  tipo_destinatario: string;
  valor_destinatario: string | null;
  criado_por: string | null;
  created_at: string;
}

interface Leitura {
  cpf: string;
  visualizado_em: string | null;
  confirmado_em: string | null;
}

export const AdminComunicados = () => {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedComunicado, setSelectedComunicado] = useState<Comunicado | null>(null);
  const [leituras, setLeituras] = useState<Leitura[]>([]);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [tipoDestinatario, setTipoDestinatario] = useState("todos");
  const [valorDestinatario, setValorDestinatario] = useState("");
  const [selectedCpfs, setSelectedCpfs] = useState<string[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ cpf: string; nome_completo: string; unidade: string | null; departamento: string | null }[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchComunicados(); fetchFuncionarios(); }, []);

  const fetchComunicados = async () => {
    setLoading(true);
    const { data } = await supabase.from("comunicados").select("*").order("created_at", { ascending: false });
    setComunicados(data || []);
    setLoading(false);
  };

  const fetchFuncionarios = async () => {
    const { data } = await supabase.from("admissoes").select("cpf, nome_completo, unidade, departamento");
    const funcs = data || [];
    setFuncionarios(funcs);
    setUnidades([...new Set(funcs.map(f => f.unidade).filter(Boolean) as string[])]);
    setDepartamentos([...new Set(funcs.map(f => f.departamento).filter(Boolean) as string[])]);
  };

  const handleCreate = async () => {
    if (!titulo.trim() || !mensagem.trim()) {
      toast({ title: "Erro", description: "Título e mensagem são obrigatórios.", variant: "destructive" });
      return;
    }
    if ((tipoDestinatario === "unidade" || tipoDestinatario === "departamento") && !valorDestinatario) {
      toast({ title: "Erro", description: "Selecione o valor do destinatário.", variant: "destructive" });
      return;
    }
    if (tipoDestinatario === "selecionados" && selectedCpfs.length === 0) {
      toast({ title: "Erro", description: "Selecione ao menos um funcionário.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: created, error } = await supabase.from("comunicados").insert({
        titulo,
        mensagem,
        tipo_destinatario: tipoDestinatario,
        valor_destinatario: tipoDestinatario === "unidade" || tipoDestinatario === "departamento" ? valorDestinatario : null,
      }).select().single();

      if (error) throw error;

      if (tipoDestinatario === "selecionados" && created) {
        const rows = selectedCpfs.map(cpf => ({ comunicado_id: created.id, cpf }));
        await supabase.from("comunicado_destinatarios").insert(rows);
      }

      toast({ title: "Sucesso", description: "Comunicado enviado." });
      setOpenCreate(false);
      setTitulo(""); setMensagem(""); setTipoDestinatario("todos"); setValorDestinatario(""); setSelectedCpfs([]);
      fetchComunicados();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("comunicados").delete().eq("id", id);
    toast({ title: "Comunicado excluído" });
    fetchComunicados();
  };

  const viewDetails = async (c: Comunicado) => {
    setSelectedComunicado(c);

    // Determine target CPFs
    let targetCpfs: string[] = [];
    if (c.tipo_destinatario === "todos") {
      targetCpfs = funcionarios.map(f => f.cpf);
    } else if (c.tipo_destinatario === "unidade") {
      targetCpfs = funcionarios.filter(f => f.unidade === c.valor_destinatario).map(f => f.cpf);
    } else if (c.tipo_destinatario === "departamento") {
      targetCpfs = funcionarios.filter(f => f.departamento === c.valor_destinatario).map(f => f.cpf);
    } else {
      const { data: dests } = await supabase.from("comunicado_destinatarios").select("cpf").eq("comunicado_id", c.id);
      targetCpfs = (dests || []).map(d => d.cpf);
    }

    const { data: reads } = await supabase.from("comunicado_leituras").select("cpf, visualizado_em, confirmado_em").eq("comunicado_id", c.id);
    const readsMap = new Map((reads || []).map(r => [r.cpf, r]));

    const result: Leitura[] = targetCpfs.map(cpf => {
      const r = readsMap.get(cpf);
      return { cpf, visualizado_em: r?.visualizado_em || null, confirmado_em: r?.confirmado_em || null };
    });

    setLeituras(result);
    setOpenDetail(true);
  };

  const getNome = (cpf: string) => funcionarios.find(f => f.cpf === cpf)?.nome_completo || cpf;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "-";

  const tipoLabel = (tipo: string, valor: string | null) => {
    if (tipo === "todos") return "Todos";
    if (tipo === "unidade") return `Unidade: ${valor}`;
    if (tipo === "departamento") return `Depto: ${valor}`;
    return "Selecionados";
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === "todos") return <Globe className="h-3 w-3" />;
    if (tipo === "unidade") return <Building className="h-3 w-3" />;
    if (tipo === "departamento") return <Briefcase className="h-3 w-3" />;
    return <Users className="h-3 w-3" />;
  };

  const toggleCpf = (cpf: string) => {
    setSelectedCpfs(prev => prev.includes(cpf) ? prev.filter(c => c !== cpf) : [...prev, cpf]);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Comunicados</h2>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Novo Comunicado</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Comunicado</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do comunicado" />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Conteúdo do comunicado" rows={5} />
              </div>
              <div className="space-y-2">
                <Label>Destinatários</Label>
                <Select value={tipoDestinatario} onValueChange={v => { setTipoDestinatario(v); setValorDestinatario(""); setSelectedCpfs([]); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os funcionários</SelectItem>
                    <SelectItem value="unidade">Por unidade</SelectItem>
                    <SelectItem value="departamento">Por departamento</SelectItem>
                    <SelectItem value="selecionados">Selecionar funcionários</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoDestinatario === "unidade" && (
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Select value={valorDestinatario} onValueChange={setValorDestinatario}>
                    <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {tipoDestinatario === "departamento" && (
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={valorDestinatario} onValueChange={setValorDestinatario}>
                    <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
                    <SelectContent>
                      {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {tipoDestinatario === "selecionados" && (
                <div className="space-y-2">
                  <Label>Funcionários ({selectedCpfs.length} selecionados)</Label>
                  <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                    {funcionarios.map(f => (
                      <label key={f.cpf} className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer text-sm">
                        <Checkbox checked={selectedCpfs.includes(f.cpf)} onCheckedChange={() => toggleCpf(f.cpf)} />
                        <span>{f.nome_completo}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{f.unidade || ""}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleCreate} disabled={saving} className="w-full">
                <Send className="h-4 w-4 mr-1" />{saving ? "Enviando..." : "Enviar Comunicado"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? <p className="text-muted-foreground text-sm">Carregando...</p> : comunicados.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Nenhum comunicado enviado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Destinatários</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comunicados.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium">{c.titulo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {tipoIcon(c.tipo_destinatario)}
                        {tipoLabel(c.tipo_destinatario, c.valor_destinatario)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => viewDetails(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir comunicado?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={openDetail} onOpenChange={setOpenDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedComunicado?.titulo}</DialogTitle></DialogHeader>
          {selectedComunicado && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{selectedComunicado.mensagem}</p>
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Enviado: {formatDate(selectedComunicado.created_at)}</span>
                <Badge variant="outline" className="gap-1">
                  {tipoIcon(selectedComunicado.tipo_destinatario)}
                  {tipoLabel(selectedComunicado.tipo_destinatario, selectedComunicado.valor_destinatario)}
                </Badge>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Status de Leitura ({leituras.filter(l => l.visualizado_em).length}/{leituras.length} visualizaram)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Visualizado</TableHead>
                      <TableHead>Confirmado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leituras.map(l => (
                      <TableRow key={l.cpf}>
                        <TableCell>{getNome(l.cpf)}</TableCell>
                        <TableCell>
                          {l.visualizado_em ? (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">{formatDate(l.visualizado_em)}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Não visto</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {l.confirmado_em ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200">{formatDate(l.confirmado_em)}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Não confirmado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
