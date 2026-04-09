import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";

interface ChatContainerProps {
  meuCpf: string;
}

export const ChatContainer = ({ meuCpf }: ChatContainerProps) => {
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);

  return (
    <div className="border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
      <div className="flex h-full">
        <div className="w-80 flex-shrink-0">
          <ChatSidebar meuCpf={meuCpf} conversaAtiva={conversaAtiva} onSelectConversa={setConversaAtiva} />
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
