
-- Create public bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('funcionarios-documentos', 'funcionarios-documentos', true);

-- Storage policies for the bucket
CREATE POLICY "Public can view funcionarios-documentos"
ON storage.objects FOR SELECT
USING (bucket_id = 'funcionarios-documentos');

CREATE POLICY "Authenticated can manage funcionarios-documentos"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'funcionarios-documentos')
WITH CHECK (bucket_id = 'funcionarios-documentos');

CREATE POLICY "Anon can upload funcionarios-documentos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'funcionarios-documentos');

-- Create table to track migrated documents
CREATE TABLE public.funcionario_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  drive_url_original TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funcionario_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select funcionario_documentos"
ON public.funcionario_documentos FOR SELECT
TO anon
USING (true);

CREATE POLICY "Authenticated can manage funcionario_documentos"
ON public.funcionario_documentos FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anon can insert funcionario_documentos"
ON public.funcionario_documentos FOR INSERT
TO anon
WITH CHECK (true);
