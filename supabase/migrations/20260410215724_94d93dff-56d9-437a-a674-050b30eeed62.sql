
-- Tarefas
CREATE TABLE public.tarefas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  tipo_destinatario text NOT NULL DEFAULT 'funcionario',
  valor_destinatario text NOT NULL,
  data_prevista date,
  status text NOT NULL DEFAULT 'pendente',
  criado_por text,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select tarefas" ON public.tarefas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update tarefas" ON public.tarefas FOR UPDATE TO anon USING (true);
CREATE POLICY "Authenticated can manage tarefas" ON public.tarefas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tarefa fotos
CREATE TABLE public.tarefa_fotos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  foto_url text NOT NULL,
  tipo text NOT NULL DEFAULT 'descricao',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select tarefa_fotos" ON public.tarefa_fotos FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert tarefa_fotos" ON public.tarefa_fotos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can manage tarefa_fotos" ON public.tarefa_fotos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tarefa atualizações
CREATE TABLE public.tarefa_atualizacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  tipo text NOT NULL DEFAULT 'pendencia',
  conteudo text,
  status_anterior text,
  status_novo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefa_atualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select tarefa_atualizacoes" ON public.tarefa_atualizacoes FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert tarefa_atualizacoes" ON public.tarefa_atualizacoes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can manage tarefa_atualizacoes" ON public.tarefa_atualizacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('tarefas-fotos', 'tarefas-fotos', true);

CREATE POLICY "Anyone can view tarefa fotos" ON storage.objects FOR SELECT USING (bucket_id = 'tarefas-fotos');
CREATE POLICY "Anyone can upload tarefa fotos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tarefas-fotos');
CREATE POLICY "Authenticated can manage tarefa fotos" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'tarefas-fotos') WITH CHECK (bucket_id = 'tarefas-fotos');
