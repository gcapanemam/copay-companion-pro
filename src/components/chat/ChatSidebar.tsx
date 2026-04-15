import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Search, Users, User, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { ChatNovaConversa } from "./ChatNovaConversa";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const isAdmin = meuCpf === "admin";

  const loadConversas = useCallback(async () => {
    const { data: membros } = await supabase
      .from("chat_membros").select("conversa_id").eq("cpf", meuCpf);
    if (!membros || membros.length === 0) { setConversas([]); return; }

    const ids = membros.map(m => m.conversa_id);

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

    const outroCpfs = new Set<string>();
    for (const m of allMembros) {
      if (m.cpf !== meuCpf) outroCpfs.add(m.cpf);
    }

    let namesMap: Record<string, string> = {};
    if (outroCpfs.size > 0) {
      const { data: adms } = await supabase
        .from("admissoes").select("cpf, nome_completo").in("cpf", Array.from(outroCpfs));
      (adms || []).forEach(a => { namesMap[a.cpf] = a.nome_completo; });
    }

    const otherMsgIds = allMsgs.filter(m => m.remetente_cpf !== meuCpf).map(m => m.id);

    let statusMap = new Map<string, boolean>();
    if (otherMsgIds.length > 0) {
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

    const result: Conversa[] = convs.map(c => {
      let outroNome = c.nome || "";
      if (c.tipo === "individual") {
        const outro = allMembros.find(m => m.conversa_id === c.id && m.cpf !== meuCpf);
        outroNome = outro ? (namesMap[outro.cpf] || outro.cpf) : "";
      }

      const lastMsg = allMsgs.find(m => m.conversa_id === c.id);
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

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      // Get all message IDs for these conversations
      const { data: msgs } = await supabase
        .from("chat_mensagens").select("id").in("conversa_id", ids);
      const msgIds = (msgs || []).map(m => m.id);

      // Delete in order: statuses -> messages -> members -> conversations
      if (msgIds.length > 0) {
        for (let i = 0; i < msgIds.length; i += 500) {
          const chunk = msgIds.slice(i, i + 500);
          await supabase.from("chat_mensagem_status").delete().in("mensagem_id", chunk);
        }
      }
      await supabase.from("chat_mensagens").delete().in("conversa_id", ids);
      await supabase.from("chat_membros").delete().in("conversa_id", ids);
      await supabase.from("chat_conversas").delete().in("id", ids);

      toast({ title: "Conversas excluídas", description: `${ids.length} conversa(s) removida(s).` });
      setSelected(new Set());
      setSelectMode(false);
      loadConversas();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
          <div className="flex items-center gap-1">
            {isAdmin && (
              selectMode ? (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (selected.size > 0) setConfirmOpen(true); }} disabled={selected.size === 0}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setSelectMode(false); setSelected(new Set()); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setSelectMode(true)} title="Excluir conversas">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNovaOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {selectMode && (
          <p className="text-xs text-muted-foreground">Selecione as conversas para excluir ({selected.size} selecionada{selected.size !== 1 ? "s" : ""})</p>
        )}
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
              onClick={() => selectMode ? toggleSelect(c.id) : onSelectConversa(c.id)}
            >
              {selectMode && (
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} className="flex-shrink-0" />
              )}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversas?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} conversa(s) será(ão) excluída(s) permanentemente, incluindo todas as mensagens. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};