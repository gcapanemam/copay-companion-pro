import { useState, useEffect } from "react";
import { Key, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Beneficiario {
  nome: string;
  cpf: string;
  tipo: string;
  temSenha: boolean;
}

export const GerenciarSenhas = () => {
  const [open, setOpen] = useState(false);
  const [beneficiarios, setBeneficiarios] = useState<Beneficiario[]>([]);
  const [loading, setLoading] = useState(false);
  const [senhas, setSenhas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [settingAll, setSettingAll] = useState(false);
  const { toast } = useToast();

  const formatCpf = (cpf: string) => {
    if (!cpf || cpf.length !== 11) return cpf;
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  };

  const loadBeneficiarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "list-beneficiarios" },
      });
      if (error) throw error;
      setBeneficiarios(data.beneficiarios || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) loadBeneficiarios();
  }, [open]);

  const handleSetSenha = async (cpf: string) => {
    const novaSenha = senhas[cpf];
    if (!novaSenha || novaSenha.length < 4) {
      toast({ title: "Erro", description: "Senha deve ter pelo menos 4 caracteres", variant: "destructive" });
      return;
    }

    setSaving(cpf);
    try {
      const { data, error } = await supabase.functions.invoke("login-beneficiario", {
        body: { action: "set-senha", cpf, senha: novaSenha },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: "Senha definida", description: "Senha cadastrada com sucesso!" });
      setSenhas((prev) => ({ ...prev, [cpf]: "" }));
      setBeneficiarios((prev) =>
        prev.map((b) => (b.cpf === cpf ? { ...b, temSenha: true } : b))
      );
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Key className="h-4 w-4 mr-1" />
          Senhas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Senhas dos Beneficiários</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : beneficiarios.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Nenhum beneficiário com CPF cadastrado. Os CPFs são extraídos dos PDFs.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beneficiarios.map((b) => (
                <TableRow key={b.cpf}>
                  <TableCell className="text-xs">{b.nome}</TableCell>
                  <TableCell className="text-xs font-mono">{formatCpf(b.cpf)}</TableCell>
                  <TableCell className="text-xs">{b.tipo}</TableCell>
                  <TableCell>
                    <Input
                      type="password"
                      placeholder={b.temSenha ? "•••• (redefinir)" : "Nova senha"}
                      value={senhas[b.cpf] || ""}
                      onChange={(e) => setSenhas((prev) => ({ ...prev, [b.cpf]: e.target.value }))}
                      className="h-8 text-xs w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetSenha(b.cpf)}
                      disabled={saving === b.cpf || !senhas[b.cpf]}
                    >
                      {saving === b.cpf ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
