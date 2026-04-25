
-- Calendário (feriados, recessos, sábados letivos)
CREATE TABLE IF NOT EXISTS public.vt_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('feriado','recesso','sabado_letivo')),
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(data, tipo)
);
ALTER TABLE public.vt_calendario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select vt_calendario" ON public.vt_calendario FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage vt_calendario" ON public.vt_calendario FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Férias por funcionário
CREATE TABLE IF NOT EXISTS public.vt_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vt_ferias_cpf ON public.vt_ferias(cpf);
ALTER TABLE public.vt_ferias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select vt_ferias" ON public.vt_ferias FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage vt_ferias" ON public.vt_ferias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inconsistências detectadas
CREATE TABLE IF NOT EXISTS public.vt_inconsistencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uso_id uuid NOT NULL UNIQUE REFERENCES public.vt_usos(id) ON DELETE CASCADE,
  cpf text,
  numero_cartao text NOT NULL,
  data_hora timestamptz NOT NULL,
  linha text,
  valor numeric NOT NULL DEFAULT 0,
  regra text NOT NULL,
  detalhe text,
  justificativa text,
  justificada_em timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  decisao_por text,
  decisao_em timestamptz,
  observacao_admin text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vt_inc_cpf ON public.vt_inconsistencias(cpf);
CREATE INDEX IF NOT EXISTS idx_vt_inc_status ON public.vt_inconsistencias(status);
CREATE INDEX IF NOT EXISTS idx_vt_inc_data ON public.vt_inconsistencias(data_hora);
ALTER TABLE public.vt_inconsistencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon can select vt_inconsistencias" ON public.vt_inconsistencias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can update vt_inconsistencias" ON public.vt_inconsistencias FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can manage vt_inconsistencias" ON public.vt_inconsistencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
