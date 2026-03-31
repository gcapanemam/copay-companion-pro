import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, cpf, senha, ano } = await req.json();

    const cleanCpf = (cpf || "").replace(/[^0-9]/g, "");

    if (!cleanCpf) {
      return new Response(JSON.stringify({ error: "CPF é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin action: set password
    if (action === "set-senha") {
      if (!senha || senha.length < 4) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 4 caracteres" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const hash = await bcrypt.hash(senha);

      const { error } = await supabase.from("beneficiario_senhas").upsert(
        { cpf: cleanCpf, senha_hash: hash },
        { onConflict: "cpf" }
      );

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Login action
    if (action === "login") {
      if (!senha) {
        return new Response(JSON.stringify({ error: "Senha é obrigatória" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: senhaRecord } = await supabase
        .from("beneficiario_senhas")
        .select("senha_hash")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (!senhaRecord) {
        return new Response(JSON.stringify({ error: "CPF não cadastrado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await bcrypt.compare(senha, senhaRecord.senha_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Senha incorreta" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const selectedAno = ano || new Date().getFullYear();

      // Find titular or dependente by CPF
      const { data: titular } = await supabase
        .from("titulares")
        .select("id, nome, cpf")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      const { data: dependente } = await supabase
        .from("dependentes")
        .select("id, nome, cpf, titular_id")
        .eq("cpf", cleanCpf)
        .maybeSingle();

      if (!titular && !dependente) {
        return new Response(JSON.stringify({ error: "Beneficiário não encontrado com este CPF" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let nome = "";
      let mensalidades: any[] = [];
      let coparticipacoes: any[] = [];

      if (titular) {
        nome = titular.nome;

        const { data: mens } = await supabase
          .from("mensalidades")
          .select("*")
          .eq("titular_id", titular.id)
          .is("dependente_id", null)
          .eq("ano", selectedAno);
        mensalidades = mens || [];

        const { data: coparts } = await supabase
          .from("coparticipacoes")
          .select("*, coparticipacao_itens(*)")
          .eq("titular_id", titular.id)
          .is("dependente_id", null)
          .eq("ano", selectedAno);
        coparticipacoes = coparts || [];
      } else if (dependente) {
        nome = dependente.nome;

        const { data: mens } = await supabase
          .from("mensalidades")
          .select("*")
          .eq("dependente_id", dependente.id)
          .eq("ano", selectedAno);
        mensalidades = mens || [];

        const { data: coparts } = await supabase
          .from("coparticipacoes")
          .select("*, coparticipacao_itens(*)")
          .eq("dependente_id", dependente.id)
          .eq("ano", selectedAno);
        coparticipacoes = coparts || [];
      }

      return new Response(
        JSON.stringify({
          success: true,
          nome,
          cpf: cleanCpf,
          ano: selectedAno,
          mensalidades,
          coparticipacoes,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List beneficiaries with CPF (for admin password management)
    if (action === "list-beneficiarios") {
      const { data: titulares } = await supabase
        .from("titulares")
        .select("id, nome, cpf")
        .not("cpf", "is", null)
        .order("nome");

      const { data: dependentes } = await supabase
        .from("dependentes")
        .select("id, nome, cpf, titular_id")
        .not("cpf", "is", null)
        .order("nome");

      const { data: senhas } = await supabase
        .from("beneficiario_senhas")
        .select("cpf");

      const cpfsComSenha = new Set((senhas || []).map((s: any) => s.cpf));

      const beneficiarios = [
        ...(titulares || []).map((t: any) => ({
          nome: t.nome,
          cpf: t.cpf,
          tipo: "Titular",
          temSenha: cpfsComSenha.has(t.cpf),
        })),
        ...(dependentes || []).map((d: any) => ({
          nome: d.nome,
          cpf: d.cpf,
          tipo: "Dependente",
          temSenha: cpfsComSenha.has(d.cpf),
        })),
      ];

      return new Response(JSON.stringify({ beneficiarios }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
