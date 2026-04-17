// Edge function pública: recebe requisições do REP Control iD via modo Push
// Suporta:
//  - GET  /push?deviceId=...&uuid=...     → entrega comando pendente ou vazio
//  - POST /result?deviceId=...&uuid=...   → recebe resultado de comando executado
//  - POST /marcacao  (custom)             → REP-C de ponto envia marcação direto
//
// Como não dá pra criar várias rotas em uma edge function, despachamos pelo
// path no final da URL e/ou pelo body. O relógio será configurado para apontar
// para esta URL única (ex: .../controlid-push?action=push).
//
// Esta função é PÚBLICA (verify_jwt=false) — o relógio não envia JWT.
// Validação: usamos device_id_externo do equipamento + token opcional.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emptyResponse() {
  // Uma resposta vazia diz ao relógio "não tenho nada pra você fazer"
  return new Response("", {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getEquipamentoByDeviceId(deviceId: string | null) {
  if (!deviceId) return null;
  const { data } = await supabase
    .from("equipamentos_ponto")
    .select("id, nome, ativo")
    .eq("device_id_externo", deviceId)
    .maybeSingle();
  return data;
}

async function logRequest(args: {
  equipamento_id: string | null;
  device_id_externo: string | null;
  tipo: string;
  metodo: string;
  query: Record<string, string>;
  body: unknown;
  resposta: unknown;
  ip: string | null;
  user_agent: string | null;
}) {
  try {
    await supabase.from("controlid_push_log").insert({
      equipamento_id: args.equipamento_id,
      device_id_externo: args.device_id_externo,
      tipo: args.tipo,
      metodo: args.metodo,
      query: args.query,
      body: args.body as any,
      resposta: args.resposta as any,
      ip: args.ip,
      user_agent: args.user_agent,
    });
  } catch (e) {
    console.error("falha ao gravar log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));

  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip");
  const ua = req.headers.get("user-agent");

  // Roteamento simples por ?action= (push | result | marcacao). Default = push.
  const action = (query.action || (req.method === "GET" ? "push" : "result")).toLowerCase();
  const deviceId = query.deviceId || query.deviceid || null;
  const uuid = query.uuid || null;
  const equipamento = await getEquipamentoByDeviceId(deviceId);

  // ------------------- GET /push -------------------
  if (action === "push") {
    // Procura o comando pendente mais antigo desse equipamento
    let resposta: any = null;
    if (equipamento?.id) {
      const { data: cmds } = await supabase
        .from("controlid_comandos")
        .select("*")
        .eq("equipamento_id", equipamento.id)
        .eq("status", "pendente")
        .order("created_at", { ascending: true })
        .limit(5);

      if (cmds && cmds.length === 1) {
        const c = cmds[0];
        resposta = {
          verb: c.verb,
          endpoint: c.endpoint,
          body: c.body,
          contentType: c.content_type,
          ...(c.query_string ? { queryString: c.query_string } : {}),
        };
        await supabase
          .from("controlid_comandos")
          .update({ status: "enviado", enviado_em: new Date().toISOString(), uuid })
          .eq("id", c.id);
      } else if (cmds && cmds.length > 1) {
        resposta = {
          transactions: cmds.map((c, i) => ({
            transactionid: i + 1,
            verb: c.verb,
            endpoint: c.endpoint,
            body: c.body,
            contentType: c.content_type,
            ...(c.query_string ? { queryString: c.query_string } : {}),
          })),
        };
        const ids = cmds.map((c) => c.id);
        await supabase
          .from("controlid_comandos")
          .update({ status: "enviado", enviado_em: new Date().toISOString(), uuid })
          .in("id", ids);
      }
    }

    await logRequest({
      equipamento_id: equipamento?.id ?? null,
      device_id_externo: deviceId,
      tipo: "push",
      metodo: req.method,
      query,
      body: null,
      resposta,
      ip,
      user_agent: ua,
    });

    return resposta ? jsonResponse(resposta) : emptyResponse();
  }

  // ------------------- POST /result -------------------
  if (action === "result") {
    let body: any = null;
    try { body = await req.json(); } catch { body = null; }

    // Atualiza comando(s) usando uuid de correlação
    if (equipamento?.id && uuid) {
      const update: any = { status: "concluido", concluido_em: new Date().toISOString() };
      if (body?.error) {
        update.status = "erro";
        update.erro = String(body.error);
      } else {
        update.resultado = body?.response ?? body ?? null;
      }
      await supabase
        .from("controlid_comandos")
        .update(update)
        .eq("equipamento_id", equipamento.id)
        .eq("uuid", uuid)
        .eq("status", "enviado");
    }

    await logRequest({
      equipamento_id: equipamento?.id ?? null,
      device_id_externo: deviceId,
      tipo: "result",
      metodo: req.method,
      query,
      body,
      resposta: null,
      ip,
      user_agent: ua,
    });

    return emptyResponse();
  }

  // ------------------- POST /marcacao (REP-C ponto) -------------------
  // Aceita um payload livre — apenas registra no log para você ver o formato
  // exato que o seu equipamento envia, e depois mapeamos para registros_ponto.
  if (action === "marcacao") {
    let body: any = null;
    try { body = await req.json(); } catch { body = null; }

    await logRequest({
      equipamento_id: equipamento?.id ?? null,
      device_id_externo: deviceId,
      tipo: "marcacao",
      metodo: req.method,
      query,
      body,
      resposta: { ok: true },
      ip,
      user_agent: ua,
    });

    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "ação desconhecida", action }, 400);
});
