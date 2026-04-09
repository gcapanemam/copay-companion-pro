
-- Conversas (individuais e grupos)
CREATE TABLE public.chat_conversas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'individual',
  nome text,
  criado_por text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select chat_conversas" ON public.chat_conversas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert chat_conversas" ON public.chat_conversas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can manage chat_conversas" ON public.chat_conversas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Membros de cada conversa
CREATE TABLE public.chat_membros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(conversa_id, cpf)
);

ALTER TABLE public.chat_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select chat_membros" ON public.chat_membros FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert chat_membros" ON public.chat_membros FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can delete chat_membros" ON public.chat_membros FOR DELETE TO anon USING (true);
CREATE POLICY "Authenticated can manage chat_membros" ON public.chat_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mensagens
CREATE TABLE public.chat_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversa_id uuid NOT NULL REFERENCES public.chat_conversas(id) ON DELETE CASCADE,
  remetente_cpf text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select chat_mensagens" ON public.chat_mensagens FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert chat_mensagens" ON public.chat_mensagens FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can manage chat_mensagens" ON public.chat_mensagens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Status de leitura por destinatário
CREATE TABLE public.chat_mensagem_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mensagem_id uuid NOT NULL REFERENCES public.chat_mensagens(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  recebido_em timestamp with time zone,
  lido_em timestamp with time zone,
  UNIQUE(mensagem_id, cpf)
);

ALTER TABLE public.chat_mensagem_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select chat_mensagem_status" ON public.chat_mensagem_status FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert chat_mensagem_status" ON public.chat_mensagem_status FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update chat_mensagem_status" ON public.chat_mensagem_status FOR UPDATE TO anon USING (true);
CREATE POLICY "Authenticated can manage chat_mensagem_status" ON public.chat_mensagem_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagem_status;
