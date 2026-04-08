import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarX } from "lucide-react";

interface Falta {
  data_falta: string;
  tipo: string;
  justificativa: string | null;
  abonada: boolean;
}

interface Props {
  faltas: Falta[];
}

export function PortalFaltas({ faltas }: Props) {
  if (!faltas || faltas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CalendarX className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhuma falta registrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Minhas Faltas</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Justificativa</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faltas.map((f, i) => (
              <TableRow key={i}>
                <TableCell>{new Date(f.data_falta).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell>{f.tipo}</TableCell>
                <TableCell>{f.justificativa || "-"}</TableCell>
                <TableCell>
                  {f.abonada ? <Badge variant="secondary">Abonada</Badge> : <Badge variant="destructive">Não abonada</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
