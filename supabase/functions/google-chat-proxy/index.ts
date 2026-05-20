import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supaUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supa = createClient(supaUrl, serviceKey);

async function getAccessToken(cpf: string): Promise<{ token: string; email: string } | null> {
  const { data: row } = await supa.from('google_chat_tokens').select('google_email').eq('cpf', cpf).maybeSingle();
  if (!row) return null;
  const { data: refresh, error } = await supa.rpc('obter_google_chat_refresh_token', { p_cpf: cpf });
  if (error || !refresh) return null;

  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: String(refresh),
      grant_type: 'refresh_token',
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`refresh: ${JSON.stringify(j)}`);
  return { token: j.access_token as string, email: row.google_email };
}

async function callChat(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const r = await fetch(`https://chat.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let json: unknown;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!r.ok) throw new Error(`Chat API ${r.status}: ${text}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const cpf = String(body.cpf || '');
    const op = String(body.op || '');
    if (!cpf || !op) return new Response(JSON.stringify({ error: 'cpf e op obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (op === 'status') {
      const { data: row } = await supa.from('google_chat_tokens').select('google_email, conectado_em').eq('cpf', cpf).maybeSingle();
      return new Response(JSON.stringify({ connected: !!row, email: row?.google_email || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (op === 'disconnect') {
      await supa.from('google_chat_tokens').delete().eq('cpf', cpf);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const auth = await getAccessToken(cpf);
    if (!auth) return new Response(JSON.stringify({ error: 'not_connected' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let result: unknown;
    if (op === 'listSpaces') {
      const pageToken = body.pageToken ? `&pageToken=${encodeURIComponent(body.pageToken)}` : '';
      result = await callChat(auth.token, `spaces?pageSize=100${pageToken}`);
    } else if (op === 'listMessages') {
      const space = String(body.space || '');
      if (!space.startsWith('spaces/')) throw new Error('space inválido');
      const pageToken = body.pageToken ? `&pageToken=${encodeURIComponent(body.pageToken)}` : '';
      result = await callChat(auth.token, `${space}/messages?pageSize=50&orderBy=createTime desc${pageToken}`);
    } else if (op === 'sendMessage') {
      const space = String(body.space || '');
      const text = String(body.text || '');
      if (!space.startsWith('spaces/') || !text.trim()) throw new Error('space e text obrigatórios');
      result = await callChat(auth.token, `${space}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
    } else if (op === 'getSpace') {
      const space = String(body.space || '');
      if (!space.startsWith('spaces/')) throw new Error('space inválido');
      result = await callChat(auth.token, space);
    } else if (op === 'listMembers') {
      const space = String(body.space || '');
      if (!space.startsWith('spaces/')) throw new Error('space inválido');
      result = await callChat(auth.token, `${space}/members?pageSize=100`);
    } else {
      throw new Error(`op desconhecido: ${op}`);
    }

    return new Response(JSON.stringify({ data: result, email: auth.email }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
