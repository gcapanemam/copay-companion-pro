import { useState, useEffect, useCallback, useRef } from "react";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!cpf) return;

    try {
      // Run all three counts in parallel
      const [comunicadosCount, chatCount, tarefasCount] = await Promise.all([
        fetchComunicados(cpf, departamento, unidade, isAdmin),
        fetchChat(cpf),
        fetchTarefas(cpf, departamento, unidade, isAdmin),
      ]);

      setCounts({ comunicados: comunicadosCount, chat: chatCount, tarefas: tarefasCount });
    } catch (err) {
      console.error("Error fetching unread counts:", err);
    }
  }, [cpf, departamento, unidade, isAdmin]);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCounts(), 500);
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Realtime subscriptions with debounce
  useEffect(() => {
    if (!cpf) return;

    const channel = supabase
      .channel("unread-counts-" + cpf)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagens" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensagem_status" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicados" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicado_leituras" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefas" }, debouncedFetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tarefa_atualizacoes" }, debouncedFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [cpf, debouncedFetch]);

  return counts;
};

async function fetchComunicados(cpf: string, departamento?: string | null, unidade?: string | null, isAdmin?: boolean): Promise<number> {
  if (isAdmin) return 0;

  const { data: allComunicados } = await supabase
    .from("comunicados")
    .select("id, tipo_destinatario, valor_destinatario");

  if (!allComunicados) return 0;

  const meus = allComunicados.filter((c) => {
    if (c.tipo_destinatario === "todos") return true;
    if (c.tipo_destinatario === "funcionario" && c.valor_destinatario === cpf) return true;
    if (c.tipo_destinatario === "departamento" && c.valor_destinatario === departamento) return true;
    if (c.tipo_destinatario === "unidade" && c.valor_destinatario === unidade) return true;
    return false;
  });

  if (meus.length === 0) return 0;

  const { data: leituras } = await supabase
    .from("comunicado_leituras")
    .select("comunicado_id")
    .eq("cpf", cpf)
    .in("comunicado_id", meus.map((c) => c.id));

  const lidosSet = new Set((leituras || []).map((l) => l.comunicado_id));
  return meus.filter((c) => !lidosSet.has(c.id)).length;
}

async function fetchChat(cpf: string): Promise<number> {
  const { data: membros } = await supabase
    .from("chat_membros")
    .select("conversa_id")
    .eq("cpf", cpf);

  if (!membros || membros.length === 0) return 0;

  const conversaIds = membros.map((m) => m.conversa_id);
  const { data: msgs } = await supabase
    .from("chat_mensagens")
    .select("id")
    .in("conversa_id", conversaIds)
    .neq("remetente_cpf", cpf);

  if (!msgs || msgs.length === 0) return 0;

  const msgIds = msgs.map((m) => m.id);
  const { data: status } = await supabase
    .from("chat_mensagem_status")
    .select("mensagem_id, lido_em")
    .in("mensagem_id", msgIds)
    .eq("cpf", cpf);

  const lidosSet = new Set((status || []).filter((s) => s.lido_em).map((s) => s.mensagem_id));
  return msgIds.filter((id) => !lidosSet.has(id)).length;
}

async function fetchTarefas(cpf: string, departamento?: string | null, unidade?: string | null, isAdmin?: boolean): Promise<number> {
  if (isAdmin) {
    const { count } = await supabase
      .from("tarefas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    return count || 0;
  }

  const { data: tarefas } = await supabase
    .from("tarefas")
    .select("id, tipo_destinatario, valor_destinatario, status")
    .in("status", ["pendente", "em_andamento"]);

  if (!tarefas) return 0;

  return tarefas.filter((t) => {
    if (t.tipo_destinatario === "funcionario" && t.valor_destinatario === cpf) return true;
    if (t.tipo_destinatario === "departamento" && t.valor_destinatario === departamento) return true;
    if (t.tipo_destinatario === "unidade" && t.valor_destinatario === unidade) return true;
    return false;
  }).length;
}
