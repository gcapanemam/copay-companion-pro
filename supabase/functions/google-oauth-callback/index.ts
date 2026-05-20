import { createClient } from 'npm:@supabase/supabase-js@2';

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyState(state: string, secret: string): Promise<Record<string, unknown> | null> {
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(sig), enc.encode(data));
  if (!ok) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlDecode(data))); } catch { return null; }
}

function htmlRedirect(to: string, msg: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${msg}</title><script>window.location.replace(${JSON.stringify(to)});</script><p>${msg}... <a href="${to}">Voltar</a></p>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const redirectUri = `${supaUrl}/functions/v1/google-oauth-callback`;

  if (error) return new Response(`Erro do Google: ${error}`, { status: 400 });
  if (!code || !state) return new Response('Parâmetros faltando', { status: 400 });
  if (!clientId || !clientSecret) return new Response('OAuth não configurado', { status: 500 });

  const parsed = await verifyState(state, serviceKey);
  if (!parsed) return new Response('State inválido', { status: 400 });
  const cpf = String(parsed.cpf || '');
  const returnTo = String(parsed.return_to || '/');
  if (!cpf) return new Response('CPF ausente no state', { status: 400 });

  try {
    // Exchange code -> tokens
    const tokRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tok = await tokRes.json();
    if (!tokRes.ok) throw new Error(`Token exchange: ${JSON.stringify(tok)}`);
    const refreshToken = tok.refresh_token as string | undefined;
    const accessToken = tok.access_token as string;
    const scopes = (tok.scope as string) || '';
    if (!refreshToken) throw new Error('Google não devolveu refresh_token. Revogue acesso em myaccount.google.com/permissions e tente de novo.');

    // Pega email do usuário
    const uiRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ui = await uiRes.json();
    const email = (ui.email as string) || '';
    if (!email) throw new Error('Não foi possível obter o e-mail');

    const supa = createClient(supaUrl, serviceKey);
    const { error: rpcErr } = await supa.rpc('salvar_google_chat_token', {
      p_cpf: cpf,
      p_email: email,
      p_refresh_token: refreshToken,
      p_scopes: scopes,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    const target = returnTo || '/';
    return htmlRedirect(target, 'Conta Google conectada');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Falha ao concluir OAuth: ${msg}`, { status: 500 });
  }
});
