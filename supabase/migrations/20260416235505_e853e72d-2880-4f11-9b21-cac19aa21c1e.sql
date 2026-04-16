CREATE OR REPLACE FUNCTION public._equipamento_enc_key()
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_catalog
AS $$
  SELECT encode(extensions.digest('equipamento-ponto-key::' || current_database(), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.salvar_equipamento_ponto(
  p_id UUID,
  p_nome TEXT,
  p_modelo TEXT,
  p_numero_serie TEXT,
  p_descricao TEXT,
  p_ativo BOOLEAN,
  p_tipo_conexao TEXT,
  p_host TEXT,
  p_porta INTEGER,
  p_usuario TEXT,
  p_senha TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_id UUID;
  v_senha_cripto TEXT;
BEGIN
  IF p_senha IS NOT NULL AND length(p_senha) > 0 THEN
    v_senha_cripto := encode(
      extensions.pgp_sym_encrypt(p_senha, public._equipamento_enc_key()),
      'base64'
    );
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.equipamentos_ponto (
      nome, modelo, numero_serie, descricao, ativo,
      tipo_conexao, host, porta, usuario, senha_cripto
    ) VALUES (
      p_nome, p_modelo, p_numero_serie, p_descricao, COALESCE(p_ativo, true),
      COALESCE(p_tipo_conexao, 'idcloud_mysql'), p_host, p_porta, p_usuario, v_senha_cripto
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.equipamentos_ponto SET
      nome = p_nome,
      modelo = p_modelo,
      numero_serie = p_numero_serie,
      descricao = p_descricao,
      ativo = COALESCE(p_ativo, ativo),
      tipo_conexao = COALESCE(p_tipo_conexao, tipo_conexao),
      host = p_host,
      porta = p_porta,
      usuario = p_usuario,
      senha_cripto = COALESCE(v_senha_cripto, senha_cripto),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_senha_equipamento(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_cripto TEXT;
BEGIN
  SELECT senha_cripto INTO v_cripto FROM public.equipamentos_ponto WHERE id = p_id;
  IF v_cripto IS NULL THEN RETURN NULL; END IF;
  RETURN extensions.pgp_sym_decrypt(decode(v_cripto, 'base64'), public._equipamento_enc_key());
END;
$$;
