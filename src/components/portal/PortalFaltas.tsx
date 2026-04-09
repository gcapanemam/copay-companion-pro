import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarX, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Falta {
  data_falta: string;
  tipo: string;
  justificativa: string | null;
  abonada: boolean;
}

interface RegistroPonto {
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  entrada_3: string | null;
  saida_3: string | null;
  duracao: string | null;
}

interface Props {
  faltas: Falta[];
  registrosPonto?: RegistroPonto[];
}

export function PortalFaltas({ faltas, registrosPonto = [] }: Props) {
  return (
    <Tabs defaultValue="ponto" className="space-y-4">
      <TabsList>
        <TabsTrigger value="ponto" className="flex items-center gap-1">
          <Clock className="h-4 w-4" />Espelho de Ponto
        </TabsTrigger>
        <TabsTrigger value="faltas" className="flex items-center gap-1">
          <CalendarX className="h-4 w-4" />Faltas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="ponto">
        {registrosPonto.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              Nenhum registro de ponto encontrado.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Meu Espelho de Ponto</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ent. 1</TableHead>
                      <TableHead>Saí. 1</TableHead>
                      <TableHead>Ent. 2</TableHead>
                      <TableHead>Saí. 2</TableHead>
                      <TableHead>Ent. 3</TableHead>
                      <TableHead>Saí. 3</TableHead>
                      <TableHead>Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosPonto.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{r.entrada_1 || "-"}</TableCell>
                        <TableCell>{r.saida_1 || "-"}</TableCell>
                        <TableCell>{r.entrada_2 || "-"}</TableCell>
                        <TableCell>{r.saida_2 || "-"}</TableCell>
                        <TableCell>{r.entrada_3 || "-"}</TableCell>
                        <TableCell>{r.saida_3 || "-"}</TableCell>
                        <TableCell>
                          {r.duracao ? <Badge variant="secondary">{r.duracao}</Badge> : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="faltas">
        {!faltas || faltas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CalendarX className="h-12 w-12 mx-auto mb-2 opacity-50" />
              Nenhuma falta registrada.
            </CardContent>
          </Card>
        ) : (
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
        )}
      </TabsContent>
    </Tabs>
  );
}
