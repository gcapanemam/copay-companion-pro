// Edge function: sync-idcloud-afd
// Lê novas marcações da tabela `afd` no MySQL do iDCloud (cursor por NSR),
// resolve PIS/CPF contra a tabela `admissoes` do app e faz upsert em `registros_ponto`.
//
// Body:
//   {
//     id_empregador: number,           // obrigatório (ver idcloud-probe)
//     equipamento_id?: string|null,    // uuid local opcional p/ vincular registros
//     numero_serie?: string|null,      // se quiser filtrar só este REP no iDCloud
//     desde_nsr?: number,              // override do cursor; default = ultimo_nsr do equipamento
//     limite?: number                  // máx. marcações por chamada (default 5000)
//   }

import mysql from "npm:mysql2@3.11.3/promise";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AfdRow = {
  NSR: number;
  PIS: string | null;
  Data: Date | string;
  Tipo: number;
  id_Equipamento: number | null;
  Dado: string | null;
};

type Existing = {
  id: string;
  cpf: string;
  data: string;
  entrada_1: string | null;
  saida_1: string | null;
  entrada_2: string | null;
  saida_2: string | null;
  entrada_3: string | null;
  saida_3: string | null;
};

function normalizeCpf(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11);
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function toDateParts(d: Date) {
  return {
    date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
    time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: { id_empregador?: number; equipamento_id?: string | null; numero_serie?: string | null; desde_nsr?: number; limite?: number };
  try { body = await req.json(); } catch { body = {}; }

  const idEmpregador = Number(body.id_empregador || 0);
  if (!idEmpregador) {
    return new Response(JSON.stringify({ ok: false, error: "id_empregador obrigatório" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const limite = Math.max(1, Math.min(20000, Number(body.limite || 5000)));
  const equipamentoIdLocal = body.equipamento_id ?? null;
  const numeroSerie = (body.numero_serie ?? "").trim() || null;

  // Cursor: usa o ultimo_nsr do equipamento local (se passado), senão tenta achar pelo numero_serie, senão 0.
  let cursor = Number(body.desde_nsr ?? 0);
  let equipLocal: { id: string; ultimo_nsr: number; numero_serie: string | null } | null = null;
  if (equipamentoIdLocal) {
    const { data } = await sb.from("equipamentos_ponto").select("id, ultimo_nsr, numero_serie").eq("id", equipamentoIdLocal).maybeSingle();
    if (data) {
      equipLocal = data as typeof equipLocal;
      if (!body.desde_nsr) cursor = Number(data.ultimo_nsr || 0);
    }
  }

  // Conecta no MySQL
  const host = Deno.env.get("IDCLOUD_MYSQL_HOST")!;
  const port = Number(Deno.env.get("IDCLOUD_MYSQL_PORT") || 3306);
  const user = Deno.env.get("IDCLOUD_MYSQL_USER")!;
  const password = Deno.env.get("IDCLOUD_MYSQL_PASSWORD")!;
  const database = Deno.env.get("IDCLOUD_MYSQL_DATABASE")!;

  let conn: mysql.Connection | null = null;
  const t0 = Date.now();
  try {
    conn = await mysql.createConnection({ host, port, user, password, database, connectTimeout: 15000, dateStrings: false });

    // Resolve id_Equipamento no iDCloud por número de série (se fornecido)
    let idEquipIdcloud: number | null = null;
    if (numeroSerie) {
      const [rows] = await conn.query("SELECT id FROM equipamentos WHERE id_Empregador = ? AND NumeroSerie = ? LIMIT 1", [idEmpregador, numeroSerie]);
      const r = (rows as Array<{ id: number }>)[0];
      idEquipIdcloud = r?.id ?? null;
    }

    const params: (string | number)[] = [idEmpregador, cursor];
    let sql = "SELECT NSR, PIS, Data, Tipo, id_Equipamento, Dado FROM afd WHERE id_Empregador = ? AND NSR > ?";
    if (idEquipIdcloud) {
      sql += " AND id_Equipamento = ?";
      params.push(idEquipIdcloud);
    }
    sql += " AND Tipo = 3 ORDER BY NSR ASC LIMIT ?";
    params.push(limite);

    const [marcas] = await conn.query(sql, params);
    const linhas = marcas as AfdRow[];

    if (linhas.length === 0) {
      return new Response(JSON.stringify({
        ok: true, lidas: 0, importadas: 0, cursor_anterior: cursor, cursor_novo: cursor,
        cpfs_nao_resolvidos: 0, latency_ms: Date.now() - t0,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega admissoes para resolver PIS->CPF e validar CPFs
    const { data: admissoes } = await sb.from("admissoes").select("cpf, numero_pis");
    const cpfsValidos = new Set<string>();
    const pisToCpf = new Map<string, string>();
    const cpfSuffix9 = new Map<string, string | null>();
    (admissoes || []).forEach((a: { cpf: string | null; numero_pis: string | null }) => {
      const c = normalizeCpf(a.cpf);
      if (c) {
        cpfsValidos.add(c);
        const s9 = c.slice(-9);
        const ex = cpfSuffix9.get(s9);
        if (ex && ex !== c) cpfSuffix9.set(s9, null);
        else if (ex === undefined) cpfSuffix9.set(s9, c);
      }
      const pis = String(a.numero_pis ?? "").replace(/\D/g, "");
      if (pis && c) pisToCpf.set(pis, c);
    });

    // Agrupa marcações por (cpf, data)
    type Mark = { dt: Date; nsr: number; date: string; time: string };
    const grupos = new Map<string, Mark[]>(); // key = `${cpf}|${date}`
    let cpfsNaoResolvidos = 0;
    let maxNsr = cursor;

    for (const r of linhas) {
      if (Number(r.NSR) > maxNsr) maxNsr = Number(r.NSR);
      const dt = r.Data instanceof Date ? r.Data : new Date(String(r.Data));
      if (!dt || isNaN(dt.getTime())) continue;
      const { date, time } = toDateParts(dt);

      // Resolve CPF: PIS primeiro, depois tenta extrair CPF do "Dado" como fallback
      let cpf: string | null = null;
      const pisDigits = String(r.PIS ?? "").replace(/\D/g, "");
      if (pisDigits) {
        const m = pisToCpf.get(pisDigits) || pisToCpf.get(pisDigits.padStart(11, "0"));
        if (m) cpf = m;
      }
      if (!cpf && r.Dado) {
        const cpfMatch = String(r.Dado).match(/(\d{11,12})/g) || [];
        for (const seq of cpfMatch) {
          const c = normalizeCpf(seq.slice(-11));
          if (cpfsValidos.has(c)) { cpf = c; break; }
        }
        if (!cpf) {
          for (const seq of cpfMatch) {
            const s9 = String(seq).slice(-9);
            const m = cpfSuffix9.get(s9);
            if (m) { cpf = m; break; }
          }
        }
      }
      if (!cpf) {
        cpfsNaoResolvidos++;
        continue;
      }

      const key = `${cpf}|${date}`;
      const arr = grupos.get(key) || [];
      arr.push({ dt, nsr: Number(r.NSR), date, time });
      grupos.set(key, arr);
    }

    // Carrega existentes para mesclar
    const cpfsAfetados = Array.from(new Set(Array.from(grupos.keys()).map((k) => k.split("|")[0])));
    const datasAfetadas = Array.from(new Set(Array.from(grupos.keys()).map((k) => k.split("|")[1])));
    const minDate = datasAfetadas.sort()[0];
    const maxDate = datasAfetadas.sort()[datasAfetadas.length - 1];
    const { data: existentes } = await sb
      .from("registros_ponto")
      .select("id, cpf, data, entrada_1, saida_1, entrada_2, saida_2, entrada_3, saida_3")
      .in("cpf", cpfsAfetados)
      .gte("data", minDate)
      .lte("data", maxDate);
    const existMap = new Map<string, Existing>();
    for (const e of (existentes || []) as Existing[]) {
      existMap.set(`${e.cpf}|${e.data}`, e);
    }

    // Monta upserts (entrada_1..saida_3 em ordem cronológica, mesclando com existentes)
    const slots: Array<keyof Existing> = ["entrada_1", "saida_1", "entrada_2", "saida_2", "entrada_3", "saida_3"];
    type Upsert = {
      id?: string; cpf: string; data: string;
      entrada_1: string | null; saida_1: string | null;
      entrada_2: string | null; saida_2: string | null;
      entrada_3: string | null; saida_3: string | null;
      equipamento_id: string | null; nsr: number | null; tipo_marcacao: string;
    };
    const upserts: Upsert[] = [];
    let importadas = 0;
    let excedentes = 0;
    for (const [key, marks] of grupos) {
      const [cpf, data] = key.split("|");
      const ex = existMap.get(key);
      const horas: string[] = [];
      for (const s of slots) {
        const v = ex?.[s] as string | null | undefined;
        if (v) horas.push(String(v).slice(0, 8));
      }
      for (const m of marks) {
        if (!horas.includes(m.time)) horas.push(m.time);
      }
      horas.sort();
      const seis = horas.slice(0, 6);
      if (horas.length > 6) excedentes += horas.length - 6;
      importadas += marks.length;
      const row: Upsert = {
        cpf, data, equipamento_id: equipamentoIdLocal,
        nsr: marks[marks.length - 1].nsr,
        tipo_marcacao: "idcloud",
        entrada_1: seis[0] ?? null, saida_1: seis[1] ?? null,
        entrada_2: seis[2] ?? null, saida_2: seis[3] ?? null,
        entrada_3: seis[4] ?? null, saida_3: seis[5] ?? null,
      };
      if (ex?.id) row.id = ex.id;
      upserts.push(row);
    }

    // Aplica em lotes
    let salvos = 0;
    const lote = 200;
    for (let i = 0; i < upserts.length; i += lote) {
      const slice = upserts.slice(i, i + lote);
      const { error } = await sb.from("registros_ponto").upsert(slice, { onConflict: "id" });
      if (error) throw new Error(`upsert: ${error.message}`);
      salvos += slice.length;
    }

    // Atualiza cursor no equipamento
    if (equipLocal && maxNsr > cursor) {
      await sb.from("equipamentos_ponto").update({
        ultimo_nsr: maxNsr,
        ultima_sincronizacao: new Date().toISOString(),
      }).eq("id", equipLocal.id);
    }

    return new Response(JSON.stringify({
      ok: true,
      lidas: linhas.length,
      importadas,
      registros_afetados: salvos,
      cpfs_nao_resolvidos: cpfsNaoResolvidos,
      excedentes,
      cursor_anterior: cursor,
      cursor_novo: maxNsr,
      latency_ms: Date.now() - t0,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("sync-idcloud-afd error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg, latency_ms: Date.now() - t0 }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (conn) { try { await conn.end(); } catch { /* ignore */ } }
  }
});
