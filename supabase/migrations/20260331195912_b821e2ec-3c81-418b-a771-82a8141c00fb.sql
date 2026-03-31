
CREATE TABLE public.beneficiario_senhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL UNIQUE,
  senha_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficiario_senhas ENABLE ROW LEVEL SECURITY;

-- No public access - only via service role in edge functions
