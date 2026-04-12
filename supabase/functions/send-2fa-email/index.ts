const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, codigo, nome } = await req.json();
    if (!email || !codigo) {
      return new Response(JSON.stringify({ error: "Email e código são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured. 2FA code:", codigo, "for", email);
      return new Response(JSON.stringify({ error: "Serviço de e-mail não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; margin-bottom: 8px;">Código de Verificação</h2>
        <p style="color: #555; font-size: 14px;">Olá${nome ? `, ${nome}` : ""},</p>
        <p style="color: #555; font-size: 14px;">Seu código de verificação para acessar o Portal do Funcionário é:</p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">${codigo}</span>
        </div>
        <p style="color: #888; font-size: 12px;">Este código expira em 5 minutos. Se você não solicitou este código, ignore este e-mail.</p>
      </div>
    `;

    const gatewayUrl = "https://connector-gateway.lovable.dev/resend/emails";
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Portal RH <onboarding@resend.dev>",
        to: [email],
        subject: `${codigo} - Código de Verificação`,
        html,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: "Falha ao enviar e-mail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
