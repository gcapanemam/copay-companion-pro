import { useState } from "react";
import { UploadArea } from "@/components/UploadArea";
import { TabelaAnual } from "@/components/TabelaAnual";
import { SeletorAno } from "@/components/SeletorAno";
import { Activity, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GerenciarSenhas } from "@/components/GerenciarSenhas";
import { NavLink } from "@/components/NavLink";

const Index = () => {
  const [ano, setAno] = useState(2025);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();

  const handleClearData = async () => {
    setClearing(true);
    try {
      await supabase.from("coparticipacao_itens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("coparticipacoes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("mensalidades").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("dependentes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("titulares").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      toast({ title: "Dados limpos", description: "Todos os dados foram removidos." });
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Controle Plano de Saúde</h1>
          </div>
          <div className="flex items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Limpar dados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todos os dados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover todos os titulares, dependentes, mensalidades e coparticipações. Não é possível desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} disabled={clearing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {clearing ? "Limpando..." : "Sim, limpar tudo"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <SeletorAno ano={ano} onAnoChange={setAno} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <UploadArea onUploadComplete={() => setRefreshKey((k) => k + 1)} />
        <TabelaAnual ano={ano} refreshKey={refreshKey} />
      </main>
    </div>
  );
};

export default Index;
