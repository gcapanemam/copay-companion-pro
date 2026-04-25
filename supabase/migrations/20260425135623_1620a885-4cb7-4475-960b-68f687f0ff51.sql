-- Tabela de cartões de Vale-Transporte vinculados a funcionários
CREATE TABLE public.vt_cartoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_cartao TEXT NOT NULL UNIQUE,
  cpf TEXT NOT NULL,
  titular_nome TEXT,
  observacao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_vt_cartoes_cpf ON public.vt_cartoes(cpf);

ALTER TABLE public.vt_cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select vt_cartoes" ON public.vt_cartoes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can manage vt_cartoes" ON public.vt_cartoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_vt_cartoes_updated_at
  BEFORE UPDATE ON public.vt_cartoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de usos detalhados do Vale-Transporte (cada passagem)
CREATE TABLE public.vt_usos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_cartao TEXT NOT NULL,
  cpf TEXT,
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  linha TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  operadora TEXT,
  tipo_tarifa TEXT,
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (numero_cartao, data_hora, linha, valor)
);

CREATE INDEX idx_vt_usos_cpf ON public.vt_usos(cpf);
CREATE INDEX idx_vt_usos_cartao ON public.vt_usos(numero_cartao);
CREATE INDEX idx_vt_usos_data ON public.vt_usos(data_hora);

ALTER TABLE public.vt_usos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select vt_usos" ON public.vt_usos
  FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated can manage vt_usos" ON public.vt_usos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);