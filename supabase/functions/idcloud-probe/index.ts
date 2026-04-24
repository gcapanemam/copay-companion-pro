// Edge function: idcloud-probe
// Conecta no MySQL do iDCloud e devolve um diagnóstico:
// - lista de empregadores visíveis pela credencial
// - lista de equipamentos vinculados a cada empregador
// - contagem de marcações na tabela afd
// Útil para descobrir o id_Empregador correto antes de sincronizar.

import mysql from "npm:mysql2@3.11.3/promise";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const host = Deno.env.get("IDCLOUD_MYSQL_HOST");
  const portStr = Deno.env.get("IDCLOUD_MYSQL_PORT");
  const user = Deno.env.get("IDCLOUD_MYSQL_USER");
  const password = Deno.env.get("IDCLOUD_MYSQL_PASSWORD");
  const database = Deno.env.get("IDCLOUD_MYSQL_DATABASE");

  if (!host || !user || !password || !database) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "IDCLOUD_MYSQL_* secrets ausentes",
        present: { host: !!host, user: !!user, password: !!password, database: !!database, port: !!portStr },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const port = portStr ? Number(portStr) : 3306;

  let connection: mysql.Connection | null = null;
  const t0 = Date.now();
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      connectTimeout: 15000,
      // O iDCloud usa MySQL na porta 443 sem SSL obrigatório, mas
      // permitimos a stack negociar TLS se o servidor pedir.
      ssl: undefined,
    });

    // 1) Empregadores visíveis
    const [empregadores] = await connection.query(
      "SELECT id, RazaoSocial, NomeFantasia, CNPJ FROM empregadores ORDER BY RazaoSocial LIMIT 200",
    );

    // 2) Equipamentos visíveis (com empregador)
    const [equipamentos] = await connection.query(
      `SELECT e.id, e.NumeroSerie, e.Descricao, e.id_Empregador, emp.RazaoSocial, emp.CNPJ
         FROM equipamentos e
         LEFT JOIN empregadores emp ON emp.id = e.id_Empregador
        ORDER BY emp.RazaoSocial, e.NumeroSerie LIMIT 500`,
    );

    // 3) Para cada empregador, contar marcações totais e MAX(NSR)
    const empArr = empregadores as Array<{ id: number; RazaoSocial: string | null; NomeFantasia: string | null; CNPJ: string | null }>;
    const stats: Array<{
      id_Empregador: number;
      RazaoSocial: string | null;
      CNPJ: string | null;
      total_afd: number;
      max_nsr: number | null;
      ultima_data: string | null;
    }> = [];
    for (const e of empArr) {
      const [rows] = await connection.query(
        "SELECT COUNT(*) AS total, MAX(NSR) AS max_nsr, MAX(Data) AS ultima_data FROM afd WHERE id_Empregador = ?",
        [e.id],
      );
      const r = (rows as Array<{ total: number; max_nsr: number | null; ultima_data: string | null }>)[0];
      stats.push({
        id_Empregador: e.id,
        RazaoSocial: e.RazaoSocial,
        CNPJ: e.CNPJ,
        total_afd: Number(r?.total ?? 0),
        max_nsr: r?.max_nsr ?? null,
        ultima_data: r?.ultima_data ?? null,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        connection: { host, port, database, user, latency_ms: Date.now() - t0 },
        empregadores: empArr,
        equipamentos,
        stats,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("idcloud-probe error:", msg);
    return new Response(
      JSON.stringify({
        ok: false,
        error: msg,
        connection: { host, port, database, user, latency_ms: Date.now() - t0 },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    if (connection) {
      try {
        await connection.end();
      } catch {
        /* ignore */
      }
    }
  }
});
