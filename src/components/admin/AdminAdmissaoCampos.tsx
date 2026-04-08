import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, GripVertical, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const TIPOS = [
  { value: "text", label: "Texto" },
  { value: "date", label: "Data" },
  { value: "email", label: "E-mail" },
  { value: "cpf", label: "CPF" },
  { value: "cep", label: "CEP" },
  { value: "select", label: "Seleção" },
  { value: "textarea", label: "Texto Longo" },
  { value: "boolean", label: "Sim/Não" },
];

export function AdminAdmissaoCampos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [novoCampo, setNovoCampo] = useState({
    campo_nome: "", label: "", tipo: "text", opcoes: "", obrigatorio: false, grupo: "Geral", placeholder: "",
  });

  const { data: campos, isLoading } = useQuery({
    queryKey: ["admissao-campos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissao_campos").select("*").order("ordem");
      if (error) throw error;
      return data;
    },
  });

  const { data: admissoes, isLoading: loadingAdmissoes } = useQuery({
    queryKey: ["admin-admissoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissoes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("admissao_campos").update({ ativo: !ativo }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
  };

  const toggleObrigatorio = async (id: string, obrigatorio: boolean) => {
    await supabase.from("admissao_campos").update({ obrigatorio: !obrigatorio }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
  };

  const handleDelete = async (id: string) => {
    await supabase.from("admissao_campos").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
    toast({ title: "Campo removido" });
  };

  const handleAdd = async () => {
    if (!novoCampo.campo_nome || !novoCampo.label) {
      toast({ title: "Preencha nome e label", variant: "destructive" });
      return;
    }
    const slug = novoCampo.campo_nome.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const maxOrdem = campos?.reduce((max, c) => Math.max(max, c.ordem), 0) || 0;
    const opcoes = novoCampo.opcoes ? novoCampo.opcoes.split(",").map((o) => o.trim()).filter(Boolean) : [];

    const { error } = await supabase.from("admissao_campos").insert({
      campo_nome: slug,
      label: novoCampo.label,
      tipo: novoCampo.tipo,
      opcoes,
      obrigatorio: novoCampo.obrigatorio,
      grupo: novoCampo.grupo,
      placeholder: novoCampo.placeholder,
      ordem: maxOrdem + 1,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    setNovoCampo({ campo_nome: "", label: "", tipo: "text", opcoes: "", obrigatorio: false, grupo: "Geral", placeholder: "" });
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
    toast({ title: "Campo adicionado" });
  };

  const updateLabel = async (id: string, label: string) => {
    await supabase.from("admissao_campos").update({ label }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
  };

  const grupos = campos ? [...new Set(campos.map((c) => c.grupo))] : [];

  const formatCpf = (v: string) => {
    if (!v) return "";
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  };

  return (
    <div className="space-y-6">
      {/* Config dos campos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campos do Formulário de Admissão</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Campo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Adicionar Campo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome interno (sem espaços/acentos)</Label>
                  <Input value={novoCampo.campo_nome} onChange={(e) => setNovoCampo(p => ({ ...p, campo_nome: e.target.value }))} placeholder="ex: numero_registro" />
                </div>
                <div className="space-y-2">
                  <Label>Label (exibido no formulário)</Label>
                  <Input value={novoCampo.label} onChange={(e) => setNovoCampo(p => ({ ...p, label: e.target.value }))} placeholder="ex: Número de Registro" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={novoCampo.tipo} onValueChange={(v) => setNovoCampo(p => ({ ...p, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {novoCampo.tipo === "select" && (
                  <div className="space-y-2">
                    <Label>Opções (separadas por vírgula)</Label>
                    <Input value={novoCampo.opcoes} onChange={(e) => setNovoCampo(p => ({ ...p, opcoes: e.target.value }))} placeholder="Opção 1, Opção 2, Opção 3" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Grupo/Seção</Label>
                  <Input value={novoCampo.grupo} onChange={(e) => setNovoCampo(p => ({ ...p, grupo: e.target.value }))} placeholder="ex: Dados Pessoais" />
                </div>
                <div className="space-y-2">
                  <Label>Placeholder</Label>
                  <Input value={novoCampo.placeholder} onChange={(e) => setNovoCampo(p => ({ ...p, placeholder: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={novoCampo.obrigatorio} onCheckedChange={(v) => setNovoCampo(p => ({ ...p, obrigatorio: v }))} />
                  <Label>Obrigatório</Label>
                </div>
                <Button onClick={handleAdd} className="w-full">Adicionar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : (
            <div className="space-y-4">
              {grupos.map((grupo) => (
                <div key={grupo}>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">{grupo}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Obrigatório</TableHead>
                        <TableHead className="text-center">Ativo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(campos || []).filter((c) => c.grupo === grupo).map((campo) => (
                        <TableRow key={campo.id}>
                          <TableCell className="font-medium">{campo.label}</TableCell>
                          <TableCell>{TIPOS.find((t) => t.value === campo.tipo)?.label || campo.tipo}</TableCell>
                          <TableCell className="text-center">
                            <Switch checked={campo.obrigatorio} onCheckedChange={() => toggleObrigatorio(campo.id, campo.obrigatorio)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={campo.ativo} onCheckedChange={() => toggleAtivo(campo.id, campo.ativo)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(campo.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admissões recebidas */}
      <Card>
        <CardHeader><CardTitle>Admissões Recebidas</CardTitle></CardHeader>
        <CardContent>
          {loadingAdmissoes ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : !admissoes?.length ? (
            <p className="text-muted-foreground text-center py-4">Nenhuma admissão recebida ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admissoes.map((a) => {
                  const dados = (a.dados || {}) as Record<string, any>;
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{dados.nome_completo || a.nome_completo || "-"}</TableCell>
                      <TableCell>{formatCpf(dados.cpf || a.cpf || "")}</TableCell>
                      <TableCell>{dados.funcao || a.funcao || "-"}</TableCell>
                      <TableCell>{dados.unidade || a.unidade || "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
