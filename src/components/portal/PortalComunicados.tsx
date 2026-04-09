import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Eye, Megaphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Comunicado {
  id: string;
  titulo: string;
  mensagem: string;
  tipo_destinatario: string;
  valor_destinatario: string | null;
  created_at: string;
}

interface Leitura {
  comunicado_id: string;
  visualizado_em: string | null;
  confirmado_em: string | null;
}

interface Props {
  comunicados: Comunicado[];
  cpf: string;
  unidade?: string | null;
  departamento?: string | null;
}

export const PortalComunicados = ({ comunicados, cpf, unidade, departamento }: Props) => {
  const [leituras, setLeituras] = useState<Map<string, Leitura>>(new Map());
  const [selectedCom, setSelectedCom] = useState<Comunicado | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeituras();
  }, [cpf, comunicados]);

  const fetchLeituras = async () => {
    if (!cpf || comunicados.length === 0) return;
    const ids = comunicados.map(c => c.id);
    const { data } = await supabase
      .from("comunicado_leituras")
      .select("comunicado_id, visualizado_em, confirmado_em")
      .eq("cpf", cpf)
      .in("comunicado_id", ids);
    const map = new Map<string, Leitura>();
    (data || []).forEach(r => map.set(r.comunicado_id, r));
    setLeituras(map);
  };

  // Filter comunicados relevant to this user
  const meusComunicados = comunicados; // already filtered by edge function

  const handleOpen = async (c: Comunicado) => {
    setSelectedCom(c);
    // Mark as viewed if not already
    const existing = leituras.get(c.id);
    if (!existing) {
      await supabase.from("comunicado_leituras").upsert(
        { comunicado_id: c.id, cpf, visualizado_em: new Date().toISOString() },
        { onConflict: "comunicado_id,cpf" }
      );
      setLeituras(prev => {
        const next = new Map(prev);
        next.set(c.id, { comunicado_id: c.id, visualizado_em: new Date().toISOString(), confirmado_em: null });
        return next;
      });
    }
  };

  const handleConfirm = async (comunicadoId: string) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("comunicado_leituras").upsert(
        { comunicado_id: comunicadoId, cpf, visualizado_em: now, confirmado_em: now },
        { onConflict: "comunicado_id,cpf" }
      );
      setLeituras(prev => {
        const next = new Map(prev);
        const existing = next.get(comunicadoId);
        next.set(comunicadoId, {
          comunicado_id: comunicadoId,
          visualizado_em: existing?.visualizado_em || now,
          confirmado_em: now,
        });
        return next;
      });
      toast({ title: "Leitura confirmada!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (meusComunicados.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum comunicado disponível.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {meusComunicados.map(c => {
        const leitura = leituras.get(c.id);
        const visualizado = !!leitura?.visualizado_em;
        const confirmado = !!leitura?.confirmado_em;

        return (
          <Card
            key={c.id}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${!visualizado ? "border-primary/50 bg-primary/5" : ""}`}
            onClick={() => handleOpen(c)}
          >
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {!visualizado && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                  <h3 className="font-semibold truncate">{c.titulo}</h3>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.mensagem}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {confirmado ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" />Confirmado
                  </Badge>
                ) : visualizado ? (
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 gap-1">
                    <Eye className="h-3 w-3" />Visto
                  </Badge>
                ) : (
                  <Badge variant="outline">Novo</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!selectedCom} onOpenChange={(open) => !open && setSelectedCom(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{selectedCom?.titulo}</DialogTitle></DialogHeader>
          {selectedCom && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">{new Date(selectedCom.created_at).toLocaleString("pt-BR")}</p>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{selectedCom.mensagem}</p>
              </div>
              {!leituras.get(selectedCom.id)?.confirmado_em && (
                <Button onClick={() => handleConfirm(selectedCom.id)} disabled={loading} className="w-full">
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  {loading ? "Confirmando..." : "Confirmar Leitura"}
                </Button>
              )}
              {leituras.get(selectedCom.id)?.confirmado_em && (
                <div className="text-center text-sm text-green-600 flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Leitura confirmada em {new Date(leituras.get(selectedCom.id)!.confirmado_em!).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
