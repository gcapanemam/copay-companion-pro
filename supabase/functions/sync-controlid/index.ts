// Edge function: sincroniza marcações de ponto do Control iD
// Suporta dois modos por equipamento: iDCloud (MySQL) e REP Local (REST API)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCpf(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0").slice(-11);
}

interface AfdRow {
  nsr: number;
  data_hora: string | Date;
  cpf?: string | null;
  pis?: string | null;
  matricula?: string | null;
  tipo?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const equipamentoId: string | undefined = body.equipamento_id;
    const limit: number = Math.min(Number(body.limit) || 1000, 5000);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const equipQuery = supabase.from("equipamentos_ponto").select("*").eq("ativo", true);
    if (equipamentoId) equipQuery.eq("id", equipamentoId);
    const { data: equipamentos, error: equipErr } = await equipQuery;
    if (equipErr) throw equipErr;
    if (!equipamentos || equipamentos.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum equipamento ativo encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: admissoes } = await supabase.from("admissoes").select("cpf, numero_pis");
    const cpfsValidos = new Set<string>();
    const pisToCpf = new Map<string, string>();
    (admissoes || []).forEach((a: any) => {
      const c = normalizeCpf(a.cpf);
      if (c) cpfsValidos.add(c);
      const pis = String(a.numero_pis ?? "").replace(/\D/g, "");
      if (pis && c) pisToCpf.set(pis, c);
    });

    const relatorio = {
      equipamentos_processados: 0,
      novos_registros: 0,
      cpfs_nao_encontrados: 0,
      erros: [] as string[],
    };

    for (const equip of equipamentos) {
      relatorio.equipamentos_processados++;
      const ultimoNsr = Number(equip.ultimo_nsr || 0);

      try {
        if (!equip.host) {
          relatorio.erros.push(`${equip.nome}: host não configurado`);
          continue;
        }

        // Descriptografar senha via RPC SECURITY DEFINER
        const { data: senhaPlana, error: senhaErr } = await supabase
          .rpc("obter_senha_equipamento", { p_id: equip.id });
        if (senhaErr) throw senhaErr;

        let rows: AfdRow[] = [];

        if (equip.tipo_conexao === "rep_local") {
          // REST API local do REP iDClass
          const baseUrl = `https://${equip.host}:${equip.porta || 443}`;
          const loginRes = await fetch(`${baseUrl}/session_login.fcgi`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login: equip.usuario || "admin", password: senhaPlana || "" }),
          });
          if (!loginRes.ok) throw new Error(`Login REP falhou: ${loginRes.status}`);
          const loginData = await loginRes.json();
          const session = loginData.session;

          const afdRes = await fetch(`${baseUrl}/get_afd.fcgi?session=${session}&mode=full`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initial_nsr: ultimoNsr + 1 }),
          });
          if (!afdRes.ok) throw new Error(`get_afd falhou: ${afdRes.status}`);
          const afdText = await afdRes.text();
          // Parse AFD: cada linha = NSR(9) tipo(1) datahora(yyyymmddhhmm) ...
          rows = afdText.split("\n").map((line) => {
            const m = line.match(/^(\d{9})(\d)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(.*)$/);
            if (!m) return null;
            const [, nsr, , y, mo, d, h, mi, rest] = m;
            const cpf = (rest.match(/\d{11}/) || [""])[0];
            return {
              nsr: Number(nsr),
              data_hora: `${y}-${mo}-${d}T${h}:${mi}:00`,
              cpf,
            } as AfdRow;
          }).filter(Boolean) as AfdRow[];
        } else {
          // iDCloud MySQL
          const mysql = await new MySQLClient().connect({
            hostname: equip.host,
            port: Number(equip.porta || 3306),
            username: equip.usuario || "",
            password: senhaPlana || "",
            db: equip.descricao && equip.descricao.startsWith("db:") ? equip.descricao.slice(3) : "idcloud",
          });
          rows = await mysql.query(
            `SELECT nsr, data_hora, pis, cpf, matricula, tipo
             FROM afd
             WHERE nsr > ?
             ${equip.numero_serie ? "AND (numero_serie = ? OR equipamento = ?)" : ""}
             ORDER BY nsr ASC LIMIT ?`,
            equip.numero_serie
              ? [ultimoNsr, equip.numero_serie, equip.numero_serie, limit]
              : [ultimoNsr, limit],
          ) as AfdRow[];
          await mysql.close();
        }

        let maiorNsr = ultimoNsr;
        const inserts: any[] = [];

        for (const row of rows) {
          const nsr = Number(row.nsr);
          if (nsr > maiorNsr) maiorNsr = nsr;

          let cpf = normalizeCpf(row.cpf);
          if (!cpf && row.pis) {
            const pisDigits = String(row.pis).replace(/\D/g, "");
            cpf = pisToCpf.get(pisDigits) || "";
          }
          if (!cpf || !cpfsValidos.has(cpf)) {
            relatorio.cpfs_nao_encontrados++;
            continue;
          }

          const dt = new Date(row.data_hora);
          const data = dt.toISOString().slice(0, 10);
          const hora = dt.toTimeString().slice(0, 8);

          inserts.push({
            cpf,
            data,
            data_hora: dt.toISOString(),
            entrada_1: hora,
            equipamento_id: equip.id,
            nsr,
            tipo_marcacao: row.tipo || null,
          });
        }

        if (inserts.length > 0) {
          for (let i = 0; i < inserts.length; i += 500) {
            const batch = inserts.slice(i, i + 500);
            const { error: insErr } = await supabase
              .from("registros_ponto")
              .upsert(batch, { onConflict: "equipamento_id,nsr", ignoreDuplicates: true });
            if (insErr) {
              relatorio.erros.push(`${equip.nome}: ${insErr.message}`);
            } else {
              relatorio.novos_registros += batch.length;
            }
          }
        }

        await supabase
          .from("equipamentos_ponto")
          .update({ ultimo_nsr: maiorNsr, ultima_sincronizacao: new Date().toISOString() })
          .eq("id", equip.id);

      } catch (e: any) {
        relatorio.erros.push(`${equip.nome}: ${e.message || String(e)}`);
      }
    }

    return new Response(JSON.stringify(relatorio), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-controlid error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
