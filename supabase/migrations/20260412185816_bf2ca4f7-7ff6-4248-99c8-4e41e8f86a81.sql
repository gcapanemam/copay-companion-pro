-- Settings table
CREATE TABLE public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL DEFAULT 'false',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read configuracoes" ON public.configuracoes FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage configuracoes" ON public.configuracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default 2FA setting
INSERT INTO public.configuracoes (chave, valor) VALUES ('dois_fatores_ativo', 'false');

-- 2FA codes table
CREATE TABLE public.codigos_2fa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  codigo text NOT NULL,
  expira_em timestamptz NOT NULL,
  usado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.codigos_2fa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can read codigos_2fa" ON public.codigos_2fa FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert codigos_2fa" ON public.codigos_2fa FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update codigos_2fa" ON public.codigos_2fa FOR UPDATE TO anon USING (true);
CREATE POLICY "Authenticated can manage codigos_2fa" ON public.codigos_2fa FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for quick lookup
CREATE INDEX idx_codigos_2fa_cpf_codigo ON public.codigos_2fa (cpf, codigo);