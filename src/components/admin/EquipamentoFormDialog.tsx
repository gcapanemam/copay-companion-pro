import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipamento?: any;
  onSaved: () => void;
}

const MODELOS = [
  "REP iDClass (REP-C)",
  "REP iDFace",
  "REP iDFit",
  "iDAccess",
  "iDBlock",
  "Outro",
];

export function EquipamentoFormDialog({ open, onOpenChange, equipamento, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState("REP iDClass (REP-C)");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);

  const [tipoConexao, setTipoConexao] = useState<"idcloud_mysql" | "rep_local">("idcloud_mysql");
  const [host, setHost] = useState("");
  const [porta, setPorta] = useState<string>("443");
  const [usuario, setUsuario] = useState("admin");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(equipamento?.nome || "");
      setModelo(equipamento?.modelo || "REP iDClass (REP-C)");
      setNumeroSerie(equipamento?.numero_serie || "");
      setDescricao(equipamento?.descricao || "");
      setAtivo(equipamento?.ativo ?? true);
      setTipoConexao((equipamento?.tipo_conexao as any) || "idcloud_mysql");
      setHost(equipamento?.host || "");
      setPorta(String(equipamento?.porta ?? (equipamento?.tipo_conexao === "rep_local" ? 443 : 3306)));
      setUsuario(equipamento?.usuario || "admin");
      setSenha("");
      setMostrarSenha(false);
    }
  }, [open, equipamento]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const portaNum = porta ? Number(porta) : null;
    if (portaNum !== null && (isNaN(portaNum) || portaNum < 1 || portaNum > 65535)) {
      toast.error("Porta inválida");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("salvar_equipamento_ponto", {
        p_id: equipamento?.id ?? null,
        p_nome: nome.trim(),
        p_modelo: modelo || null,
        p_numero_serie: numeroSerie.trim() || null,
        p_descricao: descricao.trim() || null,
        p_ativo: ativo,
        p_tipo_conexao: tipoConexao,
        p_host: host.trim() || null,
        p_porta: portaNum,
        p_usuario: usuario.trim() || null,
        p_senha: senha || null,
      });
      if (error) throw error;
      toast.success(equipamento?.id ? "Equipamento atualizado" : "Equipamento cadastrado");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{equipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="geral">Informações Gerais</TabsTrigger>
            <TabsTrigger value="conexao">Conexão</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: REP Recepção" />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={modelo} onValueChange={setModelo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Número de Série</Label>
              <Input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="00014003750021988" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Localização ou observações" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ativo} onCheckedChange={setAtivo} />
              <Label>Equipamento ativo</Label>
            </div>

            {equipamento && (
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                {equipamento.versao_firmware && <div>Versão firmware: {equipamento.versao_firmware}</div>}
                {equipamento.ultima_sincronizacao && (
                  <div>Última sincronização: {new Date(equipamento.ultima_sincronizacao).toLocaleString("pt-BR")}</div>
                )}
                <div>Último NSR: {equipamento.ultimo_nsr ?? 0}</div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="conexao" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Tipo de Conexão</Label>
              <Select value={tipoConexao} onValueChange={(v: any) => {
                setTipoConexao(v);
                setPorta(v === "rep_local" ? "443" : "3306");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="idcloud_mysql">iDCloud (MySQL)</SelectItem>
                  <SelectItem value="rep_local">REP Local (REST API)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {tipoConexao === "idcloud_mysql"
                  ? "Conecta ao banco MySQL exposto pelo iDCloud."
                  : "Conecta diretamente ao relógio via HTTPS na rede local/VPN."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Host / IP</Label>
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.0.23" />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input type="number" value={porta} onChange={(e) => setPorta(e.target.value)} placeholder="443" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Usuário para comunicação</Label>
                <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="admin" />
              </div>
              <div className="space-y-2">
                <Label>Senha para comunicação</Label>
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

            <p className="text-xs text-muted-foreground">
              A senha é armazenada criptografada e só é descriptografada no servidor durante a sincronização.
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
