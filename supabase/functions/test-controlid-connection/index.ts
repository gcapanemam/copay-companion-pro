// Edge function: testa conexão com equipamento sem importar dados
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isPrivateHost(host: string): boolean {
  const h = host.replace(/\s/g, "");
  // IPs privados RFC1918 + loopback + link-local (aceita zeros à esquerda como 192.168.000.023)
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
  }
  if (/^localhost$/i.test(h)) return true;
  return false;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout (${ms}ms) ao ${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const inicio = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { equipamento_id, host, porta, usuario, senha, tipo_conexao } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bloquear cedo: IP privado não é alcançável a partir da nuvem
    if (isPrivateHost(cHost)) {
      return new Response(JSON.stringify({
        ok: false,
        modo: cTipo,
        host: cHost,
        latencia_ms: Date.now() - inicio,
        error: "IP privado/local não é alcançável pela nuvem",
        dica: "O endereço " + cHost + " é da rede interna do cliente. Para conectar via Lovable Cloud, exponha o equipamento por: (1) iDCloud com host público, ou (2) VPN/Cloudflare Tunnel/ngrok com endereço público.",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (cTipo === "rep_local") {
      const baseUrl = `https://${cHost}:${cPorta || 443}`;
      try {
        const res = await withTimeout(
          fetch(`${baseUrl}/session_login.fcgi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login: cUsuario || "admin", password: cSenha || "" }),
          }),
          8000,
          "fazer login no REP",
        );
        if (!res.ok) {
          return new Response(JSON.stringify({
            ok: false, modo: "rep_local", error: `Login falhou: HTTP ${res.status}`, latencia_ms: Date.now() - inicio,
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({
          ok: true, modo: "rep_local", sessao: data.session ? "obtida" : "ok", latencia_ms: Date.now() - inicio,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        return new Response(JSON.stringify({
          ok: false, modo: "rep_local", error: e.message, latencia_ms: Date.now() - inicio,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // iDCloud MySQL
    try {
      const mysql = await withTimeout(
        new MySQLClient().connect({
          hostname: cHost,
          port: Number(cPorta || 3306),
          username: cUsuario || "",
          password: cSenha || "",
          db: "idcloud",
        }),
        8000,
        "conectar ao MySQL",
      );
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
        ok: false, modo: "idcloud_mysql", error: e.message || String(e), latencia_ms: Date.now() - inicio,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message || String(err), latencia_ms: Date.now() - inicio }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
