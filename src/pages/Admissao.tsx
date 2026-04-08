import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

const UNIDADES = ["Bairro Santo Agostinho", "Bairro Funcionários", "Bairro Savassi", "Outra"];
const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"];
const ESCOLARIDADES = [
  "Ensino Fundamental Incompleto", "Ensino Fundamental Completo",
  "Ensino Médio Incompleto", "Ensino Médio Completo",
  "Ensino Superior Incompleto", "Ensino Superior Completo",
  "Pós-Graduação", "Mestrado", "Doutorado"
];
const SEXOS = ["Masculino", "Feminino"];
const CORES = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];
const PLANOS = [
  "Não tenho interesse",
  "Enfermaria",
  "Apartamento",
];

export default function Admissao() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    unidade: "",
    nome_completo: "",
    data_nascimento: "",
    cpf: "",
    rg: "",
    data_expedicao_rg: "",
    titulo_eleitor: "",
    numero_pis: "",
    data_cadastro_pis: "",
    numero_ctps: "",
    serie_ctps: "",
    emissao_ctps: "",
    estado_civil: "",
    escolaridade: "",
    endereco: "",
    bairro: "",
    cep: "",
    nome_mae: "",
    nome_pai: "",
    local_nascimento: "",
    sexo: "",
    cor: "",
    primeiro_emprego: false,
    vale_transporte: false,
    horario_trabalho: "",
    detalhes_vale_transporte: "",
    telefone: "",
    dados_bancarios: "",
    email: "",
    funcao: "",
    primeiro_dia_trabalho: "",
    nome_conjuge: "",
    cpf_conjuge: "",
    dependentes_ir: "",
    cpf_dependentes: "",
    interesse_plano: "",
    plano_escolhido: "",
    observacoes: "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setSelect = (field: string) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const formatCpf = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  };

  const formatCep = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 5) return n;
    return `${n.slice(0,5)}-${n.slice(5)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.cpf) {
      toast({ title: "Preencha ao menos Nome e CPF", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("admissoes").insert({
        ...form,
        cpf: form.cpf.replace(/\D/g, ""),
      });
      if (error) throw error;
      setEnviado(true);
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">Formulário Enviado!</h2>
            <p className="text-muted-foreground">Seus dados de admissão foram recebidos com sucesso. Obrigado!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Formulário de Admissão</CardTitle>
            <CardDescription>Preencha todos os campos abaixo com seus dados para o processo de admissão.</CardDescription>
          </CardHeader>
        </Card>

        {/* Dados Pessoais */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Unidade *</Label>
              <Select value={form.unidade} onValueChange={setSelect("unidade")}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Nome Completo *</Label>
              <Input value={form.nome_completo} onChange={set("nome_completo")} required />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.data_nascimento} onChange={set("data_nascimento")} />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={formatCpf(form.cpf)} onChange={(e) => setForm(p => ({ ...p, cpf: e.target.value.replace(/\D/g, "") }))} placeholder="000.000.000-00" required />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={form.rg} onChange={set("rg")} />
            </div>
            <div className="space-y-2">
              <Label>Data Expedição RG</Label>
              <Input type="date" value={form.data_expedicao_rg} onChange={set("data_expedicao_rg")} />
            </div>
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={form.sexo} onValueChange={setSelect("sexo")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {SEXOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor/Raça</Label>
              <Select value={form.cor} onValueChange={setSelect("cor")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CORES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado Civil</Label>
              <Select value={form.estado_civil} onValueChange={setSelect("estado_civil")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grau de Escolaridade</Label>
              <Select value={form.escolaridade} onValueChange={setSelect("escolaridade")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ESCOLARIDADES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Local de Nascimento (Cidade)</Label>
              <Input value={form.local_nascimento} onChange={set("local_nascimento")} />
            </div>
            <div className="space-y-2">
              <Label>Nome da Mãe</Label>
              <Input value={form.nome_mae} onChange={set("nome_mae")} />
            </div>
            <div className="space-y-2">
              <Label>Nome do Pai</Label>
              <Input value={form.nome_pai} onChange={set("nome_pai")} />
            </div>
          </CardContent>
        </Card>

        {/* Documentos */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Documentos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título de Eleitor</Label>
              <Input value={form.titulo_eleitor} onChange={set("titulo_eleitor")} />
            </div>
            <div className="space-y-2">
              <Label>Número do PIS</Label>
              <Input value={form.numero_pis} onChange={set("numero_pis")} placeholder="Somente números" />
            </div>
            <div className="space-y-2">
              <Label>Data Cadastro PIS</Label>
              <Input type="date" value={form.data_cadastro_pis} onChange={set("data_cadastro_pis")} />
            </div>
            <div className="space-y-2">
              <Label>Nº Carteira de Trabalho</Label>
              <Input value={form.numero_ctps} onChange={set("numero_ctps")} />
            </div>
            <div className="space-y-2">
              <Label>Série da Carteira de Trabalho</Label>
              <Input value={form.serie_ctps} onChange={set("serie_ctps")} />
            </div>
            <div className="space-y-2">
              <Label>Emissão da Carteira de Trabalho</Label>
              <Input type="date" value={form.emissao_ctps} onChange={set("emissao_ctps")} />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Endereço</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Endereço Completo (rua, número)</Label>
              <Input value={form.endereco} onChange={set("endereco")} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={set("bairro")} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={formatCep(form.cep)} onChange={(e) => setForm(p => ({ ...p, cep: e.target.value.replace(/\D/g, "") }))} placeholder="00000-000" />
            </div>
          </CardContent>
        </Card>

        {/* Dados Profissionais */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Dados Profissionais</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Função que exercerá</Label>
              <Input value={form.funcao} onChange={set("funcao")} />
            </div>
            <div className="space-y-2">
              <Label>Primeiro dia de trabalho</Label>
              <Input type="date" value={form.primeiro_dia_trabalho} onChange={set("primeiro_dia_trabalho")} />
            </div>
            <div className="space-y-2">
              <Label>Horário de Trabalho</Label>
              <Input value={form.horario_trabalho} onChange={set("horario_trabalho")} placeholder="Ex: 08:00 às 17:00" />
            </div>
            <div className="space-y-2">
              <Label>Primeiro Emprego?</Label>
              <Select value={form.primeiro_emprego ? "sim" : "nao"} onValueChange={(v) => setForm(p => ({ ...p, primeiro_emprego: v === "sim" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Vale-Transporte */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Vale-Transporte</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Irá precisar de vale-transporte?</Label>
              <Select value={form.vale_transporte ? "sim" : "nao"} onValueChange={(v) => setForm(p => ({ ...p, vale_transporte: v === "sim" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.vale_transporte && (
              <div className="space-y-2">
                <Label>Especificar ônibus e valores por dia</Label>
                <Textarea value={form.detalhes_vale_transporte} onChange={set("detalhes_vale_transporte")} placeholder="Ex: Linha 1404, R$ 9,00 por dia" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contato e Dados Bancários */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Contato e Dados Bancários</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={set("telefone")} placeholder="(31) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>E-mail pessoal</Label>
              <Input type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Conta Banco Itaú (Agência e Conta) ou PIX</Label>
              <Textarea value={form.dados_bancarios} onChange={set("dados_bancarios")} placeholder="Agência, Conta e Operação ou chave PIX" />
            </div>
          </CardContent>
        </Card>

        {/* Cônjuge e Dependentes */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Cônjuge e Dependentes</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo do Cônjuge</Label>
              <Input value={form.nome_conjuge} onChange={set("nome_conjuge")} />
            </div>
            <div className="space-y-2">
              <Label>CPF do Cônjuge</Label>
              <Input value={form.cpf_conjuge} onChange={set("cpf_conjuge")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Filhos ou cônjuge são dependentes na declaração de IR? Se sim, detalhar.</Label>
              <Textarea value={form.dependentes_ir} onChange={set("dependentes_ir")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>CPF dos dependentes (maiores de 14 anos)</Label>
              <Textarea value={form.cpf_dependentes} onChange={set("cpf_dependentes")} />
            </div>
          </CardContent>
        </Card>

        {/* Plano de Saúde */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Plano de Saúde</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tem interesse em contratar o plano?</Label>
              <Select value={form.interesse_plano} onValueChange={setSelect("interesse_plano")}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não tenho interesse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.interesse_plano === "Sim" && (
              <div className="space-y-2">
                <Label>Plano escolhido (mesmo para dependentes)</Label>
                <Select value={form.plano_escolhido} onValueChange={setSelect("plano_escolhido")}>
                  <SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger>
                  <SelectContent>
                    {PLANOS.filter(p => p !== "Não tenho interesse").map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={set("observacoes")} placeholder="Informações adicionais..." />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
          {loading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando...</> : "Enviar Formulário"}
        </Button>
      </form>
    </div>
  );
}
