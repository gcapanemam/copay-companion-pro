-- Tabela de equipamentos de ponto
CREATE TABLE public.equipamentos_ponto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  modelo TEXT,
  numero_serie TEXT UNIQUE,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_nsr BIGINT NOT NULL DEFAULT 0,
  ultima_sincronizacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipamentos_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select equipamentos_ponto"
  ON public.equipamentos_ponto FOR SELECT
  TO anon USING (true);

CREATE POLICY "Authenticated can manage equipamentos_ponto"
  ON public.equipamentos_ponto FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_equipamentos_ponto_updated_at
  BEFORE UPDATE ON public.equipamentos_ponto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona colunas em registros_ponto para integração
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES public.equipamentos_ponto(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nsr BIGINT,
  ADD COLUMN IF NOT EXISTS data_hora TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS tipo_marcacao TEXT;

-- Índice único para evitar duplicação por NSR/equipamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_registros_ponto_nsr_equipamento
  ON public.registros_ponto(equipamento_id, nsr)
  WHERE equipamento_id IS NOT NULL AND nsr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_registros_ponto_cpf_data ON public.registros_ponto(cpf, data);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_data_hora ON public.registros_ponto(data_hora DESC);