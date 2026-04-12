import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

export const AdminConfiguracoes = () => {
  const [doisFatoresAtivo, setDoisFatoresAtivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await supabase
        .from("configuracoes")
        .select("valor")
        .eq("chave", "dois_fatores_ativo")
        .maybeSingle();
      setDoisFatoresAtivo(data?.valor === "true");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor: checked ? "true" : "false" })
        .eq("chave", "dois_fatores_ativo");
      if (error) throw error;
      setDoisFatoresAtivo(checked);
      toast({
        title: checked ? "2FA Ativado" : "2FA Desativado",
        description: checked
          ? "Funcionários precisarão informar o código enviado por e-mail ao fazer login."
          : "Login dos funcionários voltou ao modo padrão (CPF + senha).",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label className="text-base font-medium">
                Autenticação em Dois Fatores (2FA)
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando ativado, os funcionários receberão um código por e-mail ao fazer login no portal.
                O código expira em 5 minutos.
              </p>
              <p className="text-xs text-muted-foreground">
                ⚠️ É necessário que os funcionários tenham e-mail cadastrado na ficha de admissão.
              </p>
            </div>
            <Switch
              checked={doisFatoresAtivo}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
