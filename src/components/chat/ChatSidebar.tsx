import { useState, useEffect, useCallback } from "react";
import { Search, Users, User, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";

interface Space {
  name: string;
  displayName: string;
  spaceType?: string;
  singleUserBotDm?: boolean;
}

interface ChatSidebarProps {
  cpf: string;
  spaceAtivo: string | null;
  onSelect: (spaceName: string, displayName: string) => void;
}

interface ListSpacesResponse {
  spaces?: Array<{
    name: string;
    displayName?: string;
    spaceType?: string;
    type?: string;
    singleUserBotDm?: boolean;
  }>;
}

export const ChatSidebar = ({ cpf, spaceAtivo, onSelect }: ChatSidebarProps) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("google-chat-proxy", {
        body: { cpf, op: "listSpaces" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const resp = data?.data as ListSpacesResponse;
      const list: Space[] = (resp?.spaces || []).map((s) => ({
        name: s.name,
        displayName: s.displayName || (s.spaceType === "DIRECT_MESSAGE" || s.singleUserBotDm ? "Mensagem direta" : s.name),
        spaceType: s.spaceType || s.type,
        singleUserBotDm: s.singleUserBotDm,
      }));
      setSpaces(list);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [cpf]);

  useEffect(() => { load(); }, [load]);

  const filtradas = spaces.filter((s) => s.displayName.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Conversas</h3>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-8 h-8 text-sm" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {erro && (
          <div className="p-3 text-xs text-destructive">{erro}</div>
        )}
        {!erro && filtradas.length === 0 && !loading && (
          <p className="text-center text-sm text-muted-foreground p-4">
            Nenhuma conversa. Crie um space ou inicie uma DM no Google Chat e atualize.
          </p>
        )}
        {filtradas.map((s) => {
          const isAtivo = s.name === spaceAtivo;
          const isGrupo = s.spaceType === "SPACE" || (!s.singleUserBotDm && s.spaceType !== "DIRECT_MESSAGE");
          return (
            <div
              key={s.name}
              className={`flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent border-b ${isAtivo ? "bg-accent" : ""}`}
              onClick={() => onSelect(s.name, s.displayName)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                {isGrupo ? <Users className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{isGrupo ? "Space" : "Mensagem direta"}</p>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
};
