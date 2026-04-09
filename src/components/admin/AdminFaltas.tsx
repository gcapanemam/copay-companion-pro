import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Upload, Clock, CalendarX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

const TIPOS_FALTA = ["Falta", "Atestado", "Licença Médica", "Licença Maternidade", "Licença Paternidade", "Suspensão", "Outro"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type PontoColumnKey = "entrada_1" | "saida_1" | "entrada_2" | "saida_2" | "entrada_3" | "saida_3" | "duracao";

interface PositionedText {
  text: string;
  x: number;
  y: number;
}

interface PontoColumnRange {
  key: PontoColumnKey;
  min: number;
  max: number;
}

interface PontoRecord {
  cpf: string;
  nome: string;
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  entrada_3: string | null;
  saida_3: string | null;
  duracao: string | null;
  ocorrencia: string | null;
  motivo: string | null;
}

const normalizeCpf = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

const formatDateBr = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");
  const monthIndex = Number(month) - 1;
  return monthIndex >= 0 && monthIndex < MESES.length ? `${MESES[monthIndex]}/${year}` : monthKey;
};

const buildColumnRanges = (positions: Array<{ key: PontoColumnKey; x: number }>) => {
  return positions.map((column, index) => ({
    key: column.key,
    min: index === 0 ? column.x - 12 : Math.floor((positions[index - 1].x + column.x) / 2),
    max: index === positions.length - 1 ? column.x + 24 : Math.ceil((column.x + positions[index + 1].x) / 2),
  }));
};

const DEFAULT_COLUMN_RANGES: PontoColumnRange[] = buildColumnRanges([
  { key: "entrada_1", x: 179 },
  { key: "saida_1", x: 205 },
  { key: "entrada_2", x: 229 },
  { key: "saida_2", x: 255 },
  { key: "entrada_3", x: 279 },
  { key: "saida_3", x: 305 },
  { key: "duracao", x: 329 },
]);

function groupTextItemsIntoLines(items: any[]): PositionedText[][] {
  const textItems = items
    .map((item) => ({
      text: item.str as string,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
    }))
    .filter((item) => item.text.trim());

  const lineMap = new Map<number, PositionedText[]>();
  for (const item of textItems) {
    let matchedY: number | null = null;
    for (const y of lineMap.keys()) {
      if (Math.abs(y - item.y) <= 3) {
        matchedY = y;
        break;
      }
    }

    const lineY = matchedY ?? item.y;
    if (!lineMap.has(lineY)) lineMap.set(lineY, []);
    lineMap.get(lineY)!.push(item);
  }

  return [...lineMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, lineItems]) => [...lineItems].sort((a, b) => a.x - b.x));
}

function getValueAfterLabel(line: PositionedText[], labelRegex: RegExp) {
  const labelIndex = line.findIndex((item) => labelRegex.test(item.text));
  if (labelIndex < 0) return "";

  const values: string[] = [];
  for (let index = labelIndex + 1; index < line.length; index++) {
    if (/:$/.test(line[index].text)) break;
    values.push(line[index].text);
  }

  return values.join(" ").trim();
}

function getColumnRanges(lines: PositionedText[][]) {
  const headerLine = lines.find((line) => line.some((item) => /^ENT\.\s*1$/i.test(item.text)) && line.some((item) => /^SA[ÍI]\.\s*1$/i.test(item.text)));
  if (!headerLine) return DEFAULT_COLUMN_RANGES;

  const ent1 = headerLine.find((item) => /^ENT\.\s*1$/i.test(item.text));
  const sai1 = headerLine.find((item) => /^SA[ÍI]\.\s*1$/i.test(item.text));
  const ent2 = headerLine.find((item) => /^ENT\.\s*2$/i.test(item.text));
  const sai2 = headerLine.find((item) => /^SA[ÍI]\.\s*2$/i.test(item.text));
  const ent3 = headerLine.find((item) => /^ENT\.\s*3$/i.test(item.text));
  const sai3 = headerLine.find((item) => /^SA[ÍI]\.\s*3$/i.test(item.text));
  const duracao = headerLine.find((item) => /^DURAÇÃO$/i.test(item.text));

  if (!ent1 || !sai1 || !duracao) return DEFAULT_COLUMN_RANGES;

  return buildColumnRanges([
    { key: "entrada_1", x: ent1.x },
    { key: "saida_1", x: sai1.x },
    { key: "entrada_2", x: ent2?.x ?? 229 },
    { key: "saida_2", x: sai2?.x ?? 255 },
    { key: "entrada_3", x: ent3?.x ?? 279 },
    { key: "saida_3", x: sai3?.x ?? 305 },
    { key: "duracao", x: duracao.x },
  ]);
}

