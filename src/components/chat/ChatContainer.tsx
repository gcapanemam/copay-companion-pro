import { useState } from "react";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

interface ChatContainerProps {
  meuCpf: string;
}

export const ChatContainer = ({ meuCpf }: ChatContainerProps) => {
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const handleSelectConversa = (id: string) => {
    setConversaAtiva(id);
  };

  const handleVoltar = () => {
    setConversaAtiva(null);
  };

  if (isMobile) {
    return (
      <div className="border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}>
        {conversaAtiva ? (
          <div className="h-full flex flex-col">
            <div className="p-2 border-b bg-muted/30">
              <Button variant="ghost" size="sm" onClick={handleVoltar}>
                <ArrowLeft className="h-4 w-4 mr-1" />Voltar
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWindow conversaId={conversaAtiva} meuCpf={meuCpf} />
            </div>
          </div>
        ) : (
          <ChatSidebar meuCpf={meuCpf} conversaAtiva={conversaAtiva} onSelectConversa={handleSelectConversa} />
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
      <div className="flex h-full">
        <div className="w-80 flex-shrink-0">
          <ChatSidebar meuCpf={meuCpf} conversaAtiva={conversaAtiva} onSelectConversa={handleSelectConversa} />
        </div>
        <div className="flex-1">
          {conversaAtiva ? (
            <ChatWindow conversaId={conversaAtiva} meuCpf={meuCpf} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Chat Interno</p>
              <p className="text-sm">Selecione uma conversa ou inicie uma nova</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
