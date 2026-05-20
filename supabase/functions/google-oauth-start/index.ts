import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SCOPES = [
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function signState(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const data = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
  return `${data}.${b64url(sig)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { cpf, return_to } = await req.json();
    if (!cpf || typeof cpf !== 'string') {
      return new Response(JSON.stringify({ error: 'cpf obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!clientId) throw new Error('GOOGLE_OAUTH_CLIENT_ID não configurado');

    const supaUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supaUrl}/functions/v1/google-oauth-callback`;

    const state = await signState({ cpf, return_to: return_to || '', t: Date.now() }, secret);

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPES);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);
    url.searchParams.set('include_granted_scopes', 'true');

    return new Response(JSON.stringify({ url: url.toString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
