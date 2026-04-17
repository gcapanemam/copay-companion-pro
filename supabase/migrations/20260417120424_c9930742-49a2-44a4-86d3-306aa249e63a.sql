-- Tabela de comandos pendentes que serão entregues ao equipamento na próxima requisição /push
CREATE TABLE IF NOT EXISTS public.controlid_comandos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES public.equipamentos_ponto(id) ON DELETE CASCADE,
  device_id_externo TEXT,
  uuid TEXT,
  verb TEXT NOT NULL DEFAULT 'POST',
  endpoint TEXT NOT NULL,
  body JSONB,
  query_string TEXT,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | enviado | concluido | erro
  enviado_em TIMESTAMPTZ,
  resultado JSONB,
  erro TEXT,
  concluido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controlid_comandos_equip_status
  ON public.controlid_comandos(equipamento_id, status, created_at);

ALTER TABLE public.controlid_comandos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage controlid_comandos"
  ON public.controlid_comandos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Histórico bruto das requisições recebidas (para debug/auditoria)
CREATE TABLE IF NOT EXISTS public.controlid_push_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id UUID REFERENCES public.equipamentos_ponto(id) ON DELETE SET NULL,
  device_id_externo TEXT,
  tipo TEXT NOT NULL, -- 'push' | 'result' | 'marcacao'
  metodo TEXT,
  query JSONB,
  body JSONB,
  resposta JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_controlid_push_log_equip
  ON public.controlid_push_log(equipamento_id, created_at DESC);

ALTER TABLE public.controlid_push_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read controlid_push_log"
  ON public.controlid_push_log FOR SELECT TO authenticated
  USING (true);

-- Coluna para mapear o deviceId que o equipamento envia ao endpoint Push
ALTER TABLE public.equipamentos_ponto
  ADD COLUMN IF NOT EXISTS device_id_externo TEXT;

CREATE INDEX IF NOT EXISTS idx_equipamentos_ponto_device_id_externo
  ON public.equipamentos_ponto(device_id_externo);