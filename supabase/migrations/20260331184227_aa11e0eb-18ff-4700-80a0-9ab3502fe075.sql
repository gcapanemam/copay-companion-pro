
-- Create titulares table
CREATE TABLE public.titulares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  matricula TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.titulares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage titulares" ON public.titulares FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create dependentes table
CREATE TABLE public.dependentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titular_id UUID NOT NULL REFERENCES public.titulares(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  matricula TEXT,
  cpf TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage dependentes" ON public.dependentes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create mensalidades table
CREATE TABLE public.mensalidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titular_id UUID NOT NULL REFERENCES public.titulares(id) ON DELETE CASCADE,
  dependente_id UUID REFERENCES public.dependentes(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(titular_id, dependente_id, mes, ano)
);

ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage mensalidades" ON public.mensalidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create coparticipacoes table
CREATE TABLE public.coparticipacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titular_id UUID NOT NULL REFERENCES public.titulares(id) ON DELETE CASCADE,
  dependente_id UUID REFERENCES public.dependentes(id) ON DELETE CASCADE,
  nome_usuario TEXT NOT NULL,
  data_utilizacao DATE,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coparticipacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage coparticipacoes" ON public.coparticipacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create coparticipacao_itens table
CREATE TABLE public.coparticipacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coparticipacao_id UUID NOT NULL REFERENCES public.coparticipacoes(id) ON DELETE CASCADE,
  procedimento TEXT NOT NULL,
  local TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coparticipacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage coparticipacao_itens" ON public.coparticipacao_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create uploads table
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('mensalidade', 'coparticipacao')),
  nome_arquivo TEXT NOT NULL,
  data_upload TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage uploads" ON public.uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_titulares_updated_at BEFORE UPDATE ON public.titulares FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dependentes_updated_at BEFORE UPDATE ON public.dependentes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
