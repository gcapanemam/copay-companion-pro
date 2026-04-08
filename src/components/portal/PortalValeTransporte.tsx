import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bus } from "lucide-react";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface VT {
  mes: number;
  ano: number;
  valor: number;
  quantidade_passagens: number | null;
  observacao: string | null;
}

interface Props {
  valeTransporte: VT[];
}

export function PortalValeTransporte({ valeTransporte }: Props) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!valeTransporte || valeTransporte.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bus className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum registro de vale-transporte.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Meu Vale-Transporte</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês/Ano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Passagens</TableHead>
              <TableHead>Obs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {valeTransporte.map((v, i) => (
              <TableRow key={i}>
                <TableCell>{MESES[(v.mes || 1) - 1]} / {v.ano}</TableCell>
                <TableCell>{fmt(v.valor)}</TableCell>
                <TableCell>{v.quantidade_passagens ?? "-"}</TableCell>
                <TableCell>{v.observacao || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
