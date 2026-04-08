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
import { Loader2, Plus, Trash2, Upload, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import * as XLSX from "xlsx";

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

const EMPTY_CAMPO = { campo_nome: "", label: "", tipo: "text", opcoes: "", obrigatorio: false, grupo: "Geral", placeholder: "" };

export function AdminAdmissaoCampos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_CAMPO);

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

  const handleMove = async (campo: any, direction: "up" | "down") => {
    if (!campos) return;
    const grupoCampos = campos.filter((c) => c.grupo === campo.grupo).sort((a, b) => a.ordem - b.ordem);
    const idx = grupoCampos.findIndex((c) => c.id === campo.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= grupoCampos.length) return;
    const other = grupoCampos[swapIdx];
    await Promise.all([
      supabase.from("admissao_campos").update({ ordem: other.ordem }).eq("id", campo.id),
      supabase.from("admissao_campos").update({ ordem: campo.ordem }).eq("id", other.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_CAMPO);
    setDialogOpen(true);
  };

  const openEdit = (campo: any) => {
    setEditingId(campo.id);
    setForm({
      campo_nome: campo.campo_nome,
      label: campo.label,
      tipo: campo.tipo,
      opcoes: (campo.opcoes || []).join(", "),
      obrigatorio: campo.obrigatorio,
      grupo: campo.grupo,
      placeholder: campo.placeholder || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.campo_nome || !form.label) {
      toast({ title: "Preencha nome e label", variant: "destructive" });
      return;
    }
    const slug = form.campo_nome.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const opcoes = form.opcoes ? form.opcoes.split(",").map((o) => o.trim()).filter(Boolean) : [];

    if (editingId) {
      const { error } = await supabase.from("admissao_campos").update({
        campo_nome: slug,
        label: form.label,
        tipo: form.tipo,
        opcoes,
        obrigatorio: form.obrigatorio,
        grupo: form.grupo,
        placeholder: form.placeholder || null,
      }).eq("id", editingId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Campo atualizado" });
    } else {
      const maxOrdem = campos?.reduce((max, c) => Math.max(max, c.ordem), 0) || 0;
      const { error } = await supabase.from("admissao_campos").insert({
        campo_nome: slug, label: form.label, tipo: form.tipo, opcoes, obrigatorio: form.obrigatorio, grupo: form.grupo, placeholder: form.placeholder || null, ordem: maxOrdem + 1,
      });
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Campo adicionado" });
    }

    setDialogOpen(false);
    setForm(EMPTY_CAMPO);
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["admissao-campos"] });
  };

  // --- Import logic ---
  const COLUMN_MAP: Record<string, string> = {
    "Unidade": "unidade", "Nome Completo": "nome_completo", "Data de Nascimento": "data_nascimento",
    "CPF (somente números, sem traço nem pontos)": "cpf", "RG": "rg", "DATA EXPEDIÇÃO RG": "data_expedicao_rg",
    "Títutlo de Eleitor": "titulo_eleitor", "Número do PIS (somente números, sem traço nem pontos)": "numero_pis",
    "DATA CADASTRO PIS": "data_cadastro_pis", "Número da Carteira de Trabalho": "numero_ctps",
    "Série da Carteira de Trabalho": "serie_ctps", "Emissão da Carteira de Trabalho": "emissao_ctps",
    "Estado Civil": "estado_civil", "Grau de Escolaridade": "escolaridade",
    "Endereço Completo (rua, número)": "endereco", "Bairro": "bairro", "CEP": "cep",
    "Nome da Mãe": "nome_mae", "Nome do Pai": "nome_pai", "Local de Nascimento (Cidade)": "local_nascimento",
    "Sexo": "sexo", "Primeiro Emprego?": "primeiro_emprego", "Irá precisar de vale transporte?": "vale_transporte",
    "Horário de Trabalho": "horario_trabalho",
    "Se marcou Sim para Vale transporte, especificar ônibus e valores por dia.": "detalhes_vale_transporte",
    "Telefone": "telefone",
    "Conta do Banco ITAÚ (Agência e Conta) - Caso não tenha conta no Banco Itaú, favor realizar a abertura de conta através do aplicativo do Itaú. Ela poderá ser uma conta salário e fazer a portabilidade para sua conta atual. Caso não tenha conta bo Banco Itaú, favor informar seu PIX.": "dados_bancarios",
    "E-mail pessoal": "email", "Cor": "cor",
    "CPF dos dependentes de você (no Imposto de Renda) caso sejam maiores de 14 anos": "cpf_dependentes",
    "Nome Completo do Conjuge (se aplicável)": "nome_conjuge", "CPF do Conjuge (se aplicável)": "cpf_conjuge",
    "Função que exercerá na empresa:": "funcao",
    "Filhos ou Cônjuge são dependentes na Declaração de IR? Se sim, detalhar quais são.": "dependentes_ir",
    "Qual primeiro dia de trabalho aqui na escola?": "primeiro_dia_trabalho",
    "Você tem interesse em contratar o plano?": "interesse_plano",
    "Tenho interesse no seguinte plano: obs: o plano escolhido pelo funcionário deve ser o mesmo para seus dependentes.": "plano_escolhido",
  };

  const handleUploadAdmissao = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    let count = 0;
    for (const row of rows) {
      const dados: Record<string, any> = {};
      let nomeCompleto = "", cpfVal = "";
      for (const [header, value] of Object.entries(row)) {
        if (header === "Carimbo de data/hora") continue;
        const fieldName = COLUMN_MAP[header];
        if (fieldName) {
          const strVal = String(value || "");
          if (fieldName === "nome_completo") nomeCompleto = strVal;
          if (fieldName === "cpf") cpfVal = strVal.replace(/\D/g, "");
          if (fieldName === "primeiro_emprego" || fieldName === "vale_transporte") {
            dados[fieldName] = strVal.toLowerCase().includes("sim");
          } else { dados[fieldName] = strVal; }
        } else {
          const slug = header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
          if (slug) dados[slug] = String(value || "");
        }
      }
      if (!nomeCompleto || !cpfVal) continue;
      await supabase.from("admissoes").insert({ nome_completo: nomeCompleto, cpf: cpfVal, dados });
      count++;
    }
    toast({ title: `${count} admissões importadas!` });
    queryClient.invalidateQueries({ queryKey: ["admin-admissoes"] });
    e.target.value = "";
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campos do Formulário de Admissão</CardTitle>
          <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Novo Campo</Button>
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
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Opções</TableHead>
                        <TableHead className="text-center">Obrig.</TableHead>
                        <TableHead className="text-center">Ativo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(campos || []).filter((c) => c.grupo === grupo).map((campo) => (
                        <TableRow key={campo.id}>
                          <TableCell className="font-medium">{campo.label}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{campo.campo_nome}</TableCell>
                          <TableCell>{TIPOS.find((t) => t.value === campo.tipo)?.label || campo.tipo}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {campo.tipo === "select" ? (campo.opcoes || []).join(", ") || "-" : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={campo.obrigatorio} onCheckedChange={() => toggleObrigatorio(campo.id, campo.obrigatorio)} />
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch checked={campo.ativo} onCheckedChange={() => toggleAtivo(campo.id, campo.ativo)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(campo)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(campo.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
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

      {/* Dialog para adicionar/editar campo */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingId(null); setForm(EMPTY_CAMPO); } else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Campo" : "Adicionar Campo"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome interno (sem espaços/acentos)</Label>
              <Input value={form.campo_nome} onChange={(e) => setForm(p => ({ ...p, campo_nome: e.target.value }))} placeholder="ex: numero_registro" />
            </div>
            <div className="space-y-2">
              <Label>Label (exibido no formulário)</Label>
              <Input value={form.label} onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))} placeholder="ex: Número de Registro" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm(p => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.tipo === "select" && (
              <div className="space-y-2">
                <Label>Opções (separadas por vírgula)</Label>
                <Input value={form.opcoes} onChange={(e) => setForm(p => ({ ...p, opcoes: e.target.value }))} placeholder="Opção 1, Opção 2, Opção 3" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Grupo/Seção</Label>
              <Input value={form.grupo} onChange={(e) => setForm(p => ({ ...p, grupo: e.target.value }))} placeholder="ex: Dados Pessoais" />
            </div>
            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input value={form.placeholder} onChange={(e) => setForm(p => ({ ...p, placeholder: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.obrigatorio} onCheckedChange={(v) => setForm(p => ({ ...p, obrigatorio: v }))} />
              <Label>Obrigatório</Label>
            </div>
            <Button onClick={handleSave} className="w-full">{editingId ? "Salvar Alterações" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admissões recebidas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Admissões Recebidas</CardTitle>
          <div>
            <Label htmlFor="admissao-upload" className="cursor-pointer">
              <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                <Upload className="h-4 w-4" />Importar Planilha
              </div>
            </Label>
            <Input id="admissao-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadAdmissao} />
          </div>
        </CardHeader>
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
