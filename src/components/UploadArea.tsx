import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    
    // Sort items by y position (descending) then x position (ascending) to maintain layout
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
      if (lineText && item.str) lineText += "  ";
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

export function UploadArea({ onUploadComplete }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ tipo: string; message: string } | null>(null);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Erro", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setLastResult(null);

    try {
      // Extract text client-side using pdf.js
      const text = await extractTextFromPdf(file);
      console.log("Extracted text:", text.substring(0, 500));

      const response = await supabase.functions.invoke("parse-pdf", {
        body: { text, filename: file.name },
      });

      if (response.error) {
        // Try to get error message from response data
        const errorMsg = response.data?.error || response.error.message || "Erro ao processar PDF";
        throw new Error(errorMsg);
      }

      const data = response.data;

      const tipo = data.tipo === "mensalidade" ? "Fatura Mensal" : "Coparticipação";
      const message = data.tipo === "mensalidade"
        ? `${data.beneficiarios_encontrados} beneficiário(s) processado(s) para ${data.mes}/${data.ano}`
        : `${data.usuarios_encontrados} usuário(s), ${data.itens_criados} procedimento(s) para ${data.mes}/${data.ano}`;

      setLastResult({ tipo, message });
      toast({ title: `${tipo} processada`, description: message });
      onUploadComplete();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Erro no upload", description: err.message || "Falha ao processar PDF", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [onUploadComplete, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }, [handleFile]);

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
              <p className="text-sm text-muted-foreground">Processando PDF...</p>
            </>
          ) : lastResult ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="font-medium text-sm">{lastResult.tipo}</p>
              <p className="text-sm text-muted-foreground">{lastResult.message}</p>
              <Button variant="outline" size="sm" onClick={() => setLastResult(null)}>
                Enviar outro arquivo
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium text-sm">Arraste um PDF da Hapvida aqui</p>
                <p className="text-xs text-muted-foreground mt-1">Fatura mensal ou relatório de coparticipação</p>
              </div>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <FileText className="h-4 w-4 mr-1" />
                    Selecionar arquivo
                  </span>
                </Button>
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
              </label>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
