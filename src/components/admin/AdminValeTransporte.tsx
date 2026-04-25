import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Upload, FileText, CreditCard, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";
import { parseValeTransportePdf, type VtPdfParseResult } from "@/lib/parseValeTransportePdf";

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export function AdminValeTransporte() {
  const [cpf, setCpf] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [valor, setValor] = useState("");
  const [qtdPassagens, setQtdPassagens] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PDF import
  const [pdfPreview, setPdfPreview] = useState<VtPdfParseResult | null>(null);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfCpfManual, setPdfCpfManual] = useState("");

  // Cartão form
  const [novoCartao, setNovoCartao] = useState("");
  const [novoCartaoCpf, setNovoCartaoCpf] = useState("");
  const [novoCartaoObs, setNovoCartaoObs] = useState("");
  const [novoCartaoLinhas, setNovoCartaoLinhas] = useState<string[]>([]);
  const [linhaInput, setLinhaInput] = useState("");

  const adicionarLinha = () => {
    const v = linhaInput.trim();
    if (!v) return;
    if (novoCartaoLinhas.includes(v)) {
      setLinhaInput("");
      return;
    }
    setNovoCartaoLinhas([...novoCartaoLinhas, v]);
    setLinhaInput("");
  };
  const removerLinha = (l: string) =>
    setNovoCartaoLinhas(novoCartaoLinhas.filter((x) => x !== l));

  const { data: registros, isLoading } = useQuery({
    queryKey: ["admin-vt"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vale_transporte").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: beneficiarios } = useQuery({
    queryKey: ["beneficiarios-list"],
    queryFn: async () => {
      const { data: t } = await supabase.from("titulares").select("nome, cpf").not("cpf", "is", null).order("nome");
      return t || [];
    },
  });

  const { data: cartoes } = useQuery({
    queryKey: ["vt-cartoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vt_cartoes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: usos } = useQuery({
    queryKey: ["vt-usos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vt_usos")
        .select("*")
        .order("data_hora", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const getNome = (cpfVal: string) => (beneficiarios || []).find(x => x.cpf?.replace(/\D/g, "") === cpfVal)?.nome || cpfVal;
  const getCpfDoCartao = (numero: string) =>
    (cartoes || []).find((c) => c.numero_cartao === numero)?.cpf || null;

  const handleAdd = async () => {
    if (!cpf || !mes || !ano || !valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("vale_transporte").insert({
        cpf: cpf.replace(/\D/g, ""),
        mes: Number(mes),
        ano: Number(ano),
        valor: Number(valor),
        quantidade_passagens: qtdPassagens ? Number(qtdPassagens) : null,
        observacao: observacao || null,
      });
      if (error) throw error;
      toast({ title: "Vale-transporte registrado!" });
      setValor("");
      setQtdPassagens("");
      setObservacao("");
      queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("vale_transporte").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
  };

  const handleUploadPlanilha = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    let count = 0;
    for (const row of rows) {
      const rowCpf = String(row.cpf || row.CPF || "").replace(/\D/g, "");
      if (!rowCpf) continue;
      await supabase.from("vale_transporte").insert({
        cpf: rowCpf,
        mes: Number(row.mes || 1),
        ano: Number(row.ano || new Date().getFullYear()),
        valor: Number(row.valor || 0),
        quantidade_passagens: row.quantidade_passagens || row.passagens || null,
        observacao: row.observacao || row.obs || null,
      });
      count++;
    }
    toast({ title: `${count} registros importados!` });
    queryClient.invalidateQueries({ queryKey: ["admin-vt"] });
    e.target.value = "";
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseValeTransportePdf(file);
      if (result.usos.length === 0) {
        toast({ title: "Nenhum uso encontrado no PDF", variant: "destructive" });
        return;
      }
      // tenta vincular automaticamente pelo cartão cadastrado
      const cpfAuto = result.numeroCartao ? getCpfDoCartao(result.numeroCartao) : null;
      setPdfCpfManual(cpfAuto || "");
      setPdfPreview(result);
    } catch (err: any) {
      toast({ title: "Erro ao ler PDF", description: err.message, variant: "destructive" });
    } finally {
      e.target.value = "";
    }
  };

  const handleConfirmImportPdf = async () => {
    if (!pdfPreview) return;
    const cpfFinal = pdfCpfManual.replace(/\D/g, "") || null;
    if (!cpfFinal) {
      toast({
        title: "Selecione o funcionário",
        description: "Cadastre o cartão na aba 'Cartões' ou escolha o funcionário manualmente.",
        variant: "destructive",
      });
      return;
    }
    setPdfImporting(true);
    try {
      // se cartão não cadastrado, cria automaticamente
      if (pdfPreview.numeroCartao && !getCpfDoCartao(pdfPreview.numeroCartao)) {
        await supabase.from("vt_cartoes").upsert(
          {
            numero_cartao: pdfPreview.numeroCartao,
            cpf: cpfFinal,
            titular_nome: pdfPreview.titular || null,
          },
          { onConflict: "numero_cartao" }
        );
      }

      const payload = pdfPreview.usos.map((u) => ({
        numero_cartao: pdfPreview.numeroCartao || "DESCONHECIDO",
        cpf: cpfFinal,
        data_hora: u.data_hora,
        linha: u.linha,
        valor: u.valor,
        operadora: u.operadora || null,
        tipo_tarifa: u.tipo_tarifa || null,
      }));

      let inseridos = 0;
      for (let i = 0; i < payload.length; i += 200) {
        const batch = payload.slice(i, i + 200);
        const { error, count } = await supabase
          .from("vt_usos")
          .upsert(batch, {
            onConflict: "numero_cartao,data_hora,linha,valor",
            ignoreDuplicates: true,
            count: "exact",
          });
        if (error) throw error;
        inseridos += count ?? batch.length;
      }
      toast({ title: `${inseridos} usos importados!`, description: `Cartão ${pdfPreview.numeroCartao}` });
      setPdfPreview(null);
      setPdfCpfManual("");
      queryClient.invalidateQueries({ queryKey: ["vt-usos"] });
      queryClient.invalidateQueries({ queryKey: ["vt-cartoes"] });
    } catch (err: any) {
      const msg = err?.message || err?.details || JSON.stringify(err);
      toast({ title: "Erro ao importar", description: msg, variant: "destructive" });
    } finally {
      setPdfImporting(false);
    }
  };

  const handleAddCartao = async () => {
    if (!novoCartao || !novoCartaoCpf) {
      toast({ title: "Informe número do cartão e funcionário", variant: "destructive" });
      return;
    }
    const titularNome = (beneficiarios || []).find((b) => b.cpf === novoCartaoCpf)?.nome || null;
    const { error } = await supabase.from("vt_cartoes").upsert(
      {
        numero_cartao: novoCartao.trim(),
        cpf: novoCartaoCpf.replace(/\D/g, ""),
        titular_nome: titularNome,
        observacao: novoCartaoObs || null,
        linhas: novoCartaoLinhas,
      } as any,
      { onConflict: "numero_cartao" }
    );
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cartão cadastrado!" });
    setNovoCartao("");
    setNovoCartaoCpf("");
    setNovoCartaoObs("");
    setNovoCartaoLinhas([]);
    setLinhaInput("");
    queryClient.invalidateQueries({ queryKey: ["vt-cartoes"] });
  };

  const handleDeleteCartao = async (id: string) => {
    await supabase.from("vt_cartoes").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["vt-cartoes"] });
  };

  const handleDeleteUso = async (id: string) => {
    await supabase.from("vt_usos").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["vt-usos"] });
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  const totalPdf = pdfPreview?.usos.reduce((s, u) => s + u.valor, 0) || 0;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="mensal">
        <TabsList>
          <TabsTrigger value="mensal">Lançamentos Mensais</TabsTrigger>
          <TabsTrigger value="usos">Usos do Cartão</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Registrar Vale-Transporte</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Funcionário</Label>
                  <Select value={cpf} onValueChange={setCpf}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(beneficiarios || []).map((b) => (
                        <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select value={mes} onValueChange={setMes}>
                    <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd Passagens</Label>
                  <Input type="number" value={qtdPassagens} onChange={(e) => setQtdPassagens(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Input value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleAdd} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Adicionar"}
                </Button>
                <Label htmlFor="vt-upload" className="cursor-pointer">
                  <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />Importar Planilha
                  </div>
                </Label>
                <Input id="vt-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadPlanilha} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Registros de Vale-Transporte</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Mês/Ano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Passagens</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(registros || []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{getNome(r.cpf)}</TableCell>
                        <TableCell>{MESES[(r.mes || 1) - 1]} / {r.ano}</TableCell>
                        <TableCell>{fmt(r.valor)}</TableCell>
                        <TableCell>{r.quantidade_passagens ?? "-"}</TableCell>
                        <TableCell>{r.observacao || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usos" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle>Usos detalhados do cartão (passagens)</CardTitle>
                <div>
                  <Label htmlFor="vt-pdf-upload" className="cursor-pointer">
                    <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                      <FileText className="h-4 w-4" />Importar Relatório de Uso (PDF)
                    </div>
                  </Label>
                  <Input id="vt-pdf-upload" type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUploadPdf} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e Hora</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Cartão</TableHead>
                    <TableHead>Linha</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(usos || []).map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>{fmtDateTime(u.data_hora)}</TableCell>
                      <TableCell>{u.cpf ? getNome(u.cpf) : "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{u.numero_cartao}</TableCell>
                      <TableCell>{u.linha || "-"}</TableCell>
                      <TableCell>{fmt(Number(u.valor))}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUso(u.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!usos || usos.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Nenhum uso importado. Use o botão "Importar Relatório de Uso (PDF)" acima.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cartoes" className="space-y-6 mt-4">
          <Card>
            <CardHeader><CardTitle>Cadastrar Cartão de VT</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Número do cartão</Label>
                  <Input
                    value={novoCartao}
                    onChange={(e) => setNovoCartao(e.target.value)}
                    placeholder="06850003823536-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Funcionário</Label>
                  <Select value={novoCartaoCpf} onValueChange={setNovoCartaoCpf}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(beneficiarios || []).map((b) => (
                        <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Input value={novoCartaoObs} onChange={(e) => setNovoCartaoObs(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Label>Linhas de ônibus</Label>
                <div className="flex gap-2">
                  <Input
                    value={linhaInput}
                    onChange={(e) => setLinhaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        adicionarLinha();
                      }
                    }}
                    placeholder="Ex.: 6062, 8217, SE01..."
                  />
                  <Button type="button" variant="secondary" onClick={adicionarLinha}>
                    <Plus className="h-4 w-4 mr-1" />Adicionar
                  </Button>
                </div>
                {novoCartaoLinhas.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {novoCartaoLinhas.map((l) => (
                      <span
                        key={l}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                      >
                        {l}
                        <button
                          type="button"
                          onClick={() => removerLinha(l)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${l}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Pressione Enter ou vírgula para adicionar várias linhas.
                </p>
              </div>
              <Button onClick={handleAddCartao}>
                <CreditCard className="h-4 w-4 mr-1" />Salvar Cartão
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cartões cadastrados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cartão</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Titular (PDF)</TableHead>
                    <TableHead>Linhas</TableHead>
                    <TableHead>Obs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cartoes || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.numero_cartao}</TableCell>
                      <TableCell>{getNome(c.cpf)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.titular_nome || "-"}</TableCell>
                      <TableCell>
                        {Array.isArray(c.linhas) && c.linhas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.linhas.map((l: string) => (
                              <span key={l} className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                                {l}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{c.observacao || "-"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCartao(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!cartoes || cartoes.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Nenhum cartão cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de preview do PDF */}
      <Dialog open={!!pdfPreview} onOpenChange={(o) => !o && setPdfPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview da Importação</DialogTitle>
          </DialogHeader>
          {pdfPreview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cartão:</span> <span className="font-mono">{pdfPreview.numeroCartao || "-"}</span></div>
                <div><span className="text-muted-foreground">Titular (PDF):</span> {pdfPreview.titular || "-"}</div>
                <div><span className="text-muted-foreground">Período:</span> {pdfPreview.periodo || "-"}</div>
                <div><span className="text-muted-foreground">Total de usos:</span> <strong>{pdfPreview.usos.length}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Soma dos valores:</span> <strong>{fmt(totalPdf)}</strong></div>
              </div>

              <div className="space-y-2">
                <Label>Vincular ao funcionário</Label>
                <Select value={pdfCpfManual} onValueChange={setPdfCpfManual}>
                  <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                  <SelectContent>
                    {(beneficiarios || []).map((b) => (
                      <SelectItem key={b.cpf} value={b.cpf!}>{b.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pdfPreview.numeroCartao && getCpfDoCartao(pdfPreview.numeroCartao) && (
                  <p className="text-xs text-muted-foreground">
                    Vínculo automático pelo cartão cadastrado.
                  </p>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead>Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pdfPreview.usos.slice(0, 20).map((u, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{fmtDateTime(u.data_hora)}</TableCell>
                        <TableCell>{u.linha}</TableCell>
                        <TableCell>{fmt(u.valor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {pdfPreview.usos.length > 20 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ...e mais {pdfPreview.usos.length - 20} registros
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPdfPreview(null)} disabled={pdfImporting}>Cancelar</Button>
            <Button onClick={handleConfirmImportPdf} disabled={pdfImporting}>
              {pdfImporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Confirmar importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
