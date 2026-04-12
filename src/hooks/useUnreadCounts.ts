import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UnreadCounts {
  comunicados: number;
  chat: number;
  tarefas: number;
}

interface UseUnreadCountsParams {
  cpf: string;
  departamento?: string | null;
  unidade?: string | null;
  isAdmin?: boolean;
}

export const useUnreadCounts = ({ cpf, departamento, unidade, isAdmin }: UseUnreadCountsParams) => {
  const [counts, setCounts] = useState<UnreadCounts>({ comunicados: 0, chat: 0, tarefas: 0 });

  const fetchCounts = useCallback(async () => {
    if (!cpf) return;

    try {
      // --- Comunicados não lidos ---
      let comunicadosCount = 0;
      if (isAdmin) {
        // Admin doesn't need unread comunicados badge
        comunicadosCount = 0;
      } else {
        // Get comunicados destined to this user
        const { data: allComunicados } = await supabase
          .from("comunicados")
          .select("id, tipo_destinatario, valor_destinatario");

        if (allComunicados) {
          const meusComunicados = allComunicados.filter((c) => {
            if (c.tipo_destinatario === "todos") return true;
            if (c.tipo_destinatario === "funcionario" && c.valor_destinatario === cpf) return true;
            if (c.tipo_destinatario === "departamento" && c.valor_destinatario === departamento) return true;
            if (c.tipo_destinatario === "unidade" && c.valor_destinatario === unidade) return true;
            return false;
          });

          if (meusComunicados.length > 0) {
            const { data: leituras } = await supabase
              .from("comunicado_leituras")
              .select("comunicado_id")
              .eq("cpf", cpf)
              .in("comunicado_id", meusComunicados.map((c) => c.id));

            const lidosSet = new Set((leituras || []).map((l) => l.comunicado_id));
            comunicadosCount = meusComunicados.filter((c) => !lidosSet.has(c.id)).length;
          }
        }
      }

      // --- Chat não lido ---
      let chatCount = 0;
      const { data: membros } = await supabase
        .from("chat_membros")
        .select("conversa_id")
        .eq("cpf", cpf);

      if (membros && membros.length > 0) {
        const conversaIds = membros.map((m) => m.conversa_id);
        const { data: msgs } = await supabase
          .from("chat_mensagens")
          .select("id")
          .in("conversa_id", conversaIds)
          .neq("remetente_cpf", cpf);

        if (msgs && msgs.length > 0) {
          const msgIds = msgs.map((m) => m.id);
          const { data: status } = await supabase
            .from("chat_mensagem_status")
            .select("mensagem_id, lido_em")
            .in("mensagem_id", msgIds)
            .eq("cpf", cpf);

          const lidosSet = new Set((status || []).filter((s) => s.lido_em).map((s) => s.mensagem_id));
          chatCount = msgIds.filter((id) => !lidosSet.has(id)).length;
        }
      }

      // --- Tarefas pendentes ---
      let tarefasCount = 0;
      if (isAdmin) {
        // Admin: count tarefas with pending updates (pendencias)
        const { count } = await supabase
          .from("tarefas")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente");
        tarefasCount = count || 0;
      } else {
        // Portal: count tarefas assigned to me that are pendente
        const { data: tarefas } = await supabase
          .from("tarefas")
          .select("id, tipo_destinatario, valor_destinatario, status")
          .in("status", ["pendente", "em_andamento"]);

        if (tarefas) {
          tarefasCount = tarefas.filter((t) => {
            if (t.tipo_destinatario === "funcionario" && t.valor_destinatario === cpf) return true;
            if (t.tipo_destinatario === "departamento" && t.valor_destinatario === departamento) return true;
            if (t.tipo_destinatario === "unidade" && t.valor_destinatario === unidade) return true;
            return false;
          }).length;
        }
      }

      setCounts({ comunicados: comunicadosCount, chat: chatCount, tarefas: tarefasCount });
    } catch (err) {
      console.error("Error fetching unread counts:", err);
    }
  }, [cpf, departamento, unidade, isAdmin]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime subscriptions
  useEffect(() => {
    if (!cpf) return;

    const channel = supabase
      .channel("unread-counts-" + cpf)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagens" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagem_status" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicados" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicado_leituras" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, () => fetchCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefa_atualizacoes" }, () => fetchCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cpf, fetchCounts]);

  return counts;
};
