import { useState } from "react";
import { UploadArea } from "@/components/UploadArea";
import { TabelaAnual } from "@/components/TabelaAnual";
import { SeletorAno } from "@/components/SeletorAno";
import { Activity, Trash2, LogOut, Heart, FileText, ShieldCheck, Bus, CalendarX, ClipboardList, Users, Megaphone, MessageCircle, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { GerenciarSenhas } from "@/components/GerenciarSenhas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminContracheques } from "@/components/admin/AdminContracheques";
import { AdminEPIs } from "@/components/admin/AdminEPIs";
import { AdminValeTransporte } from "@/components/admin/AdminValeTransporte";
import { AdminFaltas } from "@/components/admin/AdminFaltas";
import { AdminAdmissaoCampos } from "@/components/admin/AdminAdmissaoCampos";
import { AdminFuncionarios } from "@/components/admin/AdminFuncionarios";
import { AdminComunicados } from "@/components/admin/AdminComunicados";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { AdminTarefas } from "@/components/admin/AdminTarefas";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

const BadgeCount = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] rounded-full h-5 min-w-[20px] inline-flex items-center justify-center px-1 font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
};

const Index = () => {
  const [ano, setAno] = useState(2025);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();
  const unreadCounts = useUnreadCounts({ cpf: "admin", isAdmin: true });

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
            <h1 className="text-xl font-bold text-foreground">Portal RH - Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <GerenciarSenhas />
            <Button
              variant="ghost" size="sm"
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
            >
              <LogOut className="h-4 w-4 mr-1" />Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="plano" className="space-y-6">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="plano" className="flex items-center gap-1">
              <Heart className="h-4 w-4" />Plano
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="flex items-center gap-1">
              <Users className="h-4 w-4" />Funcionários
            </TabsTrigger>
            <TabsTrigger value="contracheques" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />Contracheques
            </TabsTrigger>
            <TabsTrigger value="epis" className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" />EPIs
            </TabsTrigger>
            <TabsTrigger value="vt" className="flex items-center gap-1">
              <Bus className="h-4 w-4" />VT
            </TabsTrigger>
            <TabsTrigger value="faltas" className="flex items-center gap-1">
              <CalendarX className="h-4 w-4" />Ponto
            </TabsTrigger>
            <TabsTrigger value="comunicados" className="flex items-center gap-1">
              <Megaphone className="h-4 w-4" />Comunicados
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />Chat<BadgeCount count={unreadCounts.chat} />
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="flex items-center gap-1">
              <ListTodo className="h-4 w-4" />Tarefas<BadgeCount count={unreadCounts.tarefas} />
            </TabsTrigger>
            <TabsTrigger value="admissao" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />Admissão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="plano" className="space-y-6">
            <div className="flex items-center justify-between">
              <SeletorAno ano={ano} onAnoChange={setAno} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-1" />Limpar dados
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todos os dados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá remover todos os titulares, dependentes, mensalidades e coparticipações.
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
            </div>
            <UploadArea onUploadComplete={() => setRefreshKey((k) => k + 1)} />
            <TabelaAnual ano={ano} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="funcionarios">
            <AdminFuncionarios />
          </TabsContent>

          <TabsContent value="contracheques">
            <AdminContracheques />
          </TabsContent>

          <TabsContent value="epis">
            <AdminEPIs />
          </TabsContent>

          <TabsContent value="vt">
            <AdminValeTransporte />
          </TabsContent>

          <TabsContent value="faltas">
            <AdminFaltas />
          </TabsContent>

          <TabsContent value="comunicados">
            <AdminComunicados />
          </TabsContent>

          <TabsContent value="chat">
            <ChatContainer meuCpf="admin" />
          </TabsContent>

          <TabsContent value="tarefas">
            <AdminTarefas />
          </TabsContent>

          <TabsContent value="admissao">
            <AdminAdmissaoCampos />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
