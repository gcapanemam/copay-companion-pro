import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Camera, Loader2, Pencil, Save, X, User, FileText, MapPin, Heart, Briefcase, Phone, Stethoscope, Download, CloudDownload, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function normalizeCpf(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits || digits.length > 11) return "";
  return digits.padStart(11, "0");
}

function formatCpfDisplay(v: string) {
  const n = normalizeCpf(v);
  if (!n) return "";
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

// Fixed fields that map directly to admissoes table columns
const FIXED_FIELDS = [
  { grupo: "Dados Pessoais", icon: User, fields: [
    { key: "nome_completo", label: "Nome Completo", tipo: "text" },
    { key: "data_nascimento", label: "Data de Nascimento", tipo: "text" },
    { key: "cpf", label: "CPF", tipo: "cpf" },
    { key: "rg", label: "RG", tipo: "text" },
    { key: "data_expedicao_rg", label: "Expedição RG", tipo: "text" },
    { key: "sexo", label: "Sexo", tipo: "text" },
    { key: "cor", label: "Cor", tipo: "text" },
    { key: "estado_civil", label: "Estado Civil", tipo: "text" },
    { key: "escolaridade", label: "Escolaridade", tipo: "text" },
    { key: "local_nascimento", label: "Local de Nascimento", tipo: "text" },
  ]},
  { grupo: "Documentos", icon: FileText, fields: [
    { key: "numero_pis", label: "Nº PIS", tipo: "text" },
    { key: "data_cadastro_pis", label: "Cadastro PIS", tipo: "text" },
    { key: "numero_ctps", label: "Nº CTPS", tipo: "text" },
    { key: "serie_ctps", label: "Série CTPS", tipo: "text" },
    { key: "emissao_ctps", label: "Emissão CTPS", tipo: "text" },
    { key: "titulo_eleitor", label: "Título de Eleitor", tipo: "text" },
  ]},
  { grupo: "Endereço", icon: MapPin, fields: [
    { key: "endereco", label: "Endereço", tipo: "text" },
    { key: "bairro", label: "Bairro", tipo: "text" },
    { key: "cep", label: "CEP", tipo: "text" },
  ]},
  { grupo: "Família", icon: Heart, fields: [
    { key: "nome_mae", label: "Nome da Mãe", tipo: "text" },
    { key: "nome_pai", label: "Nome do Pai", tipo: "text" },
    { key: "nome_conjuge", label: "Cônjuge", tipo: "text" },
    { key: "cpf_conjuge", label: "CPF Cônjuge", tipo: "text" },
    { key: "dependentes_ir", label: "Dependentes IR", tipo: "text" },
    { key: "cpf_dependentes", label: "CPF Dependentes", tipo: "text" },
  ]},
  { grupo: "Profissional", icon: Briefcase, fields: [
    { key: "unidade", label: "Unidade", tipo: "text" },
    { key: "departamento", label: "Departamento", tipo: "text" },
    { key: "funcao", label: "Função", tipo: "text" },
    { key: "primeiro_dia_trabalho", label: "1º Dia de Trabalho", tipo: "text" },
    { key: "horario_trabalho", label: "Horário de Trabalho", tipo: "text" },
    { key: "data_demissao", label: "Data de Demissão", tipo: "date" },
    { key: "primeiro_emprego", label: "Primeiro Emprego", tipo: "boolean" },
    { key: "vale_transporte", label: "Vale Transporte", tipo: "boolean" },
    { key: "detalhes_vale_transporte", label: "Detalhes VT", tipo: "text" },
    { key: "dados_bancarios", label: "Dados Bancários", tipo: "text" },
  ]},
  { grupo: "Contato", icon: Phone, fields: [
    { key: "telefone", label: "Telefone", tipo: "text" },
    { key: "email", label: "E-mail", tipo: "text" },
  ]},
  { grupo: "Plano de Saúde", icon: Stethoscope, fields: [
    { key: "interesse_plano", label: "Interesse", tipo: "text" },
    { key: "plano_escolhido", label: "Plano Escolhido", tipo: "text" },
  ]},
];

// All fixed field keys for filtering dynamic ones
const FIXED_KEYS = new Set(FIXED_FIELDS.flatMap(g => g.fields.map(f => f.key)));

interface FichaFuncionalDialogProps {
  funcionario: any;
  open: boolean;
  onClose: () => void;
}

export function FichaFuncionalDialog({ funcionario, open, onClose }: FichaFuncionalDialogProps) {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importingDrive, setImportingDrive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch dynamic campos
  const { data: campos } = useQuery({
    queryKey: ["admissao-campos-edit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissao_campos").select("*").eq("ativo", true).order("ordem");
      if (error) throw error;
      return data;
    },
  });

  // Fetch documents for this employee
  const { data: documentos, refetch: refetchDocs } = useQuery({
    queryKey: ["funcionario-documentos", funcionario?.cpf],
    queryFn: async () => {
      if (!funcionario?.cpf) return [];
      const { data, error } = await supabase
        .from("funcionario_documentos")
        .select("*")
        .eq("cpf", funcionario.cpf)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!funcionario?.cpf,
  });

  // Initialize form data when opening or switching employee
  useEffect(() => {
    if (funcionario) {
      const d = funcionario.dados || {};
      const a = funcionario.admissao || {};
      const merged: Record<string, any> = {};

      // Merge fixed fields
      FIXED_FIELDS.forEach(group => {
        group.fields.forEach(f => {
          if (f.key === "cpf") {
            merged[f.key] = normalizeCpf(a[f.key]) || normalizeCpf(d[f.key]) || "";
            return;
          }

          merged[f.key] = a[f.key] ?? d[f.key] ?? "";
        });
      });

      // Merge dynamic fields from dados
      if (d && typeof d === "object") {
        Object.keys(d).forEach(key => {
          if (!(key in merged)) {
            merged[key] = d[key] ?? "";
          }
        });
      }

      setFormData(merged);
      setEditing(false);
    }
  }, [funcionario]);

  const set = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  const getFotoUrl = () => {
    const fotoUrl = funcionario?.admissao?.foto_url;
    if (!fotoUrl) return null;
    const { data } = supabase.storage.from("funcionarios-fotos").getPublicUrl(fotoUrl);
    return data?.publicUrl || null;
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !funcionario) return;
    setUploading(true);
    try {
      const path = `${funcionario.cpf}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage.from("funcionarios-fotos").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      if (funcionario.admissao?.id) {
        await supabase.from("admissoes").update({ foto_url: path } as any).eq("id", funcionario.admissao.id);
      }
      toast.success("Foto atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin-admissoes-func"] });
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!funcionario?.admissao?.id) {
      toast.error("Não é possível editar este funcionário (sem registro de admissão).");
      return;
    }
    setSaving(true);
    try {
      // Separate fixed columns from dados json
      const fixedUpdate: Record<string, any> = {};
      const dadosUpdate: Record<string, any> = {};

      Object.entries(formData).forEach(([key, value]) => {
        const normalizedCpf = key === "cpf" ? normalizeCpf(value) : value;

        if (FIXED_KEYS.has(key)) {
          // Boolean fields
          if (key === "primeiro_emprego" || key === "vale_transporte") {
            fixedUpdate[key] = value === true || value === "true" || value === "sim";
          } else if (key === "cpf") {
            fixedUpdate[key] = normalizedCpf || null;
          } else {
            fixedUpdate[key] = value || null;
          }
        }
        // All fields go into dados too for compatibility
        dadosUpdate[key] = normalizedCpf;
      });

      fixedUpdate.dados = dadosUpdate;

      const { error } = await supabase
        .from("admissoes")
        .update(fixedUpdate as any)
        .eq("id", funcionario.admissao.id);

      if (error) throw error;
      toast.success("Dados salvos com sucesso!");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin-admissoes-func"] });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Get dynamic campos that aren't already in fixed fields
  const dynamicCampos = (campos || []).filter(c => !FIXED_KEYS.has(c.campo_nome));

  // Group dynamic campos
  const dynamicGroups = dynamicCampos.reduce((acc, c) => {
    if (!acc[c.grupo]) acc[c.grupo] = [];
    acc[c.grupo].push(c);
    return acc;
  }, {} as Record<string, typeof dynamicCampos>);

  // Also check for extra keys in dados that aren't in fixed or dynamic campos
  const dynamicCampoKeys = new Set(dynamicCampos.map(c => c.campo_nome));
  const extraKeys = Object.keys(formData).filter(k => !FIXED_KEYS.has(k) && !dynamicCampoKeys.has(k) && formData[k]);

  const renderField = (key: string, label: string, tipo: string, opcoes?: string[]) => {
    const value = formData[key];
    if (!editing) {
      // View mode
      const display = value === true ? "Sim" : value === false ? "Não" : (value || "");
      if (!display) return null;
      return (
        <div key={key} className="py-0.5">
          <span className="font-medium text-muted-foreground">{label}:</span>{" "}
          <span>{String(display)}</span>
        </div>
      );
    }

    // Edit mode
    if (tipo === "boolean") {
      const boolVal = value === true || value === "true" || value === "sim";
      return (
        <div key={key} className="flex items-center gap-2 py-1">
          <Label className="text-sm text-muted-foreground w-32">{label}</Label>
          <Switch checked={boolVal} onCheckedChange={(v) => set(key, v)} />
          <span className="text-sm">{boolVal ? "Sim" : "Não"}</span>
        </div>
      );
    }

    if (tipo === "select" && opcoes?.length) {
      return (
        <div key={key} className="space-y-1 py-1">
          <Label className="text-sm text-muted-foreground">{label}</Label>
          <Select value={value || ""} onValueChange={(v) => set(key, v)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {opcoes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (tipo === "textarea") {
      return (
        <div key={key} className="space-y-1 py-1 md:col-span-2">
          <Label className="text-sm text-muted-foreground">{label}</Label>
          <Textarea value={value || ""} onChange={(e) => set(key, e.target.value)} className="min-h-[60px]" />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1 py-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <Input
          value={tipo === "cpf" ? formatCpfDisplay(value || "") : (value || "")}
          onChange={(e) => set(key, tipo === "cpf" ? e.target.value.replace(/\D/g, "") : e.target.value)}
          className="h-8"
          type={tipo === "date" ? "date" : tipo === "email" ? "email" : "text"}
        />
      </div>
    );
  };

  if (!funcionario) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Ficha Funcional</DialogTitle>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                    <X className="h-4 w-4 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Salvar
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header com foto */}
          <div className="flex gap-5 items-start border rounded-lg p-4 bg-muted/30">
            <div className="relative group shrink-0">
              <Avatar className="h-28 w-28">
                {getFotoUrl() && <AvatarImage src={getFotoUrl()!} />}
                <AvatarFallback className="text-2xl">{getInitials(funcionario.nome)}</AvatarFallback>
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
              <h2 className="text-xl font-bold">{formData.nome_completo || funcionario.nome}</h2>
              <p className="text-sm text-muted-foreground">CPF: {formatCpfDisplay(funcionario.cpf)}</p>
              {(formData.funcao) && <p className="text-sm">Função: {formData.funcao}</p>}
              {(formData.unidade) && <p className="text-sm">Unidade: {formData.unidade}</p>}
              {(formData.departamento) && <p className="text-sm">Departamento: {formData.departamento}</p>}
              <Badge variant={funcionario.origem === "Ambos" ? "default" : "secondary"}>{funcionario.origem}</Badge>
            </div>
          </div>

          {/* Fixed field sections */}
          {FIXED_FIELDS.map(({ grupo, icon: Icon, fields }) => {
            const rendered = fields.map(f => renderField(f.key, f.label, f.tipo));
            const hasContent = editing || rendered.some(r => r !== null);
            if (!hasContent) return null;
            return (
              <div key={grupo} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-muted-foreground">{grupo}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {rendered}
                </div>
              </div>
            );
          })}

          {/* Dynamic field sections from admissao_campos */}
          {Object.entries(dynamicGroups).map(([grupo, camposGrupo]) => {
            const rendered = camposGrupo.map(c =>
              renderField(c.campo_nome, c.label, c.tipo, c.opcoes || undefined)
            );
            const hasContent = editing || rendered.some(r => r !== null);
            if (!hasContent) return null;
            return (
              <div key={grupo} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm text-muted-foreground">{grupo}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {rendered}
                </div>
              </div>
            );
          })}

          {/* Extra fields from dados that aren't in any definition */}
          {extraKeys.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm text-muted-foreground">Outros Campos</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {extraKeys.map(key => renderField(key, key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), "text"))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
