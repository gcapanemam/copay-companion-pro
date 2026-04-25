import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Send } from "lucide-react";
import { ROTULOS_REGRA, type RegraVt } from "@/lib/analisarVtInconsistencias";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente de justificativa",
  justificada: "Aguardando análise",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};
const STATUS_VARIANT: Record<string, any> = {
  pendente: "secondary",
  justificada: "default",
  aprovada: "default",
  rejeitada: "destructive",
};

interface Props { cpf: string }

export function PortalVtInconsistencias({ cpf }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [textos, setTextos] = useState<Record<string, string>>({});

  const cpfNorm = cpf.replace(/\D/g, "");

  const { data: incs } = useQuery({
    queryKey: ["portal-vt-incs", cpfNorm],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vt_inconsistencias")
        .select("*")
        .eq("cpf", cpfNorm)
        .order("data_hora", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpfNorm,
  });

  const enviar = async (id: string) => {
    const t = (textos[id] || "").trim();
    if (!t) return toast({ title: "Escreva sua justificativa", variant: "destructive" });
    const { error } = await supabase
      .from("vt_inconsistencias")
      .update({ justificativa: t, justificada_em: new Date().toISOString(), status: "justificada" })
      .eq("id", id);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Justificativa enviada!" });
    setTextos({ ...textos, [id]: "" });
    qc.invalidateQueries({ queryKey: ["portal-vt-incs", cpfNorm] });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  if (!incs || incs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhuma inconsistência registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Inconsistências do Vale-Transporte</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Linha</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Justificativa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incs.map((i: any) => (
              <TableRow key={i.id}>
                <TableCell className="text-xs">{fmtDateTime(i.data_hora)}</TableCell>
                <TableCell>{i.linha || "-"}</TableCell>
                <TableCell>{fmt(Number(i.valor))}</TableCell>
                <TableCell>
                  <div>
                    <Badge variant="outline">{ROTULOS_REGRA[i.regra as RegraVt] || i.regra}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">{i.detalhe}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                  {i.observacao_admin && (
                    <div className="text-xs italic mt-1">Admin: {i.observacao_admin}</div>
                  )}
                </TableCell>
                <TableCell className="min-w-[260px]">
                  {i.status === "pendente" || i.status === "rejeitada" ? (
                    <div className="space-y-2">
                      {i.justificativa && (
                        <div className="text-xs text-muted-foreground">Anterior: {i.justificativa}</div>
                      )}
                      <Textarea
                        placeholder="Explique o motivo do uso..."
                        value={textos[i.id] || ""}
                        onChange={(e) => setTextos({ ...textos, [i.id]: e.target.value })}
                        rows={2}
                      />
                      <Button size="sm" onClick={() => enviar(i.id)}>
                        <Send className="h-4 w-4 mr-1" />Enviar
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm">{i.justificativa}</div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
