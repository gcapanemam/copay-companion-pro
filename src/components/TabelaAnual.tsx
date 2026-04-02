import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from "lucide-react";
import { DialogExames } from "./DialogExames";

const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface TabelaAnualProps {
  ano: number;
  refreshKey: number;
}

interface ExameDialogState {
  open: boolean;
  nomeUsuario: string;
  mes: number;
  itens: Array<{ procedimento: string; local: string | null; quantidade: number; valor: number }>;
}

export function TabelaAnual({ ano, refreshKey }: TabelaAnualProps) {
  const [dialog, setDialog] = useState<ExameDialogState>({ open: false, nomeUsuario: "", mes: 0, itens: [] });

  const { data: titulares, isLoading: loadingTitulares } = useQuery({
    queryKey: ["titulares", refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("titulares").select("*, dependentes(*)").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: mensalidades, isLoading: loadingMensalidades } = useQuery({
    queryKey: ["mensalidades", ano, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("mensalidades").select("*").eq("ano", ano);
      if (error) throw error;
      return data;
    },
  });

  const { data: coparticipacoes, isLoading: loadingCopart } = useQuery({
    queryKey: ["coparticipacoes", ano, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coparticipacoes")
        .select("*, coparticipacao_itens(*)")
        .eq("ano", ano);
      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingTitulares || loadingMensalidades || loadingCopart;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!titulares || titulares.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhum dado encontrado. Faça upload de um PDF para começar.</p>
      </div>
    );
  }

  function getMensalidade(titularId: string, dependenteId: string | null, mes: number): number {
    if (!mensalidades) return 0;
    const m = mensalidades.find(
      (m) => m.titular_id === titularId && m.dependente_id === dependenteId && m.mes === mes
    );
    return m?.valor || 0;
  }

  function getCoparticipacaoTotal(titularId: string, dependenteId: string | null, mes: number): number {
    if (!coparticipacoes) return 0;
    return coparticipacoes
      .filter((c) => c.titular_id === titularId && c.dependente_id === dependenteId && c.mes === mes)
      .reduce((sum, c) => {
        const itens = (c as any).coparticipacao_itens || [];
        return sum + itens.reduce((s: number, i: any) => s + (i.valor || 0), 0);
      }, 0);
  }

  function getCoparticipacaoItens(titularId: string, dependenteId: string | null, mes: number) {
    if (!coparticipacoes) return [];
    const matching = coparticipacoes.filter(
      (c) => c.titular_id === titularId && c.dependente_id === dependenteId && c.mes === mes
    );
    return matching.flatMap((c) => (c as any).coparticipacao_itens || []);
  }

  function openExames(nome: string, titularId: string, dependenteId: string | null, mes: number) {
    const itens = getCoparticipacaoItens(titularId, dependenteId, mes);
    setDialog({ open: true, nomeUsuario: nome, mes, itens });
  }

  // Build rows: each titular + their dependentes
  type RowData = {
    nome: string;
    titularId: string;
    dependenteId: string | null;
    isTitular: boolean;
  };

  const rows: RowData[] = [];
  for (const t of titulares) {
    rows.push({ nome: t.nome, titularId: t.id, dependenteId: null, isTitular: true });
    const deps = (t as any).dependentes || [];
    for (const d of deps) {
      rows.push({ nome: d.nome, titularId: t.id, dependenteId: d.id, isTitular: false });
    }
  }

  return (
    <>
      <div className="overflow-auto rounded-lg border max-h-[70vh]">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-muted">
            <TableRow className="bg-muted/50">
              <TableHead className="sticky left-0 z-30 bg-muted min-w-[200px]">Beneficiário</TableHead>
              {MESES_CURTO.map((m, i) => (
                <TableHead key={i} className="text-center min-w-[110px] bg-muted">{m}</TableHead>
              ))}
              <TableHead className="text-center min-w-[110px] font-bold bg-muted">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => {
              let totalMensalidade = 0;
              let totalCopart = 0;

              return (
                <TableRow key={rowIdx} className={row.isTitular ? "bg-primary/5" : ""}>
                  <TableCell className={`sticky left-0 z-10 ${row.isTitular ? "bg-primary/5 font-semibold" : "bg-background pl-8"} border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]`}>
                    {row.isTitular ? row.nome : `↳ ${row.nome}`}
                  </TableCell>
                  {Array.from({ length: 12 }, (_, mesIdx) => {
                    const mes = mesIdx + 1;
                    const mensalidadeVal = getMensalidade(row.titularId, row.dependenteId, mes);
                    const copartVal = getCoparticipacaoTotal(row.titularId, row.dependenteId, mes);
                    totalMensalidade += mensalidadeVal;
                    totalCopart += copartVal;

                    return (
                      <TableCell key={mesIdx} className="text-center p-2">
                        {mensalidadeVal > 0 || copartVal > 0 ? (
                          <div className="space-y-1">
                            {mensalidadeVal > 0 && (
                              <div className="text-xs font-medium">
                                R$ {mensalidadeVal.toFixed(2)}
                              </div>
                            )}
                            {copartVal > 0 && (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-xs text-orange-600 font-medium">
                                  R$ {copartVal.toFixed(2)}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => openExames(row.nome, row.titularId, row.dependenteId, mes)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center p-2 font-bold">
                    <div className="space-y-1">
                      {totalMensalidade > 0 && (
                        <div className="text-xs">R$ {totalMensalidade.toFixed(2)}</div>
                      )}
                      {totalCopart > 0 && (
                        <div className="text-xs text-orange-600">R$ {totalCopart.toFixed(2)}</div>
                      )}
                      {totalMensalidade === 0 && totalCopart === 0 && (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DialogExames
        open={dialog.open}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        nomeUsuario={dialog.nomeUsuario}
        mes={dialog.mes}
        ano={ano}
        itens={dialog.itens}
      />
    </>
  );
}
