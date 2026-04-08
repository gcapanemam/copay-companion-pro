import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

interface EPI {
  tipo_epi: string;
  data_entrega: string;
  data_validade: string | null;
  quantidade: number;
  observacao: string | null;
}

interface Props {
  epis: EPI[];
}

export function PortalEPIs({ epis }: Props) {
  const isVencido = (v: string | null) => v ? new Date(v) < new Date() : false;

  if (!epis || epis.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum EPI registrado.
        </CardContent>
      </Card>
    );
  }

  const vencidos = epis.filter(e => isVencido(e.data_validade));

  return (
    <div className="space-y-4">
      {vencidos.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="py-3">
            <p className="text-sm text-destructive font-medium">
              ⚠️ Você tem {vencidos.length} EPI(s) com validade vencida. Procure o setor responsável.
            </p>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Meus EPIs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {epis.map((e, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{e.tipo_epi}</TableCell>
                  <TableCell>{new Date(e.data_entrega).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{e.data_validade ? new Date(e.data_validade).toLocaleDateString("pt-BR") : "-"}</TableCell>
                  <TableCell>{e.quantidade}</TableCell>
                  <TableCell>
                    {e.data_validade ? (
                      isVencido(e.data_validade) ? <Badge variant="destructive">Vencido</Badge> : <Badge variant="secondary">Válido</Badge>
                    ) : <Badge variant="outline">Sem validade</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
