
-- Comunicados table
CREATE TABLE public.comunicados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo_destinatario TEXT NOT NULL DEFAULT 'todos', -- todos, unidade, departamento, selecionados
  valor_destinatario TEXT, -- nome da unidade ou departamento quando aplicável
  criado_por TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select comunicados" ON public.comunicados FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage comunicados" ON public.comunicados FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Destinatários específicos (quando tipo = selecionados)
CREATE TABLE public.comunicado_destinatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id UUID NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comunicado_destinatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select comunicado_destinatarios" ON public.comunicado_destinatarios FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage comunicado_destinatarios" ON public.comunicado_destinatarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Leituras / confirmações
CREATE TABLE public.comunicado_leituras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comunicado_id UUID NOT NULL REFERENCES public.comunicados(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  visualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comunicado_id, cpf)
);

ALTER TABLE public.comunicado_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select comunicado_leituras" ON public.comunicado_leituras FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert comunicado_leituras" ON public.comunicado_leituras FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update comunicado_leituras" ON public.comunicado_leituras FOR UPDATE TO anon USING (true);
CREATE POLICY "Authenticated can manage comunicado_leituras" ON public.comunicado_leituras FOR ALL TO authenticated USING (true) WITH CHECK (true);
