import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  cpf: string;
  nome: string;
}

interface ChatNovaConversaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meuCpf: string;
  onConversaCriada: (conversaId: string) => void;
}

export const ChatNovaConversa = ({ open, onOpenChange, meuCpf, onConversaCriada }: ChatNovaConversaProps) => {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadFuncionarios();
      setSelecionados([]);
      setNomeGrupo("");
      setBusca("");
    }
  }, [open]);

  const loadFuncionarios = async () => {
    const { data } = await supabase.from("admissoes").select("cpf, nome_completo").order("nome_completo");
    setFuncionarios((data || []).filter(f => f.cpf !== meuCpf).map(f => ({ cpf: f.cpf, nome: f.nome_completo })));
  };

  const toggleSelecionado = (cpf: string) => {
    setSelecionados(prev => prev.includes(cpf) ? prev.filter(c => c !== cpf) : [...prev, cpf]);
  };

  const filtrados = funcionarios.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) || f.cpf.includes(busca.replace(/\D/g, ""))
  );

  const criarConversa = async (tipo: "individual" | "grupo") => {
    if (selecionados.length === 0) return;
    if (tipo === "grupo" && !nomeGrupo.trim()) {
      toast({ title: "Erro", description: "Informe o nome do grupo", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // For individual, check if conversation already exists
      if (tipo === "individual" && selecionados.length === 1) {
        const outroCpf = selecionados[0];
        const { data: minhasConversas } = await supabase
          .from("chat_membros").select("conversa_id").eq("cpf", meuCpf);
        const { data: outrasConversas } = await supabase
          .from("chat_membros").select("conversa_id").eq("cpf", outroCpf);

        if (minhasConversas && outrasConversas) {
          const minhasIds = new Set(minhasConversas.map(c => c.conversa_id));
          const comuns = outrasConversas.filter(c => minhasIds.has(c.conversa_id)).map(c => c.conversa_id);

          for (const cid of comuns) {
            const { data: conv } = await supabase.from("chat_conversas").select("tipo").eq("id", cid).single();
            if (conv?.tipo === "individual") {
              onConversaCriada(cid);
              onOpenChange(false);
              setLoading(false);
              return;
            }
          }
        }
      }

      const { data: conv, error } = await supabase
        .from("chat_conversas")
        .insert({ tipo, nome: tipo === "grupo" ? nomeGrupo.trim() : null, criado_por: meuCpf })
        .select()
        .single();
      if (error) throw error;

      const membros = [meuCpf, ...selecionados].map(cpf => ({ conversa_id: conv.id, cpf }));
      await supabase.from("chat_membros").insert(membros);

      onConversaCriada(conv.id);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Conversa</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="individual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual</TabsTrigger>
            <TabsTrigger value="grupo">Grupo</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-3">
            <Input placeholder="Buscar funcionário..." value={busca} onChange={e => setBusca(e.target.value)} />
            <ScrollArea className="h-60 border rounded-md p-2">
              {filtrados.map(f => (
                <div
                  key={f.cpf}
                  className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent ${selecionados.includes(f.cpf) ? "bg-accent" : ""}`}
                  onClick={() => setSelecionados([f.cpf])}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {f.nome.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">{f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</p>
                  </div>
                </div>
              ))}
            </ScrollArea>
            <DialogFooter>
              <Button onClick={() => criarConversa("individual")} disabled={selecionados.length !== 1 || loading}>
                {loading ? "Criando..." : "Iniciar Conversa"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="grupo" className="space-y-3">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input placeholder="Nome do grupo" value={nomeGrupo} onChange={e => setNomeGrupo(e.target.value)} />
            </div>
            <Input placeholder="Buscar funcionário..." value={busca} onChange={e => setBusca(e.target.value)} />
            <ScrollArea className="h-48 border rounded-md p-2">
              {filtrados.map(f => (
                <div key={f.cpf} className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent" onClick={() => toggleSelecionado(f.cpf)}>
                  <Checkbox checked={selecionados.includes(f.cpf)} />
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {f.nome.charAt(0)}
                  </div>
                  <p className="text-sm font-medium">{f.nome}</p>
                </div>
              ))}
            </ScrollArea>
            {selecionados.length > 0 && (
              <p className="text-xs text-muted-foreground">{selecionados.length} selecionado(s)</p>
            )}
            <DialogFooter>
              <Button onClick={() => criarConversa("grupo")} disabled={selecionados.length === 0 || !nomeGrupo.trim() || loading}>
                {loading ? "Criando..." : "Criar Grupo"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
