import { useEffect, useState } from "react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react";

type Equipamento = Database["public"]["Tables"]["equipamentos_ponto"]["Row"];

function normalizeHost(host: string): string {
  return host.replace(/\s/g, "").replace(/\/+$/, "");
}

function buildBaseUrl(host: string, porta: number | null): string {
  const h = normalizeHost(host);
  if (/^https?:\/\//i.test(h)) return h;
  const p = porta || 443;
  const scheme = p === 80 ? "http" : "https";
  return `${scheme}://${h}:${p}`;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipamento?: Equipamento | null;
  onSaved: () => void;
};

export function EquipamentoPontoDialog({ open, onOpenChange, equipamento, onSaved }: Props) {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [host, setHost] = useState("");
  const [porta, setPorta] = useState("443");
  const [usuario, setUsuario] = useState("admin");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNome(equipamento?.nome || "");
    setNumeroSerie(equipamento?.numero_serie || "");
    setHost(equipamento?.host || "");
    setPorta(String(equipamento?.porta ?? 443));
    setUsuario(equipamento?.usuario || "admin");
    setSenha("");
    setMostrarSenha(false);
    setAtivo(equipamento?.ativo ?? true);
  }, [open, equipamento]);

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do equipamento", variant: "destructive" });
      return;
    }
    if (!host.trim()) {
      toast({ title: "Informe o Host / URL", variant: "destructive" });
      return;
    }
    const portaNum = porta ? Number(porta) : null;
    if (portaNum !== null && (Number.isNaN(portaNum) || portaNum < 1 || portaNum > 65535)) {
      toast({ title: "Porta inválida", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("salvar_equipamento_ponto", {
        p_id: equipamento?.id ?? null,
        p_nome: nome.trim(),
        p_modelo: null,
        p_numero_serie: numeroSerie.trim() || null,
        p_descricao: null,
        p_ativo: ativo,
        p_tipo_conexao: "rep_local",
        p_host: normalizeHost(host.trim()) || null,
        p_porta: portaNum,
        p_usuario: usuario.trim() || null,
        p_senha: senha || null,
      });
      if (error) throw error;
      const savedId = (data as unknown as string) || equipamento?.id;
      if (!savedId) throw new Error("Falha ao salvar equipamento");
      toast({ title: equipamento?.id ? "Equipamento atualizado" : "Equipamento cadastrado" });
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      toast({
        title: "Erro ao salvar",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestar = async () => {
    if (!host.trim()) {
      toast({ title: "Informe Host / URL antes de testar", variant: "destructive" });
      return;
    }
    setTestando(true);
    try {
      let senhaUsar = senha || "";
      if (!senhaUsar && equipamento?.id) {
        const { data, error } = await supabase.rpc("obter_senha_equipamento", { p_id: equipamento.id });
        if (error) throw error;
        senhaUsar = String(data || "");
      }
      if (!senhaUsar) throw new Error("Informe a senha (ou salve o equipamento com senha antes de testar).");

      const portaNum = porta ? Number(porta) : null;
      const baseUrl = buildBaseUrl(host.trim(), portaNum);
      const start = Date.now();
      const loginUrl = `${baseUrl}/login.fcgi`;
      let res: Response;
      try {
        res = await fetch("/controlid-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: loginUrl,
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: { login: usuario.trim() || "admin", password: senhaUsar },
          }),
        });
      } catch {
        res = await fetch(loginUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ login: usuario.trim() || "admin", password: senhaUsar }),
          credentials: "include",
        });
      }
      if (!res.ok) throw new Error(`Login falhou: HTTP ${res.status}`);
      toast({ title: "Conexão OK", description: `${Date.now() - start}ms` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Falha na conexão", description: msg, variant: "destructive" });
    } finally {
      setTestando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{equipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: REP Recepção" />
            </div>
            <div className="space-y-2">
              <Label>Número de Série</Label>
              <Input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="00014003750021988" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Host / URL *</Label>
              <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.244 ou https://192.168.0.244" />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input type="number" value={porta} onChange={(e) => setPorta(e.target.value)} placeholder="443" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder={equipamento?.id ? "Deixe em branco para manter" : "••••••"}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label>Equipamento ativo</Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTestar} disabled={testando || saving}>
            {testando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PlugZap className="h-4 w-4 mr-1" />}
            Testar Conexão
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || testando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving || testando}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
