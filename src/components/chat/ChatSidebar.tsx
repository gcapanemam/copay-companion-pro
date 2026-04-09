import { useState, useEffect } from "react";
import { Plus, Search, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { ChatNovaConversa } from "./ChatNovaConversa";

interface Conversa {
  id: string;
  tipo: string;
  nome: string | null;
  outroNome?: string;
  ultimaMensagem?: string;
  ultimaData?: string;
  naoLidas: number;
}

interface ChatSidebarProps {
  meuCpf: string;
  conversaAtiva: string | null;
  onSelectConversa: (id: string) => void;
}

export const ChatSidebar = ({ meuCpf, conversaAtiva, onSelectConversa }: ChatSidebarProps) => {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);

  const loadConversas = async () => {
    // Get my conversations
    const { data: membros } = await supabase
      .from("chat_membros").select("conversa_id").eq("cpf", meuCpf);
    if (!membros || membros.length === 0) { setConversas([]); return; }

    const ids = membros.map(m => m.conversa_id);
    const { data: convs } = await supabase
      .from("chat_conversas").select("*").in("id", ids).order("created_at", { ascending: false });

    if (!convs) { setConversas([]); return; }

    const result: Conversa[] = [];

    for (const c of convs) {
      let outroNome = c.nome || "";

      if (c.tipo === "individual") {
        const { data: outros } = await supabase
          .from("chat_membros").select("cpf").eq("conversa_id", c.id).neq("cpf", meuCpf);
        if (outros && outros.length > 0) {
          const { data: adm } = await supabase
            .from("admissoes").select("nome_completo").eq("cpf", outros[0].cpf).maybeSingle();
          outroNome = adm?.nome_completo || outros[0].cpf;
        }
      }

      // Last message
      const { data: msgs } = await supabase
        .from("chat_mensagens").select("conteudo, created_at")
        .eq("conversa_id", c.id).order("created_at", { ascending: false }).limit(1);

      // Unread count
      const { data: allMsgs } = await supabase
        .from("chat_mensagens").select("id").eq("conversa_id", c.id).neq("remetente_cpf", meuCpf);
      const msgIds = (allMsgs || []).map(m => m.id);

      let naoLidas = 0;
      if (msgIds.length > 0) {
        const { data: status } = await supabase
          .from("chat_mensagem_status").select("mensagem_id, lido_em")
          .in("mensagem_id", msgIds).eq("cpf", meuCpf);
        const lidosSet = new Set((status || []).filter(s => s.lido_em).map(s => s.mensagem_id));
        naoLidas = msgIds.filter(id => !lidosSet.has(id)).length;
      }

      result.push({
        id: c.id,
        tipo: c.tipo,
        nome: c.nome,
        outroNome,
        ultimaMensagem: msgs?.[0]?.conteudo || "",
        ultimaData: msgs?.[0]?.created_at || c.created_at,
        naoLidas,
      });
    }

    // Sort by last message date
    result.sort((a, b) => new Date(b.ultimaData || "").getTime() - new Date(a.ultimaData || "").getTime());
    setConversas(result);
  };

  useEffect(() => { loadConversas(); }, [meuCpf]);

  // Realtime reload
  useEffect(() => {
    const channel = supabase
      .channel("chat-sidebar")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagens" }, () => loadConversas())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagem_status" }, () => loadConversas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meuCpf]);

  const filtradas = conversas.filter(c => {
    const nome = (c.tipo === "grupo" ? c.nome : c.outroNome) || "";
    return nome.toLowerCase().includes(busca.toLowerCase());
  });

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col border-r">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Conversas</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-8 h-8 text-sm" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filtradas.map(c => {
          const displayName = c.tipo === "grupo" ? c.nome : c.outroNome;
          const isActive = conversaAtiva === c.id;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent border-b ${isActive ? "bg-accent" : ""}`}
              onClick={() => onSelectConversa(c.id)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                {c.tipo === "grupo" ? <Users className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(c.ultimaData)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate">{c.ultimaMensagem}</p>
                  {c.naoLidas > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-[20px] flex items-center justify-center flex-shrink-0">
                      {c.naoLidas}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtradas.length === 0 && (
          <p className="text-center text-sm text-muted-foreground p-4">Nenhuma conversa</p>
        )}
      </ScrollArea>

      <ChatNovaConversa open={novaOpen} onOpenChange={setNovaOpen} meuCpf={meuCpf} onConversaCriada={(id) => onSelectConversa(id)} />
    </div>
  );
};
