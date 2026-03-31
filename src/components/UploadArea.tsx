import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];
    items.sort((a: any, b: any) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 3) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    let lastY = -1;
    let lineText = "";
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== -1 && Math.abs(y - lastY) > 3) {
        textParts.push(lineText);
        lineText = "";
      }
      if (lineText && item.str) lineText += " ";
      lineText += item.str;
      lastY = y;
    }
    if (lineText) textParts.push(lineText);
    textParts.push("--- PAGE BREAK ---");
  }

  return textParts.join("\n");
}

interface UploadAreaProps {
  onUploadComplete: () => void;
}

interface FileResult {
  filename: string;
  tipo: string;
  message: string;
  success: boolean;
}

export function UploadArea({ onUploadComplete }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<FileResult[]>([]);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File): Promise<FileResult> => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return { filename: file.name, tipo: "", message: "Não é um PDF", success: false };
    }

    try {
      const text = await extractTextFromPdf(file);

      const response = await supabase.functions.invoke("parse-pdf", {
        body: { text, filename: file.name },
      });

      if (response.error) {
        const errorMsg = response.data?.error || response.error.message || "Erro ao processar";
        return { filename: file.name, tipo: "", message: errorMsg, success: false };
      }

      const data = response.data;
      const tipo = data.tipo === "mensalidade" ? "Fatura Mensal" : "Coparticipação";
      const message = data.tipo === "mensalidade"
        ? `${data.beneficiarios_encontrados} beneficiário(s) - ${data.mes}/${data.ano}`
        : `${data.usuarios_encontrados} usuário(s), ${data.itens_criados} procedimento(s) - ${data.mes}/${data.ano}`;

      return { filename: file.name, tipo, message, success: true };
    } catch (err: any) {
      return { filename: file.name, tipo: "", message: err.message || "Erro", success: false };
    }
  }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      toast({ title: "Erro", description: "Nenhum arquivo PDF selecionado.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setResults([]);
    setProgress({ current: 0, total: pdfFiles.length });

    const allResults: FileResult[] = [];
    for (let i = 0; i < pdfFiles.length; i++) {
      setProgress({ current: i + 1, total: pdfFiles.length });
      const result = await processFile(pdfFiles[i]);
      allResults.push(result);
    }

    setResults(allResults);
    setUploading(false);

    const successCount = allResults.filter(r => r.success).length;
    if (successCount > 0) {
      toast({
        title: "Upload concluído",
        description: `${successCount} de ${pdfFiles.length} arquivo(s) processado(s) com sucesso.`,
      });
      onUploadComplete();
    } else {
      toast({ title: "Erro", description: "Nenhum arquivo foi processado com sucesso.", variant: "destructive" });
    }
  }, [processFile, onUploadComplete, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFiles(files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
    e.target.value = "";
  }, [handleFiles]);

  return (
    <Card className="border-dashed border-2 transition-colors hover:border-primary/50">
      <CardContent className="p-6">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-lg p-8 transition-colors ${
            isDragging ? "bg-primary/10" : "bg-muted/30"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Processando {progress.current} de {progress.total} arquivo(s)...
              </p>
            </>
          ) : results.length > 0 ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <p className="font-medium text-sm">
                  {results.filter(r => r.success).length} de {results.length} processado(s)
                </p>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className={`text-xs flex justify-between items-center px-3 py-1.5 rounded ${r.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                    <span className="truncate mr-2">{r.filename}</span>
                    <span className="shrink-0">{r.success ? r.tipo : r.message}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setResults([])}>
                  Enviar mais arquivos
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">Arraste PDFs da Hapvida aqui</p>
                <p className="text-xs text-muted-foreground mt-1">Faturas mensais e/ou relatórios de coparticipação (múltiplos arquivos)</p>
              </div>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <FileText className="h-4 w-4 mr-1" />
                    Selecionar arquivos
                  </span>
                </Button>
                <input type="file" accept=".pdf" multiple className="hidden" onChange={handleFileInput} />
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
