import { useState } from "react";
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

async function parsePontoPdf(file: File): Promise<PontoRecord[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const records: PontoRecord[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as any[];

    // Collect all text items with positions
    const textItems = items.map(item => ({
      text: item.str as string,
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
    })).filter(t => t.text.trim());

    // Group by Y (lines) with tolerance
    const lineMap = new Map<number, typeof textItems>();
    for (const item of textItems) {
      let foundY = -1;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - item.y) <= 3) { foundY = key; break; }
      }
      const useY = foundY >= 0 ? foundY : item.y;
      if (!lineMap.has(useY)) lineMap.set(useY, []);
      lineMap.get(useY)!.push(item);
    }

    // Sort lines top to bottom, items left to right
    const lines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x));

    // Find NOME and CPF from header
    let nome = "";
    let cpfVal = "";
    for (const line of lines) {
      const lineText = line.map(i => i.text).join(" ");
      const nomeMatch = lineText.match(/NOME:\s*(.+?)(?:\s{2,}|PIS|$)/i);
      if (nomeMatch) nome = nomeMatch[1].trim();
      const cpfMatch = lineText.match(/CPF:\s*(\d[\d.\-/]+\d)/i);
      if (cpfMatch) cpfVal = cpfMatch[1].replace(/\D/g, "");
    }

    if (!cpfVal) continue;

    // Find the header row to determine column X positions
    let colPositions: { ent1: number; sai1: number; ent2: number; sai2: number; ent3: number; sai3: number; duracao: number } | null = null;
    for (const line of lines) {
      const hasEnt1 = line.find(i => /ENT\.\s*1/i.test(i.text));
      const hasSai1 = line.find(i => /SA[ÍI]\.\s*1/i.test(i.text));
      if (hasEnt1 && hasSai1) {
        const ent2 = line.find(i => /ENT\.\s*2/i.test(i.text));
        const sai2 = line.find(i => /SA[ÍI]\.\s*2/i.test(i.text));
        const ent3 = line.find(i => /ENT\.\s*3/i.test(i.text));
        const sai3 = line.find(i => /SA[ÍI]\.\s*3/i.test(i.text));
        const dur = line.find(i => /DURA/i.test(i.text));
        colPositions = {
          ent1: hasEnt1.x,
          sai1: hasSai1.x,
          ent2: ent2?.x ?? hasSai1.x + 50,
          sai2: sai2?.x ?? hasSai1.x + 100,
          ent3: ent3?.x ?? hasSai1.x + 150,
          sai3: sai3?.x ?? hasSai1.x + 200,
          duracao: dur?.x ?? hasSai1.x + 250,
        };
        break;
      }
    }

    if (!colPositions) continue;

    // Parse day rows
    for (const line of lines) {
      const lineText = line.map(i => i.text).join(" ");
      const dayMatch = lineText.match(/(\d{2}\/\d{2}\/\d{2})\s*-\s*(SEG|TER|QUA|QUI|SEX|SAB|DOM|FER)/i);
      if (!dayMatch) continue;

      const parts = dayMatch[1].split("/");
      let year = parseInt(parts[2]);
      if (year < 100) year += 2000;
      const fullDate = `${year}-${parts[1]}-${parts[0]}`;

      // Find time values by matching to closest column X position
      const timeItems = line.filter(i => /^\d{2}:\d{2}$/.test(i.text.trim()));

      const findClosest = (targetX: number, tolerance = 30): string | null => {
        let best: typeof textItems[0] | null = null;
        let bestDist = tolerance;
        for (const item of timeItems) {
          const dist = Math.abs(item.x - targetX);
          if (dist < bestDist) { bestDist = dist; best = item; }
        }
        return best?.text || null;
      };

      const entrada_1 = findClosest(colPositions.ent1);
      const saida_1 = findClosest(colPositions.sai1);
      const entrada_2 = findClosest(colPositions.ent2);
      const saida_2 = findClosest(colPositions.sai2);
      const entrada_3 = findClosest(colPositions.ent3);
      const saida_3 = findClosest(colPositions.sai3);
      const duracao = findClosest(colPositions.duracao);

      // Skip days with no data at all
      if (!entrada_1 && !saida_1 && !duracao) continue;

      records.push({
        cpf: cpfVal,
        nome,
        data: fullDate,
        entrada_1,
        saida_1,
        entrada_2,
        saida_2,
        entrada_3,
        saida_3,
        duracao,
        ocorrencia: null,
        motivo: null,
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
      const { data, error } = await supabase.from("registros_ponto").select("*").order("data", { ascending: false }).limit(200);
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

  const getNome = (cpfVal: string) => (beneficiarios || []).find(x => x.cpf?.replace(/\D/g, "") === cpfVal)?.nome || cpfVal;

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
    queryClient.invalidateQueries({ queryKey: ["admin-registros-ponto"] });
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
      const uniqueEmployees = new Set(records.map(r => r.nome));
      log.push(`Encontrados ${records.length} registros de ${uniqueEmployees.size} funcionário(s)`);

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

      for (const nome of uniqueEmployees) {
        const count = records.filter(r => r.nome === nome).length;
        log.push(`✅ ${nome}: ${count} dias`);
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
            <CardHeader><CardTitle>Registros de Ponto</CardTitle></CardHeader>
            <CardContent>
              {loadingPonto ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Funcionário</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ent. 1</TableHead>
                        <TableHead>Saí. 1</TableHead>
                        <TableHead>Ent. 2</TableHead>
                        <TableHead>Saí. 2</TableHead>
                        <TableHead>Ent. 3</TableHead>
                        <TableHead>Saí. 3</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(registrosPonto || []).map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{getNome(r.cpf)}</TableCell>
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
