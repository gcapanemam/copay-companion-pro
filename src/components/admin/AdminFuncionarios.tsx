import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Users, Eye } from "lucide-react";
import { FichaFuncionalDialog } from "./FichaFuncionalDialog";

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function AdminFuncionarios() {
  const [filtroUnidade, setFiltroUnidade] = useState("__all__");
  const [filtroDepartamento, setFiltroDepartamento] = useState("__all__");
  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState<any>(null);

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
          {(loadingAdmissoes || loadingTitulares) ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : !filtered.length ? (
            <p className="text-muted-foreground text-center py-4">Nenhum funcionário encontrado.</p>
          ) : (
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                     <TableHead className="w-12"></TableHead>
                     <TableHead>Nome</TableHead>
                     <TableHead>CPF</TableHead>
                     <TableHead>Função</TableHead>
                     <TableHead>Unidade</TableHead>
                     <TableHead>Departamento</TableHead>
                     <TableHead>Origem</TableHead>
                     <TableHead className="w-12"></TableHead>
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
          )}
        </CardContent>
      </Card>

      <FichaFuncionalDialog
        funcionario={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
