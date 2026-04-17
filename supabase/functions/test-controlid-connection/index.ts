// Edge function: testa conexão com equipamento sem importar dados
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { equipamento_id, host, porta, usuario, senha, tipo_conexao } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve credenciais: usa as enviadas, ou busca no banco se equipamento_id for fornecido
    let cHost = host, cPorta = porta, cUsuario = usuario, cSenha = senha, cTipo = tipo_conexao;

    if (equipamento_id && (!cHost || cSenha === undefined || cSenha === null || cSenha === "")) {
      const { data: equip } = await supabase
        .from("equipamentos_ponto")
        .select("host, porta, usuario, tipo_conexao")
        .eq("id", equipamento_id)
        .maybeSingle();
      if (equip) {
        cHost = cHost || equip.host;
        cPorta = cPorta || equip.porta;
        cUsuario = cUsuario || equip.usuario;
        cTipo = cTipo || equip.tipo_conexao;
      }
      if (!cSenha) {
        const { data: senhaPlana } = await supabase.rpc("obter_senha_equipamento", { p_id: equipamento_id });
        cSenha = senhaPlana || "";
      }
    }

    if (!cHost) {
      return new Response(JSON.stringify({ ok: false, error: "Host/IP é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inicio = Date.now();

    if (cTipo === "rep_local") {
      const baseUrl = `https://${cHost}:${cPorta || 443}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(`${baseUrl}/session_login.fcgi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: cUsuario || "admin", password: cSenha || "" }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) {
          return new Response(JSON.stringify({
            ok: false, error: `Login falhou: HTTP ${res.status}`, latencia_ms: Date.now() - inicio,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({
          ok: true, modo: "rep_local", sessao: data.session ? "obtida" : "ok", latencia_ms: Date.now() - inicio,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        clearTimeout(t);
        return new Response(JSON.stringify({
          ok: false, error: e.name === "AbortError" ? "Timeout (10s)" : e.message,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // iDCloud MySQL
    try {
      const mysql = await new MySQLClient().connect({
        hostname: cHost,
        port: Number(cPorta || 3306),
        username: cUsuario || "",
        password: cSenha || "",
        db: "idcloud",
        timeout: 10000,
      });
      const ping = await mysql.query("SELECT 1 AS ok") as any[];
      let totalAfd: number | null = null;
      try {
        const t = await mysql.query("SELECT COUNT(*) AS total FROM afd") as any[];
        totalAfd = Number(t?.[0]?.total ?? 0);
      } catch { /* tabela afd pode não existir nesse db */ }
      await mysql.close();
      return new Response(JSON.stringify({
        ok: true, modo: "idcloud_mysql",
        ping: ping?.[0]?.ok === 1 ? "ok" : "?",
        registros_afd: totalAfd,
        latencia_ms: Date.now() - inicio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e: any) {
      return new Response(JSON.stringify({
        ok: false, error: e.message || String(e), latencia_ms: Date.now() - inicio,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
