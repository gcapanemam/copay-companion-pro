import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Search, Users, Camera, User, FileText, MapPin, Heart, Briefcase, Phone, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function FichaSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm text-muted-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {children}
      </div>
    </div>
  );
}

function FichaField({ label, value }: { label: string; value: any }) {
  if (!value && value !== false) return null;
  const display = typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value);
  return (
    <div className="py-0.5">
      <span className="font-medium text-muted-foreground">{label}:</span>{" "}
      <span>{display}</span>
    </div>
  );
}

export function AdminFuncionarios() {
  const [filtroUnidade, setFiltroUnidade] = useState("__all__");
  const [filtroDepartamento, setFiltroDepartamento] = useState("__all__");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
    if (!v) return "";
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
    return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
  };

  const funcionarios = (() => {
    const map = new Map<string, any>();
    (titulares || []).forEach((t) => {
      const cpf = t.cpf?.replace(/\D/g, "") || "";
      if (cpf) map.set(cpf, { nome: t.nome, cpf, origem: "Plano de Saúde", dados: {} });
    });
    (admissoes || []).forEach((a) => {
      const dados = (a.dados || {}) as Record<string, any>;
      const cpf = (dados.cpf || a.cpf || "").replace(/\D/g, "");
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

  const filtered = funcionarios.filter((f) => {
    const term = busca.toLowerCase();
    const matchNome = f.nome.toLowerCase().includes(term) || f.cpf.includes(busca.replace(/\D/g, ""));
    const uni = f.dados?.unidade || f.admissao?.unidade || "";
    const dep = f.dados?.departamento || f.admissao?.departamento || "";
    const matchUnidade = filtroUnidade === "__all__" || uni === filtroUnidade;
    const matchDep = filtroDepartamento === "__all__" || dep === filtroDepartamento;
    return matchNome && matchUnidade && matchDep;
  });

  const getFotoUrl = (f: any) => {
    const fotoUrl = f.admissao?.foto_url;
    if (!fotoUrl) return null;
    const { data } = supabase.storage.from("funcionarios-fotos").getPublicUrl(fotoUrl);
    return data?.publicUrl || null;
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      const path = `${selected.cpf}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("funcionarios-fotos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      if (selected.admissao?.id) {
        await supabase.from("admissoes").update({ foto_url: path } as any).eq("id", selected.admissao.id);
      }
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin-admissoes-func"] });
      setSelected((prev: any) => prev ? { ...prev, admissao: { ...prev.admissao, foto_url: path } } : prev);
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const d = selected?.dados || {};
  const a = selected?.admissao || {};
  const g = (key: string) => d[key] || a[key] || "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Funcionários ({filtered.length})</CardTitle>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome ou CPF..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            {unidades.length > 0 && (
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas Unidades</SelectItem>
                  {unidades.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {departamentos.length > 0 && (
              <Select value={filtroDepartamento} onValueChange={setFiltroDepartamento}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Departamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos Departamentos</SelectItem>
                  {departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => {
                    const foto = getFotoUrl(f);
                    return (
                      <TableRow key={f.cpf} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(f)}>
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
                        <TableCell>
                          <Badge variant={f.origem === "Ambos" ? "default" : "secondary"}>{f.origem}</Badge>
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Ficha Funcional</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Header com foto */}
              <div className="flex gap-5 items-start border rounded-lg p-4 bg-muted/30">
                <div className="relative group shrink-0">
                  <Avatar className="h-28 w-28">
                    {getFotoUrl(selected) && <AvatarImage src={getFotoUrl(selected)!} />}
                    <AvatarFallback className="text-2xl">{getInitials(selected.nome)}</AvatarFallback>
                  </Avatar>
                  <button
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-bold">{selected.nome}</h2>
                  <p className="text-sm text-muted-foreground">CPF: {formatCpf(selected.cpf)}</p>
                  {g("funcao") && <p className="text-sm">Função: {g("funcao")}</p>}
                  {g("unidade") && <p className="text-sm">Unidade: {g("unidade")}</p>}
                  {g("departamento") && <p className="text-sm">Departamento: {g("departamento")}</p>}
                  <Badge variant={selected.origem === "Ambos" ? "default" : "secondary"}>{selected.origem}</Badge>
                </div>
              </div>

              <FichaSection icon={User} title="Dados Pessoais">
                <FichaField label="Data de Nascimento" value={g("data_nascimento")} />
                <FichaField label="RG" value={g("rg")} />
                <FichaField label="Expedição RG" value={g("data_expedicao_rg")} />
                <FichaField label="Sexo" value={g("sexo")} />
                <FichaField label="Cor" value={g("cor")} />
                <FichaField label="Estado Civil" value={g("estado_civil")} />
                <FichaField label="Escolaridade" value={g("escolaridade")} />
                <FichaField label="Local de Nascimento" value={g("local_nascimento")} />
              </FichaSection>

              <FichaSection icon={FileText} title="Documentos">
                <FichaField label="Nº PIS" value={g("numero_pis")} />
                <FichaField label="Cadastro PIS" value={g("data_cadastro_pis")} />
                <FichaField label="Nº CTPS" value={g("numero_ctps")} />
                <FichaField label="Série CTPS" value={g("serie_ctps")} />
                <FichaField label="Emissão CTPS" value={g("emissao_ctps")} />
                <FichaField label="Título de Eleitor" value={g("titulo_eleitor")} />
              </FichaSection>

              <FichaSection icon={MapPin} title="Endereço">
                <FichaField label="Endereço" value={g("endereco")} />
                <FichaField label="Bairro" value={g("bairro")} />
                <FichaField label="CEP" value={g("cep")} />
              </FichaSection>

              <FichaSection icon={Heart} title="Família">
                <FichaField label="Nome da Mãe" value={g("nome_mae")} />
                <FichaField label="Nome do Pai" value={g("nome_pai")} />
                <FichaField label="Cônjuge" value={g("nome_conjuge")} />
                <FichaField label="CPF Cônjuge" value={g("cpf_conjuge")} />
                <FichaField label="Dependentes IR" value={g("dependentes_ir")} />
                <FichaField label="CPF Dependentes" value={g("cpf_dependentes")} />
              </FichaSection>

              <FichaSection icon={Briefcase} title="Profissional">
                <FichaField label="1º Dia de Trabalho" value={g("primeiro_dia_trabalho")} />
                <FichaField label="Horário de Trabalho" value={g("horario_trabalho")} />
                <FichaField label="Primeiro Emprego" value={g("primeiro_emprego")} />
                <FichaField label="Vale Transporte" value={g("vale_transporte")} />
                <FichaField label="Detalhes VT" value={g("detalhes_vale_transporte")} />
                <FichaField label="Dados Bancários" value={g("dados_bancarios")} />
              </FichaSection>

              <FichaSection icon={Phone} title="Contato">
                <FichaField label="Telefone" value={g("telefone")} />
                <FichaField label="E-mail" value={g("email")} />
              </FichaSection>

              <FichaSection icon={Stethoscope} title="Plano de Saúde">
                <FichaField label="Interesse" value={g("interesse_plano")} />
                <FichaField label="Plano Escolhido" value={g("plano_escolhido")} />
              </FichaSection>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
