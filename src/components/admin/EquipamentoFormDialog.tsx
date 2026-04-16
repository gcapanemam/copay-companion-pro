import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipamento?: any;
  onSaved: () => void;
}

export function EquipamentoFormDialog({ open, onOpenChange, equipamento, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(equipamento?.nome || "");
      setModelo(equipamento?.modelo || "");
      setNumeroSerie(equipamento?.numero_serie || "");
      setDescricao(equipamento?.descricao || "");
      setAtivo(equipamento?.ativo ?? true);
    }
  }, [open, equipamento]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        modelo: modelo.trim() || null,
        numero_serie: numeroSerie.trim() || null,
        descricao: descricao.trim() || null,
        ativo,
      };
      if (equipamento?.id) {
        const { error } = await supabase.from("equipamentos_ponto").update(payload).eq("id", equipamento.id);
        if (error) throw error;
        toast.success("Equipamento atualizado");
      } else {
        const { error } = await supabase.from("equipamentos_ponto").insert(payload);
        if (error) throw error;
        toast.success("Equipamento cadastrado");
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{equipamento ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: REP Recepção" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="REP-C iDClass" />
            </div>
            <div className="space-y-2">
              <Label>Número de Série</Label>
              <Input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="00014003750021988" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Localização ou observações" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label>Equipamento ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
