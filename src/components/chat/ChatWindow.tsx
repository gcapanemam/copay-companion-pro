import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Mensagem {
  name: string;
  text: string;
  createTime: string;
  senderName: string;
  senderDisplayName?: string;
}

interface ChatWindowProps {
  cpf: string;
  space: string;
  spaceNome: string;
}

interface ListMessagesResponse {
  messages?: Array<{
    name: string;
    text?: string;
    createTime?: string;
    sender?: { name?: string; displayName?: string; type?: string };
  }>;
}

const POLL_MS = 5000;

export const ChatWindow = ({ cpf, space, spaceNome }: ChatWindowProps) => {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [meuSenderName, setMeuSenderName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("google-chat-proxy", {
        body: { cpf, op: "listMessages", space },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resp = data?.data as ListMessagesResponse;
      const list: Mensagem[] = (resp?.messages || []).map((m) => ({
        name: m.name,
        text: m.text || "",
        createTime: m.createTime || "",
        senderName: m.sender?.name || "",
        senderDisplayName: m.sender?.displayName,
      }));
      // API returns desc; show asc
      list.reverse();
      setMensagens(list);
    } catch (err) {
      console.error(err);
    }
  }, [cpf, space]);

  // Pega "users/me" identity guessing: first message from us sets it; alt fallback by email match
  useEffect(() => { setMensagens([]); setMeuSenderName(null); }, [space]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensagens.length]);

  const enviar = async () => {
    if (!texto.trim() || sending) return;
    setSending(true);
    const t = texto.trim();
    setTexto("");
    try {
      const { data, error } = await supabase.functions.invoke("google-chat-proxy", {
        body: { cpf, op: "sendMessage", space, text: t },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Track our sender name so we can right-align our messages
      const senderName = (data?.data as { sender?: { name?: string } })?.sender?.name;
      if (senderName && !meuSenderName) setMeuSenderName(senderName);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Erro ao enviar", description: msg, variant: "destructive" });
      setTexto(t);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b flex items-center gap-3 bg-card">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">{spaceNome}</p>
          <p className="text-xs text-muted-foreground">Google Chat</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30">
        {mensagens.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda.</p>
        )}
        {mensagens.map((m) => {
          const isMine = !!meuSenderName && m.senderName === meuSenderName;
          return (
            <div key={m.name} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                {!isMine && m.senderDisplayName && (
                  <p className="text-xs font-semibold mb-1 opacity-80">{m.senderDisplayName}</p>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                <div className={`flex justify-end mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  <span className="text-[10px]">{formatTime(m.createTime)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t flex gap-2 bg-card">
        <Input
          placeholder="Digite uma mensagem..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && enviar()}
          className="flex-1"
          disabled={sending}
        />
        <Button size="icon" onClick={enviar} disabled={!texto.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
