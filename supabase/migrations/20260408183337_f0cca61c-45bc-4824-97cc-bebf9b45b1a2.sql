
CREATE TABLE public.admissao_campos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campo_nome TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'text',
  opcoes TEXT[] DEFAULT '{}',
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  grupo TEXT NOT NULL DEFAULT 'Geral',
  placeholder TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admissao_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admissao_campos"
ON public.admissao_campos FOR SELECT TO anon USING (true);

CREATE POLICY "Authenticated users can manage admissao_campos"
ON public.admissao_campos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Alterar tabela admissoes para usar JSONB em vez de colunas fixas
ALTER TABLE public.admissoes ADD COLUMN dados JSONB DEFAULT '{}';

-- Inserir campos padrão
INSERT INTO public.admissao_campos (campo_nome, label, tipo, opcoes, obrigatorio, ativo, ordem, grupo, placeholder) VALUES
('unidade', 'Unidade', 'select', '{"Bairro Santo Agostinho","Bairro Funcionários","Bairro Savassi","Outra"}', false, true, 1, 'Dados Pessoais', 'Selecione a unidade'),
('nome_completo', 'Nome Completo', 'text', '{}', true, true, 2, 'Dados Pessoais', ''),
('data_nascimento', 'Data de Nascimento', 'date', '{}', false, true, 3, 'Dados Pessoais', ''),
('cpf', 'CPF', 'cpf', '{}', true, true, 4, 'Dados Pessoais', '000.000.000-00'),
('rg', 'RG', 'text', '{}', false, true, 5, 'Dados Pessoais', ''),
('data_expedicao_rg', 'Data Expedição RG', 'date', '{}', false, true, 6, 'Dados Pessoais', ''),
('sexo', 'Sexo', 'select', '{"Masculino","Feminino"}', false, true, 7, 'Dados Pessoais', 'Selecione'),
('cor', 'Cor/Raça', 'select', '{"Branca","Preta","Parda","Amarela","Indígena"}', false, true, 8, 'Dados Pessoais', 'Selecione'),
('estado_civil', 'Estado Civil', 'select', '{"Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável"}', false, true, 9, 'Dados Pessoais', 'Selecione'),
('escolaridade', 'Grau de Escolaridade', 'select', '{"Ensino Fundamental Incompleto","Ensino Fundamental Completo","Ensino Médio Incompleto","Ensino Médio Completo","Ensino Superior Incompleto","Ensino Superior Completo","Pós-Graduação","Mestrado","Doutorado"}', false, true, 10, 'Dados Pessoais', 'Selecione'),
('local_nascimento', 'Local de Nascimento (Cidade)', 'text', '{}', false, true, 11, 'Dados Pessoais', ''),
('nome_mae', 'Nome da Mãe', 'text', '{}', false, true, 12, 'Dados Pessoais', ''),
('nome_pai', 'Nome do Pai', 'text', '{}', false, true, 13, 'Dados Pessoais', ''),
('titulo_eleitor', 'Título de Eleitor', 'text', '{}', false, true, 14, 'Documentos', ''),
('numero_pis', 'Número do PIS', 'text', '{}', false, true, 15, 'Documentos', 'Somente números'),
('data_cadastro_pis', 'Data Cadastro PIS', 'date', '{}', false, true, 16, 'Documentos', ''),
('numero_ctps', 'Nº Carteira de Trabalho', 'text', '{}', false, true, 17, 'Documentos', ''),
('serie_ctps', 'Série da Carteira de Trabalho', 'text', '{}', false, true, 18, 'Documentos', ''),
('emissao_ctps', 'Emissão da Carteira de Trabalho', 'date', '{}', false, true, 19, 'Documentos', ''),
('endereco', 'Endereço Completo (rua, número)', 'text', '{}', false, true, 20, 'Endereço', ''),
('bairro', 'Bairro', 'text', '{}', false, true, 21, 'Endereço', ''),
('cep', 'CEP', 'cep', '{}', false, true, 22, 'Endereço', '00000-000'),
('funcao', 'Função que exercerá', 'text', '{}', false, true, 23, 'Dados Profissionais', ''),
('primeiro_dia_trabalho', 'Primeiro dia de trabalho', 'date', '{}', false, true, 24, 'Dados Profissionais', ''),
('horario_trabalho', 'Horário de Trabalho', 'text', '{}', false, true, 25, 'Dados Profissionais', 'Ex: 08:00 às 17:00'),
('primeiro_emprego', 'Primeiro Emprego?', 'boolean', '{}', false, true, 26, 'Dados Profissionais', ''),
('vale_transporte', 'Irá precisar de vale-transporte?', 'boolean', '{}', false, true, 27, 'Vale-Transporte', ''),
('detalhes_vale_transporte', 'Especificar ônibus e valores por dia', 'textarea', '{}', false, true, 28, 'Vale-Transporte', 'Ex: Linha 1404, R$ 9,00 por dia'),
('telefone', 'Telefone', 'text', '{}', false, true, 29, 'Contato e Dados Bancários', '(31) 99999-9999'),
('email', 'E-mail pessoal', 'email', '{}', false, true, 30, 'Contato e Dados Bancários', ''),
('dados_bancarios', 'Conta Banco Itaú (Agência e Conta) ou PIX', 'textarea', '{}', false, true, 31, 'Contato e Dados Bancários', 'Agência, Conta e Operação ou chave PIX'),
('nome_conjuge', 'Nome Completo do Cônjuge', 'text', '{}', false, true, 32, 'Cônjuge e Dependentes', ''),
('cpf_conjuge', 'CPF do Cônjuge', 'text', '{}', false, true, 33, 'Cônjuge e Dependentes', ''),
('dependentes_ir', 'Dependentes na declaração de IR? Detalhar.', 'textarea', '{}', false, true, 34, 'Cônjuge e Dependentes', ''),
('cpf_dependentes', 'CPF dos dependentes (maiores de 14 anos)', 'textarea', '{}', false, true, 35, 'Cônjuge e Dependentes', ''),
('interesse_plano', 'Tem interesse em contratar o plano?', 'select', '{"Sim","Não"}', false, true, 36, 'Plano de Saúde', 'Selecione'),
('plano_escolhido', 'Plano escolhido', 'select', '{"Enfermaria","Apartamento"}', false, true, 37, 'Plano de Saúde', 'Selecione o plano'),
('observacoes', 'Observações', 'textarea', '{}', false, true, 38, 'Observações', 'Informações adicionais...');
