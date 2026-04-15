ALTER TABLE public.tarefa_atualizacoes ADD COLUMN resolvida boolean NOT NULL DEFAULT false;

CREATE POLICY "Anon can update tarefa_atualizacoes" ON public.tarefa_atualizacoes FOR UPDATE TO anon USING (true);