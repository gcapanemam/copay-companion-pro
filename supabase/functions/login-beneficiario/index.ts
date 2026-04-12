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

function generateCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
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

async function is2FAEnabled(supabase: any): Promise<boolean> {
  const { data } = await supabase
    .from("configuracoes")
    .select("valor")
    .eq("chave", "dois_fatores_ativo")
    .maybeSingle();
  return data?.valor === "true";
}

async function getUserData(supabase: any, cleanCpf: string, selectedAno: number) {
  const { data: titular } = await supabase.from("titulares").select("id, nome, cpf").eq("cpf", cleanCpf).maybeSingle();
  const { data: dependente } = await supabase.from("dependentes").select("id, nome, cpf, titular_id").eq("cpf", cleanCpf).maybeSingle();

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
  } else {
    const { data: admissaoFallback } = await supabase.from("admissoes").select("nome_completo").eq("cpf", cleanCpf).maybeSingle();
    if (!admissaoFallback) return null;
    nome = admissaoFallback.nome_completo;
  }

  const { data: contracheques } = await supabase.from("contracheques").select("*").eq("cpf", cleanCpf).eq("ano", selectedAno).order("mes");
  const { data: epis } = await supabase.from("epis").select("*").eq("cpf", cleanCpf).order("data_entrega", { ascending: false });
  const { data: valeTransporte } = await supabase.from("vale_transporte").select("*").eq("cpf", cleanCpf).eq("ano", selectedAno).order("mes");
  const { data: faltas } = await supabase.from("faltas").select("*").eq("cpf", cleanCpf).order("data_falta", { ascending: false });
  const { data: registrosPonto } = await supabase.from("registros_ponto").select("*").eq("cpf", cleanCpf).order("data", { ascending: false });
  const { data: admissao } = await supabase.from("admissoes").select("*").eq("cpf", cleanCpf).maybeSingle();

  const userUnidade = admissao?.unidade || null;
  const userDepartamento = admissao?.departamento || null;

  const { data: allComunicados } = await supabase.from("comunicados").select("*").order("created_at", { ascending: false });
  const { data: destinatariosSelecionados } = await supabase.from("comunicado_destinatarios").select("comunicado_id, cpf").eq("cpf", cleanCpf);
  const selecionadosIds = new Set((destinatariosSelecionados || []).map((d: any) => d.comunicado_id));

  const comunicados = (allComunicados || []).filter((c: any) => {
    if (c.tipo_destinatario === "todos") return true;
    if (c.tipo_destinatario === "unidade" && c.valor_destinatario === userUnidade) return true;
    if (c.tipo_destinatario === "departamento" && c.valor_destinatario === userDepartamento) return true;
    if (c.tipo_destinatario === "selecionados" && selecionadosIds.has(c.id)) return true;
    return false;
  });

  return {
    nome,
    cpf: cleanCpf,
    ano: selectedAno,
    mensalidades,
    coparticipacoes,
    contracheques: contracheques || [],
    epis: epis || [],
    vale_transporte: valeTransporte || [],
    faltas: faltas || [],
    registros_ponto: registrosPonto || [],
    admissao: admissao || null,
    comunicados,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, cpf, senha, ano, codigo } = await req.json();

    // --- Check 2FA config ---
    if (action === "check-2fa-config") {
      const enabled = await is2FAEnabled(supabase);
      return jsonResponse({ dois_fatores_ativo: enabled });
    }

    // --- Toggle 2FA (admin only) ---
    if (action === "toggle-2fa") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);

      const { valor } = await req.json().catch(() => ({}));
      const newValue = valor !== undefined ? String(valor) : "false";
      
      const { error } = await supabase
        .from("configuracoes")
        .update({ valor: newValue })
        .eq("chave", "dois_fatores_ativo");
      if (error) throw error;
      return jsonResponse({ success: true, valor: newValue });
    }

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

    // --- Verify 2FA code ---
    if (action === "verify-2fa") {
      if (!codigo) return jsonResponse({ error: "Código é obrigatório" }, 400);

      const { data: codeRecord } = await supabase
        .from("codigos_2fa")
        .select("*")
        .eq("cpf", cleanCpf)
        .eq("codigo", codigo)
        .eq("usado", false)
        .gt("expira_em", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!codeRecord) return jsonResponse({ error: "Código inválido ou expirado" }, 401);

      // Mark code as used
      await supabase.from("codigos_2fa").update({ usado: true }).eq("id", codeRecord.id);

      // Return user data
      const selectedAno = ano || new Date().getFullYear();
      const userData = await getUserData(supabase, cleanCpf, selectedAno);
      if (!userData) return jsonResponse({ error: "Beneficiário não encontrado" }, 404);

      return jsonResponse({ success: true, ...userData });
    }

    // --- Google login (match email to CPF) ---
    if (action === "google-login") {
      const { email: googleEmail } = await req.json().catch(() => ({}));
      if (!googleEmail) return jsonResponse({ error: "E-mail não informado" }, 400);

      const { data: admissaoByEmail } = await supabase
        .from("admissoes")
        .select("cpf, nome_completo")
        .eq("email", googleEmail.toLowerCase().trim())
        .maybeSingle();

      if (!admissaoByEmail) {
        return jsonResponse({ error: "Nenhum funcionário encontrado com este e-mail. Verifique se seu e-mail está cadastrado na ficha de admissão." }, 404);
      }

      const foundCpf = admissaoByEmail.cpf.replace(/[^0-9]/g, "");
      const selectedAno = ano || new Date().getFullYear();
      const userData = await getUserData(supabase, foundCpf, selectedAno);
      if (!userData) return jsonResponse({ error: "Beneficiário não encontrado" }, 404);

      return jsonResponse({ success: true, ...userData });
    }

    // --- Admin view (impersonation) / Login ---
    if (action === "login" || action === "admin-view") {
      if (action === "admin-view") {
        const authHeader = req.headers.get("authorization");
        if (!authHeader) return jsonResponse({ error: "Não autorizado" }, 401);
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) return jsonResponse({ error: "Não autorizado" }, 401);
      } else {
        if (!senha) return jsonResponse({ error: "Senha é obrigatória" }, 400);
        const { data: senhaRecord } = await supabase.from("beneficiario_senhas").select("senha_hash").eq("cpf", cleanCpf).maybeSingle();
        if (!senhaRecord) return jsonResponse({ error: "CPF não cadastrado" }, 401);
        const valid = await verifyPassword(senha, senhaRecord.senha_hash);
        if (!valid) return jsonResponse({ error: "Senha incorreta" }, 401);

        // Check if 2FA is enabled
        const twoFAEnabled = await is2FAEnabled(supabase);
        if (twoFAEnabled) {
          // Generate 2FA code
          const code = generateCode();
          const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

          // Store code
          await supabase.from("codigos_2fa").insert({
            cpf: cleanCpf,
            codigo: code,
            expira_em: expiresAt,
          });

          // Get employee email from admissoes
          const { data: admissao } = await supabase.from("admissoes").select("email, nome_completo").eq("cpf", cleanCpf).maybeSingle();
          const employeeEmail = admissao?.email;
          const employeeName = admissao?.nome_completo || "";

          if (employeeEmail) {
            // Send 2FA email via send-2fa-email function
            try {
              const sendUrl = `${supabaseUrl}/functions/v1/send-2fa-email`;
              await fetch(sendUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({ email: employeeEmail, codigo: code, nome: employeeName }),
              });
            } catch (emailErr) {
              console.error("Failed to send 2FA email:", emailErr);
            }
          } else {
            console.warn("Employee has no email configured for CPF:", cleanCpf);
          }

          // Mask email for UI
          let maskedEmail = "";
          if (employeeEmail) {
            const [user, domain] = employeeEmail.split("@");
            maskedEmail = `${user.slice(0, 2)}***@${domain}`;
          }

          return jsonResponse({
            requires_2fa: true,
            cpf: cleanCpf,
            masked_email: maskedEmail,
          });
        }
      }

      const selectedAno = ano || new Date().getFullYear();
      const userData = await getUserData(supabase, cleanCpf, selectedAno);
      if (!userData) return jsonResponse({ error: "Beneficiário não encontrado" }, 404);

      return jsonResponse({ success: true, ...userData });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
