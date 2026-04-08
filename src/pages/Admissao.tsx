import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Campo {
  id: string;
  campo_nome: string;
  label: string;
  tipo: string;
  opcoes: string[];
  obrigatorio: boolean;
  ativo: boolean;
  ordem: number;
  grupo: string;
  placeholder: string | null;
}

export default function Admissao() {
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data: campos, isLoading: loadingCampos } = useQuery({
    queryKey: ["admissao-campos-form"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissao_campos").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data as Campo[];
    },
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

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
    const required = campos?.filter((c) => c.obrigatorio) || [];
    const missing = required.find((c) => !form[c.campo_nome]?.trim());
    if (missing) {
      toast({ title: `Preencha o campo: ${missing.label}`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("admissoes").insert({
        nome_completo: form.nome_completo || "",
        cpf: (form.cpf || "").replace(/\D/g, ""),
        dados: form,
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

  if (loadingCampos) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const grupos = campos ? [...new Set(campos.map((c) => c.grupo))] : [];

  const renderCampo = (campo: Campo) => {
    const value = form[campo.campo_nome] || "";

    switch (campo.tipo) {
      case "select":
        return (
          <Select value={value} onValueChange={(v) => set(campo.campo_nome, v)}>
            <SelectTrigger><SelectValue placeholder={campo.placeholder || "Selecione"} /></SelectTrigger>
            <SelectContent>
              {campo.opcoes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case "textarea":
        return <Textarea value={value} onChange={(e) => set(campo.campo_nome, e.target.value)} placeholder={campo.placeholder || ""} />;
      case "boolean":
        return (
          <Select value={value || "nao"} onValueChange={(v) => set(campo.campo_nome, v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        );
      case "cpf":
        return (
          <Input
            value={formatCpf(value)}
            onChange={(e) => set(campo.campo_nome, e.target.value.replace(/\D/g, ""))}
            placeholder={campo.placeholder || "000.000.000-00"}
            required={campo.obrigatorio}
          />
        );
      case "cep":
        return (
          <Input
            value={formatCep(value)}
            onChange={(e) => set(campo.campo_nome, e.target.value.replace(/\D/g, ""))}
            placeholder={campo.placeholder || "00000-000"}
          />
        );
      case "date":
        return <Input type="date" value={value} onChange={(e) => set(campo.campo_nome, e.target.value)} />;
      case "email":
        return <Input type="email" value={value} onChange={(e) => set(campo.campo_nome, e.target.value)} placeholder={campo.placeholder || ""} />;
      default:
        return (
          <Input
            value={value}
            onChange={(e) => set(campo.campo_nome, e.target.value)}
            placeholder={campo.placeholder || ""}
            required={campo.obrigatorio}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Formulário de Admissão</CardTitle>
            <CardDescription>Preencha todos os campos abaixo com seus dados para o processo de admissão.</CardDescription>
          </CardHeader>
        </Card>

        {grupos.map((grupo) => {
          const camposGrupo = campos!.filter((c) => c.grupo === grupo);
          return (
            <Card key={grupo}>
              <CardHeader><CardTitle className="text-lg">{grupo}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {camposGrupo.map((campo) => (
                  <div
                    key={campo.id}
                    className={`space-y-2 ${campo.tipo === "textarea" || campo.campo_nome === "endereco" || campo.campo_nome === "nome_completo" ? "md:col-span-2" : ""}`}
                  >
                    <Label>{campo.label}{campo.obrigatorio ? " *" : ""}</Label>
                    {renderCampo(campo)}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
          {loading ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando...</> : "Enviar Formulário"}
        </Button>
      </form>
    </div>
  );
}
