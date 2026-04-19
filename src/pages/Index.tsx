import { useState } from "react";
import { UploadArea } from "@/components/UploadArea";
import { TabelaAnual } from "@/components/TabelaAnual";
import { SeletorAno } from "@/components/SeletorAno";
import {
  Activity, Trash2, LogOut, Heart, FileText, ShieldCheck, Bus,
  CalendarX, ClipboardList, Users, Megaphone, MessageCircle,
  ListTodo, Settings, LayoutDashboard, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { AdminContracheques } from "@/components/admin/AdminContracheques";
import { AdminEPIs } from "@/components/admin/AdminEPIs";
import { AdminValeTransporte } from "@/components/admin/AdminValeTransporte";
import { AdminFaltas } from "@/components/admin/AdminFaltas";
import { AdminAdmissaoCampos } from "@/components/admin/AdminAdmissaoCampos";
import { AdminFuncionarios } from "@/components/admin/AdminFuncionarios";
import { AdminComunicados } from "@/components/admin/AdminComunicados";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { AdminTarefas } from "@/components/admin/AdminTarefas";
import { AdminConfiguracoes } from "@/components/admin/AdminConfiguracoes";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminPontoEletronico } from "@/components/admin/AdminPontoEletronico";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import {
  SidebarProvider, SidebarTrigger,
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const BadgeCount = ({ count }: { count: number }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] rounded-full h-5 min-w-[20px] inline-flex items-center justify-center px-1 font-bold">
      {count > 99 ? "99+" : count}
    </span>
  );
};

type Section =
  | "dashboard" | "funcionarios" | "contracheques" | "vt" | "faltas" | "ponto_eletronico"
  | "plano" | "epis" | "comunicados" | "chat" | "tarefas" | "admissao" | "configuracoes";

const navGroups = [
  {
    label: "Geral",
    items: [
      { id: "dashboard" as Section, label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { id: "funcionarios" as Section, label: "Funcionários", icon: Users },
      { id: "admissao" as Section, label: "Admissão", icon: ClipboardList },
    ],
  },
  {
    label: "Documentos",
    items: [
      { id: "contracheques" as Section, label: "Contracheques", icon: FileText },
      { id: "vt" as Section, label: "Vale Transporte", icon: Bus },
      { id: "faltas" as Section, label: "Ponto", icon: CalendarX },
      { id: "ponto_eletronico" as Section, label: "Ponto Eletrônico", icon: Clock },
    ],
  },
  {
    label: "Benefícios",
    items: [
      { id: "plano" as Section, label: "Plano de Saúde", icon: Heart },
      { id: "epis" as Section, label: "EPIs", icon: ShieldCheck },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { id: "comunicados" as Section, label: "Comunicados", icon: Megaphone },
      { id: "chat" as Section, label: "Chat", icon: MessageCircle, badge: "chat" as const },
      { id: "tarefas" as Section, label: "Tarefas", icon: ListTodo, badge: "tarefas" as const },
    ],
  },
  {
    label: "Sistema",
    items: [
      { id: "configuracoes" as Section, label: "Configurações", icon: Settings },
    ],
  },
];

function AdminSidebar({ active, onNavigate, unreadCounts }: { active: Section; onNavigate: (s: Section) => void; unreadCounts: any }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={active === item.id}
                      onClick={() => onNavigate(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                      {!collapsed && item.badge && <BadgeCount count={unreadCounts[item.badge] ?? 0} />}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-sidebar-primary" />
            <span className="text-xs font-semibold text-sidebar-foreground">Portal RH</span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

const Index = () => {
  const [section, setSection] = useState<Section>("dashboard");
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

  const renderContent = () => {
    switch (section) {
      case "dashboard": return <AdminDashboard />;
      case "funcionarios": return <AdminFuncionarios />;
      case "contracheques": return <AdminContracheques />;
      case "vt": return <AdminValeTransporte />;
      case "faltas": return <AdminFaltas />;
      case "ponto_eletronico": return <AdminPontoEletronico />;
      case "plano":
        return (
          <div className="space-y-6">
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
          </div>
        );
      case "epis": return <AdminEPIs />;
      case "comunicados": return <AdminComunicados />;
      case "chat": return <ChatContainer meuCpf="admin" />;
      case "tarefas": return <AdminTarefas />;
      case "admissao": return <AdminAdmissaoCampos />;
      case "configuracoes": return <AdminConfiguracoes />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar active={section} onNavigate={setSection} unreadCounts={unreadCounts} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">Portal RH - Admin</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm"
                onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
              >
                <LogOut className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 md:p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
