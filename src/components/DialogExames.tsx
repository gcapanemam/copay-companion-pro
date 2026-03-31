import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ExameItem {
  procedimento: string;
  local: string | null;
  quantidade: number;
  valor: number;
}

interface DialogExamesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomeUsuario: string;
  mes: number;
  ano: number;
  itens: ExameItem[];
}

const MESES = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function DialogExames({ open, onOpenChange, nomeUsuario, mes, ano, itens }: DialogExamesProps) {
  const total = itens.reduce((sum, i) => sum + i.valor, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Exames - {nomeUsuario} ({MESES[mes]}/{ano})
          </DialogTitle>
        </DialogHeader>
        {itens.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum procedimento registrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Procedimento</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs">{item.procedimento}</TableCell>
                  <TableCell className="text-xs">{item.local || "-"}</TableCell>
                  <TableCell className="text-right text-xs">{item.quantidade}</TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    R$ {item.valor.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right">R$ {total.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
