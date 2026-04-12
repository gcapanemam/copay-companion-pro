import { useState, useEffect, useRef, useCallback } from "react";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConversas = useCallback(async () => {
    // 1. Get my conversation IDs
    const { data: membros } = await supabase
      .from("chat_membros").select("conversa_id").eq("cpf", meuCpf);
    if (!membros || membros.length === 0) { setConversas([]); return; }

    const ids = membros.map(m => m.conversa_id);

    // 2. Batch: get all conversations, all members, all last messages, all statuses
    const [convsRes, allMembrosRes, allMsgsRes] = await Promise.all([
      supabase.from("chat_conversas").select("*").in("id", ids),
      supabase.from("chat_membros").select("conversa_id, cpf").in("conversa_id", ids),
      supabase.from("chat_mensagens").select("id, conversa_id, conteudo, created_at, remetente_cpf")
        .in("conversa_id", ids).order("created_at", { ascending: false }),
    ]);

    const convs = convsRes.data || [];
    const allMembros = allMembrosRes.data || [];
    const allMsgs = allMsgsRes.data || [];

    if (convs.length === 0) { setConversas([]); return; }

    // 3. Get unique other CPFs for individual chats
    const outroCpfs = new Set<string>();
    for (const m of allMembros) {
      if (m.cpf !== meuCpf) outroCpfs.add(m.cpf);
    }

    // 4. Batch: get names for all other members
    let namesMap: Record<string, string> = {};
    if (outroCpfs.size > 0) {
      const { data: adms } = await supabase
        .from("admissoes").select("cpf, nome_completo").in("cpf", Array.from(outroCpfs));
      (adms || []).forEach(a => { namesMap[a.cpf] = a.nome_completo; });
    }

    // 5. Get IDs of messages from others (for unread count)
    const otherMsgIds = allMsgs.filter(m => m.remetente_cpf !== meuCpf).map(m => m.id);

    // 6. Batch: get read statuses for all those messages
    let statusMap = new Map<string, boolean>();
    if (otherMsgIds.length > 0) {
      // Supabase .in() has a limit, chunk if needed
      const chunks = [];
      for (let i = 0; i < otherMsgIds.length; i += 500) {
        chunks.push(otherMsgIds.slice(i, i + 500));
      }
      const statusResults = await Promise.all(
        chunks.map(chunk =>
          supabase.from("chat_mensagem_status").select("mensagem_id, lido_em")
            .in("mensagem_id", chunk).eq("cpf", meuCpf)
        )
      );
      for (const res of statusResults) {
        (res.data || []).forEach(s => {
          if (s.lido_em) statusMap.set(s.mensagem_id, true);
        });
      }
    }

    // 7. Build result
    const result: Conversa[] = convs.map(c => {
      let outroNome = c.nome || "";
      if (c.tipo === "individual") {
        const outro = allMembros.find(m => m.conversa_id === c.id && m.cpf !== meuCpf);
        outroNome = outro ? (namesMap[outro.cpf] || outro.cpf) : "";
      }

      // Last message for this conversation
      const lastMsg = allMsgs.find(m => m.conversa_id === c.id);

      // Unread count for this conversation
      const convOtherMsgs = allMsgs.filter(m => m.conversa_id === c.id && m.remetente_cpf !== meuCpf);
      const naoLidas = convOtherMsgs.filter(m => !statusMap.has(m.id)).length;

      return {
        id: c.id,
        tipo: c.tipo,
        nome: c.nome,
        outroNome,
        ultimaMensagem: lastMsg?.conteudo || "",
        ultimaData: lastMsg?.created_at || c.created_at,
        naoLidas,
      };
    });

    result.sort((a, b) => new Date(b.ultimaData || "").getTime() - new Date(a.ultimaData || "").getTime());
    setConversas(result);
  }, [meuCpf]);

  const debouncedLoad = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadConversas(), 300);
  }, [loadConversas]);

  useEffect(() => { loadConversas(); }, [meuCpf]);

  // Realtime reload with debounce
  useEffect(() => {
    const channel = supabase
      .channel("chat-sidebar-" + meuCpf)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagens" }, debouncedLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagem_status" }, debouncedLoad)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [meuCpf, debouncedLoad]);

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
