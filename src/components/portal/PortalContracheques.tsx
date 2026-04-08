import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Props {
  contracheques: Array<{ mes: number; ano: number; arquivo_path: string; nome_arquivo: string }>;
}

export function PortalContracheques({ contracheques }: Props) {
  const handleDownload = async (path: string, filename: string) => {
    const { data } = supabase.storage.from("contracheques").getPublicUrl(path);
    if (data?.publicUrl) {
      window.open(data.publicUrl, "_blank");
    }
  };

  if (!contracheques || contracheques.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          Nenhum contracheque disponível.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Meus Contracheques</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês/Ano</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracheques.map((c, i) => (
              <TableRow key={i}>
                <TableCell>{MESES[(c.mes || 1) - 1]} / {c.ano}</TableCell>
                <TableCell>{c.nome_arquivo}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(c.arquivo_path, c.nome_arquivo)}>
                    <Download className="h-4 w-4 mr-1" />Baixar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
