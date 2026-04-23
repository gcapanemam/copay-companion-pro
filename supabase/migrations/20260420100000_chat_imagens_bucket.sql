-- Chat imagens bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-imagens', 'chat-imagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view chat-imagens"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-imagens');

CREATE POLICY "Anyone can upload chat-imagens"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-imagens');

CREATE POLICY "Authenticated can manage chat-imagens"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'chat-imagens')
WITH CHECK (bucket_id = 'chat-imagens');
