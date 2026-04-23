CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.solicitacoes_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL,
  data DATE NOT NULL,
  campo TEXT NOT NULL,
  valor TEXT NOT NULL,
  tipo TEXT NOT NULL,
  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_em TIMESTAMPTZ,
  aprovado_por TEXT,
  rejeitado_em TIMESTAMPTZ,
  rejeitado_por TEXT,
  observacao_admin TEXT
);

ALTER TABLE public.solicitacoes_ponto ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_solicitacoes_ponto_cpf_data
  ON public.solicitacoes_ponto(cpf, data);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_ponto_status_created
  ON public.solicitacoes_ponto(status, created_at DESC);

CREATE POLICY "Anon can read solicitacoes_ponto"
  ON public.solicitacoes_ponto
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can create solicitacoes_ponto"
  ON public.solicitacoes_ponto
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated can manage solicitacoes_ponto"
  ON public.solicitacoes_ponto
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
