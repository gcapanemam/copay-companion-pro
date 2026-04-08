import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const newHashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return newHashHex === hashHex;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, cpf, senha, ano } = await req.json();

    // --- List beneficiaries ---
    if (action === "list-beneficiarios") {
      const { data: titulares } = await supabase.from("titulares").select("id, nome, cpf").not("cpf", "is", null).order("nome");
      const { data: dependentes } = await supabase.from("dependentes").select("id, nome, cpf, titular_id").not("cpf", "is", null).order("nome");
      const { data: senhas } = await supabase.from("beneficiario_senhas").select("cpf");
      const cpfsComSenha = new Set((senhas || []).map((s: any) => s.cpf));
      const beneficiarios = [
        ...(titulares || []).map((t: any) => ({ nome: t.nome, cpf: t.cpf, tipo: "Titular", temSenha: cpfsComSenha.has(t.cpf) })),
        ...(dependentes || []).map((d: any) => ({ nome: d.nome, cpf: d.cpf, tipo: "Dependente", temSenha: cpfsComSenha.has(d.cpf) })),
      ];
      return jsonResponse({ beneficiarios });
    }

    // --- Bulk set CPF as password ---
    if (action === "set-all-senhas-cpf") {
      const { data: titulares } = await supabase.from("titulares").select("cpf").not("cpf", "is", null);
      const { data: dependentes } = await supabase.from("dependentes").select("cpf").not("cpf", "is", null);
      const allCpfs = [...(titulares || []).map((t: any) => t.cpf), ...(dependentes || []).map((d: any) => d.cpf)].filter((c: string) => c && c.length === 11);
      let count = 0;
      for (const rawCpf of allCpfs) {
        const formatted = `${rawCpf.slice(0,3)}.${rawCpf.slice(3,6)}.${rawCpf.slice(6,9)}-${rawCpf.slice(9)}`;
        const hash = await hashPassword(formatted);
        await supabase.from("beneficiario_senhas").upsert({ cpf: rawCpf, senha_hash: hash }, { onConflict: "cpf" });
        count++;
      }
      return jsonResponse({ success: true, count });
    }

    const cleanCpf = (cpf || "").replace(/[^0-9]/g, "");
    if (!cleanCpf) return jsonResponse({ error: "CPF é obrigatório" }, 400);

    // --- Set password ---
    if (action === "set-senha") {
      if (!senha || senha.length < 4) return jsonResponse({ error: "Senha deve ter pelo menos 4 caracteres" }, 400);
      const hash = await hashPassword(senha);
      const { error } = await supabase.from("beneficiario_senhas").upsert({ cpf: cleanCpf, senha_hash: hash }, { onConflict: "cpf" });
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // --- Login ---
    if (action === "login") {
      if (!senha) return jsonResponse({ error: "Senha é obrigatória" }, 400);

      const { data: senhaRecord } = await supabase.from("beneficiario_senhas").select("senha_hash").eq("cpf", cleanCpf).maybeSingle();
      if (!senhaRecord) return jsonResponse({ error: "CPF não cadastrado" }, 401);

      const valid = await verifyPassword(senha, senhaRecord.senha_hash);
      if (!valid) return jsonResponse({ error: "Senha incorreta" }, 401);

      const selectedAno = ano || new Date().getFullYear();

      // Find user
      const { data: titular } = await supabase.from("titulares").select("id, nome, cpf").eq("cpf", cleanCpf).maybeSingle();
      const { data: dependente } = await supabase.from("dependentes").select("id, nome, cpf, titular_id").eq("cpf", cleanCpf).maybeSingle();
      if (!titular && !dependente) return jsonResponse({ error: "Beneficiário não encontrado" }, 404);

      let nome = "";
      let mensalidades: any[] = [];
      let coparticipacoes: any[] = [];

      if (titular) {
        nome = titular.nome;
        const { data: mens } = await supabase.from("mensalidades").select("*").eq("titular_id", titular.id).is("dependente_id", null).eq("ano", selectedAno);
        mensalidades = mens || [];
        const { data: coparts } = await supabase.from("coparticipacoes").select("*, coparticipacao_itens(*)").eq("titular_id", titular.id).is("dependente_id", null).eq("ano", selectedAno);
        coparticipacoes = coparts || [];
      } else if (dependente) {
        nome = dependente.nome;
        const { data: mens } = await supabase.from("mensalidades").select("*").eq("dependente_id", dependente.id).eq("ano", selectedAno);
        mensalidades = mens || [];
        const { data: coparts } = await supabase.from("coparticipacoes").select("*, coparticipacao_itens(*)").eq("dependente_id", dependente.id).eq("ano", selectedAno);
        coparticipacoes = coparts || [];
      }

      // Fetch new modules data
      const { data: contracheques } = await supabase.from("contracheques").select("*").eq("cpf", cleanCpf).eq("ano", selectedAno).order("mes");
      const { data: epis } = await supabase.from("epis").select("*").eq("cpf", cleanCpf).order("data_entrega", { ascending: false });
      const { data: valeTransporte } = await supabase.from("vale_transporte").select("*").eq("cpf", cleanCpf).eq("ano", selectedAno).order("mes");
      const { data: faltas } = await supabase.from("faltas").select("*").eq("cpf", cleanCpf).order("data_falta", { ascending: false });

      return jsonResponse({
        success: true,
        nome,
        cpf: cleanCpf,
        ano: selectedAno,
        mensalidades,
        coparticipacoes,
        contracheques: contracheques || [],
        epis: epis || [],
        vale_transporte: valeTransporte || [],
        faltas: faltas || [],
      });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
