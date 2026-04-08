
ALTER TABLE public.admissoes ADD COLUMN foto_url TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('funcionarios-fotos', 'funcionarios-fotos', true);

CREATE POLICY "Public can view funcionarios fotos" ON storage.objects FOR SELECT USING (bucket_id = 'funcionarios-fotos');
CREATE POLICY "Authenticated can upload funcionarios fotos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'funcionarios-fotos');
CREATE POLICY "Authenticated can update funcionarios fotos" ON storage.objects FOR UPDATE USING (bucket_id = 'funcionarios-fotos');
CREATE POLICY "Authenticated can delete funcionarios fotos" ON storage.objects FOR DELETE USING (bucket_id = 'funcionarios-fotos');
