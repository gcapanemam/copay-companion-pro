import { Check, CheckCheck } from "lucide-react";

interface ChatStatusIconProps {
  totalDestinatarios: number;
  recebidos: number;
  lidos: number;
}

export const ChatStatusIcon = ({ totalDestinatarios, recebidos, lidos }: ChatStatusIconProps) => {
  if (totalDestinatarios === 0) return null;

  // All read → blue double check
  if (lidos >= totalDestinatarios) {
    return <CheckCheck className="h-4 w-4 text-blue-500 inline-block" />;
  }

  // All received → gray double check
  if (recebidos >= totalDestinatarios) {
    return <CheckCheck className="h-4 w-4 text-muted-foreground inline-block" />;
  }

  // Sent only → single gray check
  return <Check className="h-4 w-4 text-muted-foreground inline-block" />;
};
