-- ============================================================
-- Sistema de Ponto Eletrônico — Schema CLT
-- ============================================================

-- 1) JORNADAS DE TRABALHO
CREATE TABLE public.jornadas_trabalho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'fixa',
  carga_diaria_min INTEGER NOT NULL DEFAULT 480,
  carga_semanal_min INTEGER NOT NULL DEFAULT 2640,
  intervalo_obrigatorio_min INTEGER NOT NULL DEFAULT 60,
  tolerancia_min INTEGER NOT NULL DEFAULT 10,
  dias_semana JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  entrada_padrao TEXT,
  saida_padrao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jornadas_trabalho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select jornadas_trabalho" ON public.jornadas_trabalho
  FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage jornadas_trabalho" ON public.jornadas_trabalho
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_jornadas_trabalho_updated_at
  BEFORE UPDATE ON public.jornadas_trabalho
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) VINCULAÇÃO FUNCIONÁRIO ↔ JORNADA
CREATE TABLE public.funcionario_jornada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT NOT NULL,
  jornada_id UUID NOT NULL REFERENCES public.jornadas_trabalho(id) ON DELETE CASCADE,
  vigencia_inicio DATE NOT NULL,
  vigencia_fim DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_func_jornada_cpf ON public.funcionario_jornada(cpf);
CREATE INDEX idx_func_jornada_vigencia ON public.funcionario_jornada(cpf, vigencia_inicio, vigencia_fim);

ALTER TABLE public.funcionario_jornada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select funcionario_jornada" ON public.funcionario_jornada
  FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage funcionario_jornada" ON public.funcionario_jornada
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) CONFIGURAÇÃO DE HORAS EXTRAS (singleton)
CREATE TABLE public.config_horas_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adicional_50_pct NUMERIC NOT NULL DEFAULT 50,
  adicional_100_pct NUMERIC NOT NULL DEFAULT 100,
  tolerancia_min INTEGER NOT NULL DEFAULT 10,
  permite_banco_horas BOOLEAN NOT NULL DEFAULT true,
  expiracao_banco_meses INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.config_horas_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select config_horas_extras" ON public.config_horas_extras
  FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage config_horas_extras" ON public.config_horas_extras
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_config_horas_extras_updated_at
  BEFORE UPDATE ON public.config_horas_extras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.config_horas_extras (adicional_50_pct, adicional_100_pct, tolerancia_min, permite_banco_horas, expiracao_banco_meses)
VALUES (50, 100, 10, true, 6);

-- 4) BANCO DE HORAS — MOVIMENTOS
CREATE TABLE public.banco_horas_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT NOT NULL,
  data_referencia DATE NOT NULL,
  minutos INTEGER NOT NULL,
  origem TEXT NOT NULL DEFAULT 'extra',
  descricao TEXT,
  registro_ponto_id UUID REFERENCES public.registros_ponto(id) ON DELETE SET NULL,
  expira_em DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_banco_horas_cpf ON public.banco_horas_movimentos(cpf);
CREATE INDEX idx_banco_horas_data ON public.banco_horas_movimentos(cpf, data_referencia);

ALTER TABLE public.banco_horas_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can select banco_horas_movimentos" ON public.banco_horas_movimentos
  FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can manage banco_horas_movimentos" ON public.banco_horas_movimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) AUDITORIA IMUTÁVEL DE REGISTROS DE PONTO
CREATE TABLE public.registros_ponto_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id UUID,
  cpf TEXT NOT NULL,
  data DATE NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  alterado_por TEXT,
  motivo TEXT,
  solicitacao_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_cpf ON public.registros_ponto_auditoria(cpf);
CREATE INDEX idx_audit_data ON public.registros_ponto_auditoria(cpf, data);
CREATE INDEX idx_audit_registro ON public.registros_ponto_auditoria(registro_id);

ALTER TABLE public.registros_ponto_auditoria ENABLE ROW LEVEL SECURITY;

-- Auditoria: somente INSERT e SELECT (imutável). NUNCA UPDATE/DELETE.
CREATE POLICY "Anyone can insert registros_ponto_auditoria" ON public.registros_ponto_auditoria
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read registros_ponto_auditoria" ON public.registros_ponto_auditoria
  FOR SELECT TO anon, authenticated USING (true);

-- 6) GEOLOCALIZAÇÃO opcional em registros_ponto
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS precisao_metros NUMERIC,
  ADD COLUMN IF NOT EXISTS endereco_aproximado TEXT;

-- 7) Atestado multi-dia em solicitacoes_ponto
ALTER TABLE public.solicitacoes_ponto
  ADD COLUMN IF NOT EXISTS data_fim DATE;

-- 8) TRIGGER: gravar diff em auditoria ao UPDATE em registros_ponto
CREATE OR REPLACE FUNCTION public.log_registros_ponto_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user TEXT;
BEGIN
  v_user := COALESCE(current_setting('request.jwt.claim.email', true), 'system');

  IF NEW.entrada_1 IS DISTINCT FROM OLD.entrada_1 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'entrada_1', OLD.entrada_1, NEW.entrada_1, v_user, NEW.motivo);
  END IF;
  IF NEW.saida_1 IS DISTINCT FROM OLD.saida_1 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'saida_1', OLD.saida_1, NEW.saida_1, v_user, NEW.motivo);
  END IF;
  IF NEW.entrada_2 IS DISTINCT FROM OLD.entrada_2 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'entrada_2', OLD.entrada_2, NEW.entrada_2, v_user, NEW.motivo);
  END IF;
  IF NEW.saida_2 IS DISTINCT FROM OLD.saida_2 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'saida_2', OLD.saida_2, NEW.saida_2, v_user, NEW.motivo);
  END IF;
  IF NEW.entrada_3 IS DISTINCT FROM OLD.entrada_3 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'entrada_3', OLD.entrada_3, NEW.entrada_3, v_user, NEW.motivo);
  END IF;
  IF NEW.saida_3 IS DISTINCT FROM OLD.saida_3 THEN
    INSERT INTO public.registros_ponto_auditoria(registro_id, cpf, data, campo, valor_anterior, valor_novo, alterado_por, motivo)
    VALUES (NEW.id, NEW.cpf, NEW.data, 'saida_3', OLD.saida_3, NEW.saida_3, v_user, NEW.motivo);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_registros_ponto_audit ON public.registros_ponto;
CREATE TRIGGER trg_log_registros_ponto_audit
  AFTER UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.log_registros_ponto_audit();

-- 9) Jornada padrão (8h, seg-sex)
INSERT INTO public.jornadas_trabalho (nome, tipo, carga_diaria_min, carga_semanal_min, intervalo_obrigatorio_min, tolerancia_min, dias_semana, entrada_padrao, saida_padrao, ativo)
VALUES ('Padrão 44h (Seg-Sex)', 'fixa', 480, 2640, 60, 10, '[1,2,3,4,5]'::jsonb, '08:00', '17:00', true);
