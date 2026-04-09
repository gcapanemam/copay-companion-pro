
CREATE TABLE public.registros_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL,
  data DATE NOT NULL,
  entrada_1 TEXT,
  saida_1 TEXT,
  entrada_2 TEXT,
  saida_2 TEXT,
  entrada_3 TEXT,
  saida_3 TEXT,
  duracao TEXT,
  ocorrencia TEXT,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cpf, data)
);

ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select registros_ponto"
ON public.registros_ponto FOR SELECT TO anon
USING (true);

CREATE POLICY "Authenticated users can manage registros_ponto"
ON public.registros_ponto FOR ALL TO authenticated
USING (true) WITH CHECK (true);
