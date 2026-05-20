import { useState, useEffect, useCallback } from "react";
import { MessageCircle, ArrowLeft, LogOut } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatContainerProps {
  meuCpf: string;
}

interface ConnStatus {
  connected: boolean;
  email: string | null;
}

export const ChatContainer = ({ meuCpf }: ChatContainerProps) => {
  const [spaceAtivo, setSpaceAtivo] = useState<string | null>(null);
  const [spaceNome, setSpaceNome] = useState<string>("");
  const [conn, setConn] = useState<ConnStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const loadStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("google-chat-proxy", { body: { cpf: meuCpf, op: "status" } });
    if (error) { console.error(error); return; }
    setConn(data as ConnStatus);
  }, [meuCpf]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Detect return from OAuth (?google_chat=ok in URL)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("google_chat") === "ok") {
      url.searchParams.delete("google_chat");
      window.history.replaceState({}, "", url.toString());
      loadStatus();
      toast({ title: "Conta Google conectada" });
    }
  }, [loadStatus, toast]);

  const conectar = async () => {
    setLoading(true);
    try {
      const returnTo = `${window.location.origin}${window.location.pathname}?google_chat=ok`;
      const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { cpf: meuCpf, return_to: returnTo } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url as string;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const desconectar = async () => {
    if (!confirm("Desconectar a conta Google do chat?")) return;
    const { error } = await supabase.functions.invoke("google-chat-proxy", { body: { cpf: meuCpf, op: "disconnect" } });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    setConn({ connected: false, email: null });
    setSpaceAtivo(null);
    toast({ title: "Desconectado" });
  };

  if (conn === null) {
    return <div className="border rounded-lg p-8 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!conn.connected) {
    return (
      <div className="border rounded-lg p-8 flex flex-col items-center justify-center text-center" style={{ minHeight: "400px" }}>
        <MessageCircle className="h-16 w-16 mb-4 text-primary/50" />
        <h2 className="text-xl font-semibold mb-2">Conecte sua conta Google</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Nosso chat agora funciona em cima do Google Chat. Conecte sua conta Google Workspace para ver suas conversas e enviar mensagens com sua identidade real.
        </p>
        <Button onClick={conectar} disabled={loading}>
          {loading ? "Abrindo Google..." : "Conectar com Google"}
        </Button>
      </div>
    );
  }

  const header = (
    <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between text-xs">
      <span className="text-muted-foreground truncate">Conectado: <span className="font-medium text-foreground">{conn.email}</span></span>
      <Button variant="ghost" size="sm" onClick={desconectar} className="h-7 text-xs">
        <LogOut className="h-3 w-3 mr-1" />Desconectar
      </Button>
    </div>
  );

  const handleSelect = (id: string, nome: string) => { setSpaceAtivo(id); setSpaceNome(nome); };

  if (isMobile) {
    return (
      <div className="border rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
        {header}
        <div className="flex-1 overflow-hidden">
          {spaceAtivo ? (
            <div className="h-full flex flex-col">
              <div className="p-2 border-b bg-muted/30">
                <Button variant="ghost" size="sm" onClick={() => setSpaceAtivo(null)}>
                  <ArrowLeft className="h-4 w-4 mr-1" />Voltar
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatWindow cpf={meuCpf} space={spaceAtivo} spaceNome={spaceNome} />
              </div>
            </div>
          ) : (
            <ChatSidebar cpf={meuCpf} spaceAtivo={spaceAtivo} onSelect={handleSelect} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
      {header}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 flex-shrink-0 border-r">
          <ChatSidebar cpf={meuCpf} spaceAtivo={spaceAtivo} onSelect={handleSelect} />
        </div>
        <div className="flex-1">
          {spaceAtivo ? (
            <ChatWindow cpf={meuCpf} space={spaceAtivo} spaceNome={spaceNome} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Google Chat</p>
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
