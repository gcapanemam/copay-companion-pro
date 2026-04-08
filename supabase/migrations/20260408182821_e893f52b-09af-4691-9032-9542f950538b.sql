
CREATE TABLE public.admissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unidade TEXT,
  nome_completo TEXT NOT NULL,
  data_nascimento TEXT,
  cpf TEXT NOT NULL,
  rg TEXT,
  data_expedicao_rg TEXT,
  titulo_eleitor TEXT,
  numero_pis TEXT,
  data_cadastro_pis TEXT,
  numero_ctps TEXT,
  serie_ctps TEXT,
  emissao_ctps TEXT,
  estado_civil TEXT,
  escolaridade TEXT,
  endereco TEXT,
  bairro TEXT,
  cep TEXT,
  nome_mae TEXT,
  nome_pai TEXT,
  local_nascimento TEXT,
  sexo TEXT,
  cor TEXT,
  primeiro_emprego BOOLEAN DEFAULT false,
  vale_transporte BOOLEAN DEFAULT false,
  horario_trabalho TEXT,
  detalhes_vale_transporte TEXT,
  telefone TEXT,
  dados_bancarios TEXT,
  email TEXT,
  funcao TEXT,
  primeiro_dia_trabalho TEXT,
  nome_conjuge TEXT,
  cpf_conjuge TEXT,
  dependentes_ir TEXT,
  cpf_dependentes TEXT,
  interesse_plano TEXT,
  plano_escolhido TEXT,
  observacoes TEXT
);

ALTER TABLE public.admissoes ENABLE ROW LEVEL SECURITY;

-- Funcionários podem inserir sem login
CREATE POLICY "Anyone can insert admissoes"
ON public.admissoes
FOR INSERT
TO anon
WITH CHECK (true);

-- Admin pode ver e gerenciar tudo
CREATE POLICY "Authenticated users can manage admissoes"
ON public.admissoes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Anon pode ver (para confirmação após envio)
CREATE POLICY "Anon can select admissoes"
ON public.admissoes
FOR SELECT
TO anon
USING (true);