async function parsePontoPdf(file: File): Promise<PontoRecord[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const records: PontoRecord[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = groupTextItemsIntoLines(content.items as any[]);
    const nome = getValueAfterLabel(lines.find((line) => line.some((item) => /^NOME:?$/i.test(item.text))) || [], /^NOME:?$/i);
    const cpfVal = normalizeCpf(getValueAfterLabel(lines.find((line) => line.some((item) => /^CPF:?$/i.test(item.text))) || [], /^CPF:?$/i));
    if (!cpfVal) continue;

    const columnRanges = getColumnRanges(lines);

    for (const line of lines) {
      const dayItem = line.find((item) => /^\d{2}\/\d{2}\/\d{2}\s*-\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)/i.test(item.text));
      if (!dayItem) continue;

      const dayMatch = dayItem.text.match(/^(\d{2})\/(\d{2})\/(\d{2})/);
      if (!dayMatch) continue;

      const [, day, month, shortYear] = dayMatch;
      const year = Number(shortYear) < 100 ? 2000 + Number(shortYear) : Number(shortYear);
      const horarios: Record<PontoColumnKey, string | null> = {
        entrada_1: null,
        saida_1: null,
        entrada_2: null,
        saida_2: null,
        entrada_3: null,
        saida_3: null,
        duracao: null,
      };

      for (const item of line) {
        const value = item.text.trim();
        if (!/^\d{2}:\d{2}$/.test(value)) continue;

        const column = columnRanges.find((range) => item.x >= range.min && item.x < range.max);
        if (!column || horarios[column.key]) continue;
        horarios[column.key] = value;
      }

      if (!Object.values(horarios).some(Boolean)) continue;

      const ocorrencia = line.filter((item) => item.x >= 430 && item.x < 480).map((item) => item.text).join(" ").trim() || null;
      const motivo = line.filter((item) => item.x >= 480).map((item) => item.text).join(" ").trim() || null;

      records.push({
        cpf: cpfVal,
        nome,
        data: `${year}-${month}-${day}`,
        ...horarios,
        ocorrencia,
        motivo,
      });
    }
  }

  return records;
}

