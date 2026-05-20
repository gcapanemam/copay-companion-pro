-- Drop old chat tables
DROP TABLE IF EXISTS public.chat_mensagem_status CASCADE;
DROP TABLE IF EXISTS public.chat_mensagens CASCADE;
DROP TABLE IF EXISTS public.chat_membros CASCADE;
DROP TABLE IF EXISTS public.chat_google_links CASCADE;
DROP TABLE IF EXISTS public.chat_conversas CASCADE;

-- Encryption key helper (same pattern as equipamentos_ponto)
CREATE OR REPLACE FUNCTION public._google_chat_enc_key()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $$
  SELECT encode(extensions.digest('google-chat-key::' || current_database(), 'sha256'), 'hex');
$$;

-- Tokens table
CREATE TABLE public.google_chat_tokens (
  cpf text PRIMARY KEY,
  google_email text NOT NULL,
  refresh_token_cripto text NOT NULL,
  scopes text,
  conectado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_chat_tokens ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated access — only service role (edge functions) reads/writes
-- Frontend must go through edge functions

-- Helper functions (SECURITY DEFINER) so edge functions can save/read tokens
CREATE OR REPLACE FUNCTION public.salvar_google_chat_token(
  p_cpf text,
  p_email text,
  p_refresh_token text,
  p_scopes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  v_cripto text;
BEGIN
  v_cripto := encode(
    extensions.pgp_sym_encrypt(p_refresh_token, public._google_chat_enc_key()),
    'base64'
  );
  INSERT INTO public.google_chat_tokens (cpf, google_email, refresh_token_cripto, scopes, conectado_em, updated_at)
  VALUES (p_cpf, p_email, v_cripto, p_scopes, now(), now())
  ON CONFLICT (cpf) DO UPDATE SET
    google_email = EXCLUDED.google_email,
    refresh_token_cripto = EXCLUDED.refresh_token_cripto,
    scopes = EXCLUDED.scopes,
    conectado_em = now(),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_google_chat_refresh_token(p_cpf text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  v_cripto text;
BEGIN
  SELECT refresh_token_cripto INTO v_cripto FROM public.google_chat_tokens WHERE cpf = p_cpf;
  IF v_cripto IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(v_cripto, 'base64'), public._google_chat_enc_key());
END;
$$;