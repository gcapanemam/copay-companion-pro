import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bus } from "lucide-react";
import { PortalVtInconsistencias } from "./PortalVtInconsistencias";

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
  cpf?: string;
}

export function PortalValeTransporte({ valeTransporte, cpf }: Props) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const mensal = (
    !valeTransporte || valeTransporte.length === 0 ? (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bus className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum registro de vale-transporte.
        </CardContent>
      </Card>
    ) : (
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
    )
  );

  if (!cpf) return mensal;

  return (
    <Tabs defaultValue="mensal" className="space-y-4">
      <TabsList>
        <TabsTrigger value="mensal">Mensal</TabsTrigger>
        <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
      </TabsList>
      <TabsContent value="mensal">{mensal}</TabsContent>
      <TabsContent value="inconsistencias">
        <PortalVtInconsistencias cpf={cpf} />
      </TabsContent>
    </Tabs>
  );
}
