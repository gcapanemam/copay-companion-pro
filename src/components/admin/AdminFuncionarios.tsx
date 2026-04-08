import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AdminFuncionarios() {
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

  // Merge: titulares do plano + admissões, sem duplicar por CPF
  const funcionarios = (() => {
    const map = new Map<string, any>();

    (titulares || []).forEach((t) => {
      const cpf = t.cpf?.replace(/\D/g, "") || "";
      if (cpf) {
        map.set(cpf, { nome: t.nome, cpf, origem: "Plano de Saúde", dados: {} });
      }
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

  const filtered = funcionarios.filter((f) => {
    const term = busca.toLowerCase();
    return f.nome.toLowerCase().includes(term) || f.cpf.includes(busca.replace(/\D/g, ""));
  });

  const LABELS: Record<string, string> = {
    unidade: "Unidade",
    data_nascimento: "Data de Nascimento",
    rg: "RG",
    data_expedicao_rg: "Expedição RG",
    titulo_eleitor: "Título de Eleitor",
    numero_pis: "Nº PIS",
    data_cadastro_pis: "Cadastro PIS",
    numero_ctps: "Nº CTPS",
    serie_ctps: "Série CTPS",
    emissao_ctps: "Emissão CTPS",
    estado_civil: "Estado Civil",
    escolaridade: "Escolaridade",
    endereco: "Endereço",
    bairro: "Bairro",
    cep: "CEP",
    nome_mae: "Nome da Mãe",
    nome_pai: "Nome do Pai",
    local_nascimento: "Local de Nascimento",
    sexo: "Sexo",
    cor: "Cor",
    primeiro_emprego: "Primeiro Emprego",
    vale_transporte: "Vale Transporte",
    detalhes_vale_transporte: "Detalhes VT",
    horario_trabalho: "Horário de Trabalho",
    telefone: "Telefone",
    email: "E-mail",
    dados_bancarios: "Dados Bancários",
    funcao: "Função",
    primeiro_dia_trabalho: "1º Dia de Trabalho",
    interesse_plano: "Interesse Plano",
    plano_escolhido: "Plano Escolhido",
    nome_conjuge: "Cônjuge",
    cpf_conjuge: "CPF Cônjuge",
    cpf_dependentes: "CPF Dependentes IR",
    dependentes_ir: "Dependentes IR",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Funcionários ({filtered.length})</CardTitle>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
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
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow
                      key={f.cpf}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelected(f)}
                    >
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{formatCpf(f.cpf)}</TableCell>
                      <TableCell>{f.dados?.funcao || f.admissao?.funcao || "-"}</TableCell>
                      <TableCell>{f.dados?.unidade || f.admissao?.unidade || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={f.origem === "Ambos" ? "default" : "secondary"}>{f.origem}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="font-semibold">CPF:</span> {formatCpf(selected.cpf)}</div>
                <div><span className="font-semibold">Origem:</span> {selected.origem}</div>
              </div>
              {Object.keys(selected.dados || {}).length > 0 && (
                <div className="border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground mb-2">Dados Cadastrais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {Object.entries(selected.dados).map(([key, val]) => {
                      if (key === "nome_completo" || key === "cpf" || !val) return null;
                      const label = LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
                      const display = typeof val === "boolean" ? (val ? "Sim" : "Não") : String(val);
                      return (
                        <div key={key}>
                          <span className="font-semibold">{label}:</span> {display}
                        </div>
                      );
                    })}
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
