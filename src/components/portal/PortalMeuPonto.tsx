import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Clock } from "lucide-react";

function formatDateTime(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

interface Props {
  cpf: string;
}

export function PortalMeuPonto({ cpf }: Props) {
  const cpfDigits = String(cpf || "").replace(/\D/g, "").padStart(11, "0");

  const { data: marcacoes = [], isLoading } = useQuery({
    queryKey: ["meu-ponto", cpfDigits],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("*")
        .eq("cpf", cpfDigits)
        .order("data_hora", { ascending: false, nullsFirst: false })
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpfDigits,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />Meu Ponto Eletrônico
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : marcacoes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma marcação registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marcacoes.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.data_hora ? formatDateTime(m.data_hora) : `${m.data} ${m.entrada_1 || ""}`}</TableCell>
                    <TableCell>{m.tipo_marcacao || m.ocorrencia || "Marcação"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
