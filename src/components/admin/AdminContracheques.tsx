import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Loader2, FileUp, CheckCircle2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const MESES_NOME = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MESES_MAP: Record<string, number> = {
  "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4, "maio": 5, "junho": 6,
  "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

interface BulkResult {
  page: number;
  nome: string;
  matched: boolean;
  cpf?: string;
  message: string;
}

export function AdminContracheques() {
  const [cpf, setCpf] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracheques, isLoading } = useQuery({
    queryKey: ["admin-contracheques"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracheques").select("*").order("ano", { ascending: false }).order("mes", { ascending: false });
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

  const formatCpf = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 3) return n;
    if (n.length <= 6) return `${n.slice(0,3)}.${n.slice(3)}`;
    if (n.length <= 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`;
    return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`;
  };

  const handleUpload = async () => {
    if (!file || !cpf || !mes || !ano) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const path = `${cleanCpf}/${ano}_${mes.padStart(2, "0")}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("contracheques").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("contracheques").insert({
        cpf: cleanCpf,
        mes: Number(mes),
        ano: Number(ano),
        arquivo_path: path,
        nome_arquivo: file.name,
      });
      if (dbErr) throw dbErr;

      toast({ title: "Contracheque enviado!" });
      setFile(null);
      setCpf("");
      setMes("");
      queryClient.invalidateQueries({ queryKey: ["admin-contracheques"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, path: string) => {
    await supabase.storage.from("contracheques").remove([path]);
    await supabase.from("contracheques").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-contracheques"] });
    toast({ title: "Removido" });
  };

  const extractPageInfo = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<{ nome: string; mes: number; ano: number } | null> => {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];
    
    items.sort((a: any, b: any) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    const lines: string[] = [];
    let lastY = -1;
    let lineText = "";
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== -1 && Math.abs(y - lastY) > 3) {
        lines.push(lineText.trim());
        lineText = "";
      }
      if (lineText && item.str) lineText += " ";
      lineText += item.str;
      lastY = y;
    }
    if (lineText) lines.push(lineText.trim());

    let nome = "";
    let mesNum = 0;
    let anoNum = 0;

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      const line = lines[i].replace(/\s{2,}/g, " ").trim();
      
      // Extract month/year - handles "Mensalista Março de 2026" or "Março de 2026"
      const mesMatch = line.match(/([A-Za-zÀ-ú]+)\s+de\s+(\d{4})/i);
      if (mesMatch && !mesNum) {
        const mesNome = normalize(mesMatch[1]);
        if (MESES_MAP[mesNome]) {
          mesNum = MESES_MAP[mesNome];
          anoNum = parseInt(mesMatch[2]);
        }
      }

      // Name line: starts with code number, then name, then CBO (6-digit), dept, filial
      // e.g. "108 ALESSANDRA DE OLIVEIRA PATRÍCIO FONSECA GUIMARAES 334105 1 1"
      if (line.match(/^C.digo\s+Nome/i) || line.match(/Nome do Funcion/i)) {
        const nextLine = (lines[i + 1] || "").replace(/\s{2,}/g, " ").trim();
        // Match: code + name + CBO(6digits) + numbers
        const nameMatch = nextLine.match(/^\d+\s+(.+?)\s+\d{4,6}\s+\d/);
        if (nameMatch) {
          nome = nameMatch[1].trim();
        } else {
          // Fallback: just take everything after the code, remove trailing numbers
          const fallback = nextLine.match(/^\d+\s+(.+)/);
          if (fallback) {
            nome = fallback[1].replace(/\s+\d+(\s+\d+)*\s*$/, "").trim();
          }
        }
        if (nome) break;
      }
    }

    if (!nome || !mesNum || !anoNum) return null;
    return { nome, mes: mesNum, ano: anoNum };
  };

  const handleBulkUpload = useCallback(async () => {
    if (!bulkFile || !beneficiarios) return;
    setBulkUploading(true);
    setBulkResults([]);

    try {
      const arrayBuffer = await bulkFile.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      // Load with pdf.js for text extraction
      const pdfJs = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
      // Load with pdf-lib for splitting
      const pdfLib = await PDFDocument.load(pdfBytes);
      
      const totalPages = pdfJs.numPages;
      // Each page appears twice (employee copy + employer copy), so we process only odd pages
      // Actually from the parsed doc, each physical page has 2 copies. Let's check if numPages matches.
      // The PDF seems to have 1 page per employee with 2 copies on the same page.
      // So each page = 1 employee.
      
      const results: BulkResult[] = [];
      const seenPages = new Set<string>(); // avoid duplicates from 2 copies per page
      
      setBulkProgress({ current: 0, total: totalPages });

      for (let p = 1; p <= totalPages; p++) {
        setBulkProgress({ current: p, total: totalPages });
        
        const info = await extractPageInfo(pdfJs, p);
        if (!info) {
          results.push({ page: p, nome: "?", matched: false, message: "Não foi possível extrair dados" });
          continue;
        }

        // Deduplicate (same name+mes+ano already processed)
        const key = `${normalize(info.nome)}_${info.mes}_${info.ano}`;
        if (seenPages.has(key)) continue;
        seenPages.add(key);

        // Match name to titular
        const normalizedName = normalize(info.nome);
        const match = beneficiarios.find(b => {
          const bName = normalize(b.nome);
          return bName === normalizedName || bName.includes(normalizedName) || normalizedName.includes(bName);
        });

        if (!match || !match.cpf) {
          results.push({ page: p, nome: info.nome, matched: false, message: "Funcionário não encontrado" });
          continue;
        }

        try {
          // Extract single page as PDF
          const newPdf = await PDFDocument.create();
          const [copiedPage] = await newPdf.copyPages(pdfLib, [p - 1]);
          newPdf.addPage(copiedPage);
          const singlePageBytes = await newPdf.save();

          const cleanCpf = match.cpf.replace(/\D/g, "");
          const mesStr = String(info.mes).padStart(2, "0");
          const path = `${cleanCpf}/${info.ano}_${mesStr}_contracheque.pdf`;
          const fileName = `Contracheque_${MESES_NOME[info.mes - 1]}_${info.ano}.pdf`;

          // Upload to storage
          const { error: uploadErr } = await supabase.storage
            .from("contracheques")
            .upload(path, singlePageBytes, { upsert: true, contentType: "application/pdf" });
          if (uploadErr) throw uploadErr;

          // Check if record already exists
          const { data: existing } = await supabase.from("contracheques")
            .select("id")
            .eq("cpf", cleanCpf)
            .eq("mes", info.mes)
            .eq("ano", info.ano)
            .maybeSingle();

          if (existing) {
            await supabase.from("contracheques").update({ arquivo_path: path, nome_arquivo: fileName }).eq("id", existing.id);
          } else {
            const { error: dbErr } = await supabase.from("contracheques").insert({
              cpf: cleanCpf,
              mes: info.mes,
              ano: info.ano,
              arquivo_path: path,
              nome_arquivo: fileName,
            });
            if (dbErr) throw dbErr;
          }

          results.push({ page: p, nome: info.nome, matched: true, cpf: cleanCpf, message: `${MESES_NOME[info.mes - 1]}/${info.ano}` });
        } catch (err: any) {
          results.push({ page: p, nome: info.nome, matched: false, message: err.message });
        }
      }

      setBulkResults(results);
      const successCount = results.filter(r => r.matched).length;
      toast({
        title: "Processamento concluído",
        description: `${successCount} de ${results.length} contracheque(s) importado(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-contracheques"] });
    } catch (err: any) {
      toast({ title: "Erro ao processar PDF", description: err.message, variant: "destructive" });
    } finally {
      setBulkUploading(false);
    }
  }, [bulkFile, beneficiarios, toast, queryClient]);

  return (
    <div className="space-y-6">
      {/* Bulk Upload */}
      <Card className="border-dashed border-2 border-primary/30">
        <CardHeader><CardTitle className="flex items-center gap-2"><FileUp className="h-5 w-5" /> Importação em Massa (PDF com múltiplos funcionários)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie o PDF completo de recibos de pagamento. O sistema identifica automaticamente cada funcionário pelo nome e separa os contracheques individuais.
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>PDF de Recibos</Label>
              <Input type="file" accept=".pdf" onChange={(e) => { setBulkFile(e.target.files?.[0] || null); setBulkResults([]); }} />
            </div>
            <Button onClick={handleBulkUpload} disabled={bulkUploading || !bulkFile}>
              {bulkUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {bulkUploading ? `Processando ${bulkProgress.current}/${bulkProgress.total}...` : "Processar e Importar"}
            </Button>
          </div>

          {bulkResults.length > 0 && (
            <div className="space-y-1 max-h-60 overflow-y-auto border rounded p-3">
              <p className="text-sm font-medium mb-2">
                <CheckCircle2 className="h-4 w-4 inline text-green-600 mr-1" />
                {bulkResults.filter(r => r.matched).length} importado(s) |
                <AlertCircle className="h-4 w-4 inline text-red-500 mx-1" />
                {bulkResults.filter(r => !r.matched).length} não encontrado(s)
              </p>
              {bulkResults.map((r, i) => (
                <div key={i} className={`text-xs flex justify-between items-center px-3 py-1.5 rounded ${r.matched ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  <span className="truncate mr-2">Pág {r.page}: {r.nome}</span>
                  <span className="shrink-0">{r.matched ? `✓ ${formatCpf(r.cpf!)} - ${r.message}` : r.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Upload */}
      <Card>
        <CardHeader><CardTitle>Upload Individual</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <Label>Funcionário (CPF)</Label>
              <Select value={cpf} onValueChange={setCpf}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(beneficiarios || []).map((b) => (
                    <SelectItem key={b.cpf} value={b.cpf!}>{b.nome} - {formatCpf(b.cpf!)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                <SelectContent>
                  {MESES_NOME.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>PDF</Label>
              <Input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader><CardTitle>Contracheques Cadastrados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contracheques || []).map((c) => {
                  const ben = beneficiarios?.find(b => b.cpf?.replace(/\D/g, "") === c.cpf.replace(/\D/g, ""));
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{ben?.nome || "—"}</TableCell>
                      <TableCell>{formatCpf(c.cpf)}</TableCell>
                      <TableCell>{MESES_NOME[(c.mes || 1) - 1]} / {c.ano}</TableCell>
                      <TableCell>{c.nome_arquivo}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.arquivo_path)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
