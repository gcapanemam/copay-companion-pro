
-- Contracheques table
CREATE TABLE public.contracheques (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  arquivo_path text NOT NULL,
  nome_arquivo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.contracheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage contracheques" ON public.contracheques FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select contracheques" ON public.contracheques FOR SELECT TO anon USING (true);

-- EPIs table
CREATE TABLE public.epis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  tipo_epi text NOT NULL,
  data_entrega date NOT NULL,
  data_validade date,
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.epis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage epis" ON public.epis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select epis" ON public.epis FOR SELECT TO anon USING (true);

-- Vale Transporte table
CREATE TABLE public.vale_transporte (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  mes integer NOT NULL,
  ano integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  quantidade_passagens integer,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.vale_transporte ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vale_transporte" ON public.vale_transporte FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select vale_transporte" ON public.vale_transporte FOR SELECT TO anon USING (true);

-- Faltas table
CREATE TABLE public.faltas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  data_falta date NOT NULL,
  tipo text NOT NULL DEFAULT 'falta',
  justificativa text,
  abonada boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.faltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage faltas" ON public.faltas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select faltas" ON public.faltas FOR SELECT TO anon USING (true);

-- Storage bucket for contracheques PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('contracheques', 'contracheques', false);

CREATE POLICY "Authenticated users can upload contracheques" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contracheques');
CREATE POLICY "Authenticated users can update contracheques" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contracheques');
CREATE POLICY "Authenticated users can delete contracheques" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'contracheques');
CREATE POLICY "Public can read contracheques" ON storage.objects FOR SELECT USING (bucket_id = 'contracheques');
