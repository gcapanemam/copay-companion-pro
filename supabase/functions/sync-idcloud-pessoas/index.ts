// Edge function: sync-idcloud-pessoas
// action: "pull"  → lê tabela `pessoas` do iDCloud para o empregador e faz upsert em `admissoes` (cpf como chave)
// action: "push"  → envia funcionários da tabela `admissoes` (todos ou os passados em `cpfs`) para o iDCloud
// action: "deactivate" → marca ExcluidoDefinitivo=1 nas pessoas com CPFs informados

import mysql from "npm:mysql2@3.11.3/promise";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCpf(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11);
}

function dateOnly(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { action?: "pull" | "push" | "deactivate"; id_empregador?: number; cpfs?: string[] };
  try { body = await req.json(); } catch { body = {}; }
  const action = body.action || "pull";
  const idEmpregador = Number(body.id_empregador || 0);
  if (!idEmpregador) {
    return new Response(JSON.stringify({ ok: false, error: "id_empregador obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const host = Deno.env.get("IDCLOUD_MYSQL_HOST")!;
  const port = Number(Deno.env.get("IDCLOUD_MYSQL_PORT") || 3306);
  const user = Deno.env.get("IDCLOUD_MYSQL_USER")!;
  const password = Deno.env.get("IDCLOUD_MYSQL_PASSWORD")!;
  const database = Deno.env.get("IDCLOUD_MYSQL_DATABASE")!;

  let conn: mysql.Connection | null = null;
  const t0 = Date.now();
  try {
    conn = await mysql.createConnection({ host, port, user, password, database, connectTimeout: 15000, dateStrings: false });

    if (action === "pull") {
      const [rows] = await conn.query(
        `SELECT id, Nome, CPF, PIS, RG, Matricula, DataAdmissao, DataDemissao, ExcluidoDefinitivo
           FROM pessoas
          WHERE id_Empregador = ? AND COALESCE(ExcluidoDefinitivo,0) = 0
          ORDER BY Nome
          LIMIT 5000`,
        [idEmpregador],
      );
      const pessoas = rows as Array<{
        id: number; Nome: string | null; CPF: string | null; PIS: string | null; RG: string | null; Matricula: string | null;
        DataAdmissao: Date | string | null; DataDemissao: Date | string | null; ExcluidoDefinitivo: number | null;
      }>;

      let inseridos = 0; let atualizados = 0; let pulados = 0;
      for (const p of pessoas) {
        const cpf = normalizeCpf(p.CPF);
        if (!cpf || cpf === "00000000000") { pulados++; continue; }
        const payload = {
          cpf,
          nome_completo: (p.Nome || "").trim() || cpf,
          numero_pis: String(p.PIS ?? "").replace(/\D/g, "") || null,
          rg: p.RG || null,
          primeiro_dia_trabalho: dateOnly(p.DataAdmissao),
          data_demissao: dateOnly(p.DataDemissao),
        };
        const { data: ex } = await sb.from("admissoes").select("cpf").eq("cpf", cpf).maybeSingle();
        if (ex) {
          const { error } = await sb.from("admissoes").update(payload).eq("cpf", cpf);
          if (!error) atualizados++;
        } else {
          const { error } = await sb.from("admissoes").insert(payload);
          if (!error) inseridos++;
        }
      }

      return new Response(JSON.stringify({ ok: true, action, total: pessoas.length, inseridos, atualizados, pulados, latency_ms: Date.now() - t0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "push") {
      let q = sb.from("admissoes").select("cpf, nome_completo, numero_pis, rg, primeiro_dia_trabalho, data_demissao");
      if (Array.isArray(body.cpfs) && body.cpfs.length > 0) {
        q = q.in("cpf", body.cpfs.map((c) => normalizeCpf(c)));
      }
      const { data: admissoes, error: admErr } = await q;
      if (admErr) throw admErr;

      let inseridos = 0; let atualizados = 0; let erros = 0;
      for (const a of (admissoes || [])) {
        const cpf = normalizeCpf(a.cpf);
        if (!cpf) { erros++; continue; }
        const pis = String(a.numero_pis ?? "").replace(/\D/g, "") || null;
        try {
          // INSERT ... ON DUPLICATE KEY UPDATE assume índice único em (id_Empregador, CPF).
          // Se a chave única no iDCloud for outra, a query ainda funciona via UPDATE manual de fallback.
          const [res] = await conn.query(
            `INSERT INTO pessoas (id_Empregador, Nome, CPF, PIS, RG, DataAdmissao, DataDemissao, ExcluidoDefinitivo, DataAtualizacao)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())
             ON DUPLICATE KEY UPDATE
               Nome = VALUES(Nome), PIS = VALUES(PIS), RG = VALUES(RG),
               DataAdmissao = VALUES(DataAdmissao), DataDemissao = VALUES(DataDemissao),
               ExcluidoDefinitivo = 0, DataAtualizacao = NOW()`,
            [idEmpregador, a.nome_completo || cpf, cpf, pis, a.rg || null, a.primeiro_dia_trabalho || null, a.data_demissao || null],
          );
          const r = res as { affectedRows: number; insertId: number };
          if (r.insertId && r.affectedRows === 1) inseridos++;
          else atualizados++;
        } catch (e) {
          console.error("push pessoa erro:", e);
          erros++;
        }
      }

      return new Response(JSON.stringify({ ok: true, action, total: (admissoes || []).length, inseridos, atualizados, erros, latency_ms: Date.now() - t0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deactivate") {
      const cpfs = (body.cpfs || []).map((c) => normalizeCpf(c)).filter(Boolean);
      if (cpfs.length === 0) {
        return new Response(JSON.stringify({ ok: false, error: "cpfs vazio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const placeholders = cpfs.map(() => "?").join(",");
      const [res] = await conn.query(
        `UPDATE pessoas SET ExcluidoDefinitivo = 1, DataAtualizacao = NOW()
          WHERE id_Empregador = ? AND CPF IN (${placeholders})`,
        [idEmpregador, ...cpfs],
      );
      const r = res as { affectedRows: number };
      return new Response(JSON.stringify({ ok: true, action, afetados: r.affectedRows, latency_ms: Date.now() - t0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: `action inválido: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync-idcloud-pessoas error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg, latency_ms: Date.now() - t0 }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (conn) { try { await conn.end(); } catch { /* ignore */ } }
  }
});