export function AdminFaltas() {
  const [cpf, setCpf] = useState("");
  const [dataFalta, setDataFalta] = useState("");
  const [tipo, setTipo] = useState("Falta");
  const [justificativa, setJustificativa] = useState("");
  const [abonada, setAbonada] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [selectedPonto, setSelectedPonto] = useState<Set<string>>(new Set());
  const [selectedFuncionarioPonto, setSelectedFuncionarioPonto] = useState("");
  const [deletingPonto, setDeletingPonto] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: faltas, isLoading } = useQuery({
    queryKey: ["admin-faltas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("faltas").select("*").order("data_falta", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: registrosPonto, isLoading: loadingPonto } = useQuery({
    queryKey: ["admin-registros-ponto"],
    queryFn: async () => {
      const { data, error } = await supabase.from("registros_ponto").select("*").order("data", { ascending: false }).range(0, 5000);
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

  const getNome = (cpfVal: string) => (beneficiarios || []).find(x => normalizeCpf(x.cpf) === cpfVal)?.nome || cpfVal;

  const pontoAgrupado = useMemo(() => {
    const grupos = new Map<string, { cpf: string; nome: string; registros: any[]; meses: Map<string, any[]> }>();

    for (const registro of registrosPonto || []) {
      const cpfRegistro = normalizeCpf(registro.cpf);
      if (!cpfRegistro) continue;

      if (!grupos.has(cpfRegistro)) {
        grupos.set(cpfRegistro, {
          cpf: cpfRegistro,
          nome: getNome(cpfRegistro),
          registros: [],
          meses: new Map(),
        });
      }

      const grupo = grupos.get(cpfRegistro)!;
      const monthKey = String(registro.data).slice(0, 7);
      grupo.registros.push(registro);
      if (!grupo.meses.has(monthKey)) grupo.meses.set(monthKey, []);
      grupo.meses.get(monthKey)!.push(registro);
    }

    return [...grupos.values()]
      .map((grupo) => ({
        ...grupo,
        registros: [...grupo.registros].sort((a, b) => String(a.data).localeCompare(String(b.data))),
        meses: [...grupo.meses.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, registros]) => ({
            key,
            label: formatMonthLabel(key),
            registros: [...registros].sort((a, b) => String(a.data).localeCompare(String(b.data))),
          })),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [registrosPonto, beneficiarios]);

  useEffect(() => {
    if (pontoAgrupado.length === 0) {
      if (selectedFuncionarioPonto) setSelectedFuncionarioPonto("");
      return;
    }

    if (!selectedFuncionarioPonto || !pontoAgrupado.some((grupo) => grupo.cpf === selectedFuncionarioPonto)) {
      setSelectedFuncionarioPonto(pontoAgrupado[0].cpf);
    }
  }, [pontoAgrupado, selectedFuncionarioPonto]);

  const handleAdd = async () => {
    if (!cpf || !dataFalta) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("faltas").insert({
        cpf: cpf.replace(/\D/g, ""),
        data_falta: dataFalta,
        tipo,
        justificativa: justificativa || null,
        abonada,
      });
      if (error) throw error;
      toast({ title: "Falta registrada!" });
      setDataFalta("");
      setJustificativa("");
      setAbonada(false);
      queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("faltas").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
  };

  const handleDeletePonto = async (id: string) => {
    await supabase.from("registros_ponto").delete().eq("id", id);
    setSelectedPonto(prev => { const n = new Set(prev); n.delete(id); return n; });
    queryClient.invalidateQueries({ queryKey: ["admin-registros-ponto"] });
  };

  const handleBulkDeletePonto = async () => {
    if (selectedPonto.size === 0) return;
    setDeletingPonto(true);
    try {
      const ids = [...selectedPonto];
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        await supabase.from("registros_ponto").delete().in("id", batch);
      }
      toast({ title: `${ids.length} registro(s) deletado(s)!` });
      setSelectedPonto(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-registros-ponto"] });
    } catch (err: any) {
      toast({ title: "Erro ao deletar", description: err.message, variant: "destructive" });
    } finally {
      setDeletingPonto(false);
    }
  };

  const togglePontoSelection = (id: string) => {
    setSelectedPonto(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAllPonto = (ids: string[]) => {
    setSelectedPonto((prev) => {
      const next = new Set(prev);
      const allSelected = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
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
      await supabase.from("faltas").insert({
        cpf: rowCpf,
        data_falta: String(row.data_falta || row.data || ""),
        tipo: String(row.tipo || "Falta"),
        justificativa: row.justificativa || null,
        abonada: row.abonada === true || row.abonada === "sim" || row.abonada === "Sim",
      });
      count++;
    }
    toast({ title: `${count} faltas importadas!` });
    queryClient.invalidateQueries({ queryKey: ["admin-faltas"] });
    e.target.value = "";
  };

  const handleImportEspelhoPonto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportLog([]);
    try {
      const records = await parsePontoPdf(file);

      if (records.length === 0) {
        toast({ title: "Nenhum registro encontrado no PDF", variant: "destructive" });
        setImporting(false);
        return;
      }

      const log: string[] = [];
      const resumoFuncionarios = new Map<string, { nome: string; meses: Map<string, number> }>();
      for (const record of records) {
        const key = `${record.cpf}-${record.nome || record.cpf}`;
        if (!resumoFuncionarios.has(key)) {
          resumoFuncionarios.set(key, { nome: record.nome || record.cpf, meses: new Map() });
        }
        const resumo = resumoFuncionarios.get(key)!;
        const monthKey = record.data.slice(0, 7);
        resumo.meses.set(monthKey, (resumo.meses.get(monthKey) || 0) + 1);
      }

      log.push(`Encontrados ${records.length} registros de ${resumoFuncionarios.size} funcionário(s)`);

      let inserted = 0;
      let skipped = 0;

      for (const record of records) {
        const { error } = await supabase.from("registros_ponto").upsert({
          cpf: record.cpf,
          data: record.data,
          entrada_1: record.entrada_1,
          saida_1: record.saida_1,
          entrada_2: record.entrada_2,
          saida_2: record.saida_2,
          entrada_3: record.entrada_3,
          saida_3: record.saida_3,
          duracao: record.duracao,
          ocorrencia: record.ocorrencia,
          motivo: record.motivo,
        }, { onConflict: "cpf,data" });
        if (error) {
          skipped++;
        } else {
          inserted++;
        }
      }

      for (const resumo of [...resumoFuncionarios.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) {
        const meses = [...resumo.meses.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([monthKey, count]) => `${formatMonthLabel(monthKey)} (${count} dia(s))`)
          .join(", ");
        log.push(`✅ ${resumo.nome}: ${meses}`);
      }
      log.push(`Total importado: ${inserted} | Erros: ${skipped}`);

      setImportLog(log);
      toast({ title: `${inserted} registros de ponto importados!` });
      queryClient.invalidateQueries({ queryKey: ["admin-registros-ponto"] });
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ponto" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ponto" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />Espelho de Ponto
          </TabsTrigger>
          <TabsTrigger value="faltas" className="flex items-center gap-1">
            <CalendarX className="h-4 w-4" />Faltas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ponto" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Importar Espelho de Ponto (PDF)</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Faça upload do PDF do espelho de ponto eletrônico (Control iD). O sistema irá identificar cada funcionário pelo CPF e importar as marcações automaticamente.
              </p>
              <div className="flex gap-2">
                <Label htmlFor="ponto-upload" className="cursor-pointer">
                  <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {importing ? "Importando..." : "Importar PDF do Ponto"}
                  </div>
                </Label>
                <Input
                  id="ponto-upload"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleImportEspelhoPonto}
                  disabled={importing}
                />
              </div>
              {importLog.length > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-md text-sm space-y-1 max-h-48 overflow-auto">
                  {importLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Registros de Ponto</CardTitle>
              {selectedPonto.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDeletePonto} disabled={deletingPonto}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deletingPonto ? "Deletando..." : `Deletar ${selectedPonto.size} selecionado(s)`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loadingPonto ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : pontoAgrupado.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum registro de ponto importado ainda.
                </div>
              ) : (
                <Tabs value={selectedFuncionarioPonto} onValueChange={setSelectedFuncionarioPonto} className="space-y-4">
                  <div className="overflow-x-auto pb-2">
                    <TabsList className="h-auto min-w-max">
                      {pontoAgrupado.map((grupo) => (
                        <TabsTrigger key={grupo.cpf} value={grupo.cpf} className="flex min-w-[180px] flex-col items-start gap-0.5 px-4 py-2 text-left">
                          <span className="max-w-full truncate font-medium">{grupo.nome}</span>
                          <span className="text-xs text-muted-foreground">{grupo.meses.length} mês(es) • {grupo.registros.length} dia(s)</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {pontoAgrupado.map((grupo) => (
                    <TabsContent key={grupo.cpf} value={grupo.cpf} className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <div className="font-medium">{grupo.nome}</div>
                        <div className="text-sm text-muted-foreground">CPF {grupo.cpf} • {grupo.meses.length} competência(s) importada(s)</div>
                      </div>

                      <Tabs defaultValue={grupo.meses[0]?.key} className="space-y-4">
                        <div className="overflow-x-auto pb-2">
                          <TabsList className="min-w-max">
                            {grupo.meses.map((mes) => (
                              <TabsTrigger key={mes.key} value={mes.key}>{mes.label}</TabsTrigger>
                            ))}
                          </TabsList>
                        </div>

                        {grupo.meses.map((mes) => {
                          const visibleIds = mes.registros.map((registro) => registro.id);
                          const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedPonto.has(id));

                          return (
                            <TabsContent key={mes.key} value={mes.key}>
                              <div className="overflow-auto rounded-md border">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-10">
                                        <Checkbox
                                          checked={allVisibleSelected}
                                          onCheckedChange={() => toggleAllPonto(visibleIds)}
                                        />
                                      </TableHead>
                                      <TableHead>Data</TableHead>
                                      <TableHead>Ent. 1</TableHead>
                                      <TableHead>Saí. 1</TableHead>
                                      <TableHead>Ent. 2</TableHead>
                                      <TableHead>Saí. 2</TableHead>
                                      <TableHead>Ent. 3</TableHead>
                                      <TableHead>Saí. 3</TableHead>
                                      <TableHead>Duração</TableHead>
                                      <TableHead>Ocorr.</TableHead>
                                      <TableHead>Motivo</TableHead>
                                      <TableHead></TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {mes.registros.map((r: any) => (
                                      <TableRow key={r.id} className={selectedPonto.has(r.id) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                          <Checkbox
                                            checked={selectedPonto.has(r.id)}
                                            onCheckedChange={() => togglePontoSelection(r.id)}
                                          />
                                        </TableCell>
                                        <TableCell>{formatDateBr(String(r.data))}</TableCell>
                                        <TableCell>{r.entrada_1 || "-"}</TableCell>
                                        <TableCell>{r.saida_1 || "-"}</TableCell>
                                        <TableCell>{r.entrada_2 || "-"}</TableCell>
                                        <TableCell>{r.saida_2 || "-"}</TableCell>
                                        <TableCell>{r.entrada_3 || "-"}</TableCell>
                                        <TableCell>{r.saida_3 || "-"}</TableCell>
                                        <TableCell>{r.duracao ? <Badge variant="secondary">{r.duracao}</Badge> : "-"}</TableCell>
                                        <TableCell>{r.ocorrencia || "-"}</TableCell>
                                        <TableCell>{r.motivo || "-"}</TableCell>
                                        <TableCell>
                                          <Button variant="ghost" size="icon" onClick={() => handleDeletePonto(r.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TabsContent>
                          );
                        })}
                      </Tabs>
                    </TabsContent>
                  ))}
                </Tabs>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faltas" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Registrar Falta</CardTitle></CardHeader>
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
                  <Label>Data</Label>
                  <Input type="date" value={dataFalta} onChange={(e) => setDataFalta(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_FALTA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label>Justificativa</Label>
                  <Input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="abonada" checked={abonada} onCheckedChange={(v) => setAbonada(!!v)} />
                  <Label htmlFor="abonada">Abonada</Label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" />{saving ? "Salvando..." : "Adicionar"}
                </Button>
                <Label htmlFor="faltas-upload" className="cursor-pointer">
                  <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />Importar Planilha
                  </div>
                </Label>
                <Input id="faltas-upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUploadPlanilha} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Faltas Registradas</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Justificativa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(faltas || []).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{getNome(f.cpf)}</TableCell>
                        <TableCell>{new Date(f.data_falta).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{f.tipo}</TableCell>
                        <TableCell>{f.justificativa || "-"}</TableCell>
                        <TableCell>
                          {f.abonada ? <Badge variant="secondary">Abonada</Badge> : <Badge variant="destructive">Não abonada</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
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
      </Tabs>
    </div>
  );
}
