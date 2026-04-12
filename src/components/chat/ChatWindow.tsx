import { useState, useEffect, useRef } from "react";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { ChatStatusIcon } from "./ChatStatusIcon";

interface Mensagem {
  id: string;
  remetente_cpf: string;
  remetente_nome?: string;
  conteudo: string;
  created_at: string;
  totalDestinatarios: number;
  recebidos: number;
  lidos: number;
}

interface ChatWindowProps {
  conversaId: string;
  meuCpf: string;
}

export const ChatWindow = ({ conversaId, meuCpf }: ChatWindowProps) => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [conversaInfo, setConversaInfo] = useState<{ tipo: string; nome: string | null; membros: string[] }>({ tipo: "individual", nome: null, membros: [] });
  const [nomesCache, setNomesCache] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversaInfo = async () => {
    const { data: conv } = await supabase.from("chat_conversas").select("*").eq("id", conversaId).single();
    const { data: membros } = await supabase.from("chat_membros").select("cpf").eq("conversa_id", conversaId);
    const cpfs = (membros || []).map(m => m.cpf);
    setConversaInfo({ tipo: conv?.tipo || "individual", nome: conv?.nome || null, membros: cpfs });

    // Load names
    const { data: adms } = await supabase.from("admissoes").select("cpf, nome_completo").in("cpf", cpfs);
    const names: Record<string, string> = {};
    (adms || []).forEach(a => { names[a.cpf] = a.nome_completo; });
    setNomesCache(names);
  };

  const loadMensagens = async () => {
    const { data: msgs } = await supabase
      .from("chat_mensagens").select("*").eq("conversa_id", conversaId).order("created_at", { ascending: true });

    if (!msgs) { setMensagens([]); return; }

    const msgIds = msgs.map(m => m.id);
    const { data: statuses } = msgIds.length > 0
      ? await supabase.from("chat_mensagem_status").select("*").in("mensagem_id", msgIds)
      : { data: [] };

    const membros = conversaInfo.membros.length > 0 ? conversaInfo.membros : [];
    const result: Mensagem[] = msgs.map(m => {
      const destinatarios = membros.filter(cpf => cpf !== m.remetente_cpf);
      const totalDest = destinatarios.length;
      const msgStatuses = (statuses || []).filter(s => s.mensagem_id === m.id);
      const recebidos = msgStatuses.filter(s => s.recebido_em).length;
      const lidos = msgStatuses.filter(s => s.lido_em).length;

      return {
        id: m.id,
        remetente_cpf: m.remetente_cpf,
        remetente_nome: nomesCache[m.remetente_cpf] || m.remetente_cpf,
        conteudo: m.conteudo,
        created_at: m.created_at,
        totalDestinatarios: totalDest,
        recebidos,
        lidos,
      };
    });

    setMensagens(result);

    // Mark as received and read — batch upsert
    const unread = msgs.filter(m => m.remetente_cpf !== meuCpf);
    if (unread.length > 0) {
      const now = new Date().toISOString();
      await supabase.from("chat_mensagem_status").upsert(
        unread.map(m => ({ mensagem_id: m.id, cpf: meuCpf, recebido_em: now, lido_em: now })),
        { onConflict: "mensagem_id,cpf" }
      );
    }
  };

  useEffect(() => { loadConversaInfo(); }, [conversaId]);
  useEffect(() => {
    if (conversaInfo.membros.length > 0) loadMensagens();
  }, [conversaId, conversaInfo.membros.length, Object.keys(nomesCache).length]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_mensagens", filter: `conversa_id=eq.${conversaId}` }, () => loadMensagens())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagem_status" }, () => loadMensagens())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversaId, conversaInfo.membros.length]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens.length]);

  const enviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from("chat_mensagens")
        .insert({ conversa_id: conversaId, remetente_cpf: meuCpf, conteudo: texto.trim() })
        .select()
        .single();
      if (error) throw error;

      // Create status entries for all other members
      const outros = conversaInfo.membros.filter(cpf => cpf !== meuCpf);
      if (outros.length > 0) {
        await supabase.from("chat_mensagem_status").insert(
          outros.map(cpf => ({ mensagem_id: msg.id, cpf }))
        );
      }

      setTexto("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const displayName = conversaInfo.tipo === "grupo"
    ? conversaInfo.nome
    : conversaInfo.membros.filter(c => c !== meuCpf).map(c => nomesCache[c] || c).join(", ");

  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3 bg-card">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          {conversaInfo.tipo === "grupo" ? <Users className="h-5 w-5 text-primary" /> : (
            <span className="text-sm font-bold text-primary">{(displayName || "?").charAt(0)}</span>
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{displayName}</p>
          {conversaInfo.tipo === "grupo" && (
            <p className="text-xs text-muted-foreground">{conversaInfo.membros.length} membros</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
        {mensagens.map(m => {
          const isMine = m.remetente_cpf === meuCpf;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                {conversaInfo.tipo === "grupo" && !isMine && (
                  <p className="text-xs font-semibold mb-1 opacity-80">{m.remetente_nome}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{m.conteudo}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  <span className="text-[10px]">{formatTime(m.created_at)}</span>
                  {isMine && (
                    <ChatStatusIcon
                      totalDestinatarios={m.totalDestinatarios}
                      recebidos={m.recebidos}
                      lidos={m.lidos}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t flex gap-2 bg-card">
        <Input
          placeholder="Digite uma mensagem..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
          className="flex-1"
        />
        <Button size="icon" onClick={enviar} disabled={!texto.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
