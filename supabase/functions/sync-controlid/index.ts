// Edge function: sincroniza marcações de ponto do iDCloud (Control iD) para registros_ponto
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

    // Carrega equipamento(s)
    const equipQuery = supabase.from("equipamentos_ponto").select("*").eq("ativo", true);
    if (equipamentoId) equipQuery.eq("id", equipamentoId);
    const { data: equipamentos, error: equipErr } = await equipQuery;
    if (equipErr) throw equipErr;
    if (!equipamentos || equipamentos.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum equipamento ativo encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Conecta no MySQL do iDCloud
    const host = Deno.env.get("IDCLOUD_MYSQL_HOST");
    const port = Number(Deno.env.get("IDCLOUD_MYSQL_PORT") || "3306");
    const username = Deno.env.get("IDCLOUD_MYSQL_USER");
    const password = Deno.env.get("IDCLOUD_MYSQL_PASSWORD");
    const db = Deno.env.get("IDCLOUD_MYSQL_DATABASE");

    if (!host || !username || !password || !db) {
      return new Response(JSON.stringify({ error: "Credenciais iDCloud não configuradas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mysql = await new MySQLClient().connect({
      hostname: host, port, username, password, db,
    });

    // Carrega CPFs cadastrados para resolver matricula/pis -> cpf
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
        // Tabela `afd` no iDCloud — schema típico: nsr, data_hora, pis (ou cpf), tipo
        // Filtra pelo número de série e nsr > último importado
        const rows = await mysql.query(
          `SELECT nsr, data_hora, pis, cpf, matricula, tipo
           FROM afd
           WHERE nsr > ?
           ${equip.numero_serie ? "AND (numero_serie = ? OR equipamento = ?)" : ""}
           ORDER BY nsr ASC LIMIT ?`,
          equip.numero_serie
            ? [ultimoNsr, equip.numero_serie, equip.numero_serie, limit]
            : [ultimoNsr, limit],
        ) as AfdRow[];

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
          // Insere em lotes de 500, ignorando duplicatas (constraint unique em equipamento_id+nsr)
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

    await mysql.close();

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
