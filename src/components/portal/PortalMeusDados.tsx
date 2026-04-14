import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Briefcase, MapPin, Building, CreditCard } from "lucide-react";

interface PortalMeusDadosProps {
  admissao: any | null;
  nome: string;
  cpf: string;
}

const formatCpf = (cpf: string) => {
  const digits = cpf.replace(/\D/g, "");
  if (!digits || digits.length > 11) return cpf;
  const normalized = digits.padStart(11, "0");
  return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`;
};

const Field = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
};

export const PortalMeusDados = ({ admissao, nome, cpf }: PortalMeusDadosProps) => {
  if (!admissao) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Dados pessoais ainda não cadastrados.
        </CardContent>
      </Card>
    );
  }

  const dados = admissao.dados || {};

  return (
    <div className="space-y-4">
      {/* Foto + Info básica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" />Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            {admissao.foto_url && (
              <img src={admissao.foto_url} alt="Foto" className="w-24 h-24 rounded-lg object-cover border" />
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
              <Field label="Nome completo" value={admissao.nome_completo} />
              <Field label="CPF" value={formatCpf(admissao.cpf)} />
              <Field label="RG" value={admissao.rg} />
              <Field label="Data de nascimento" value={admissao.data_nascimento} />
              <Field label="Sexo" value={admissao.sexo} />
              <Field label="Estado civil" value={admissao.estado_civil} />
              <Field label="Escolaridade" value={admissao.escolaridade} />
              <Field label="Local de nascimento" value={admissao.local_nascimento} />
              <Field label="Nome da mãe" value={admissao.nome_mae} />
              <Field label="Nome do pai" value={admissao.nome_pai} />
              <Field label="E-mail" value={admissao.email} />
              <Field label="Telefone" value={admissao.telefone} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profissional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5" />Dados Profissionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Função" value={admissao.funcao} />
            <Field label="Departamento" value={admissao.departamento} />
            <Field label="Unidade" value={admissao.unidade} />
            <Field label="Horário de trabalho" value={admissao.horario_trabalho} />
            <Field label="1º dia de trabalho" value={admissao.primeiro_dia_trabalho} />
            <Field label="Nº PIS" value={admissao.numero_pis} />
            <Field label="CTPS" value={admissao.numero_ctps} />
            <Field label="Série CTPS" value={admissao.serie_ctps} />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" />Endereço</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Endereço" value={admissao.endereco} />
            <Field label="Bairro" value={admissao.bairro} />
            <Field label="CEP" value={admissao.cep} />
          </div>
        </CardContent>
      </Card>

      {/* Bancários */}
      {admissao.dados_bancarios && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5" />Dados Bancários</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{admissao.dados_bancarios}</p>
          </CardContent>
        </Card>
      )}

      {/* Campos dinâmicos */}
      {Object.keys(dados).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Building className="h-5 w-5" />Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(dados).map(([key, value]) => {
                if (!value || typeof value === "object") return null;
                const fixedKeys = ["nome_completo","cpf","rg","data_nascimento","sexo","estado_civil","escolaridade","local_nascimento","nome_mae","nome_pai","email","telefone","funcao","departamento","unidade","horario_trabalho","primeiro_dia_trabalho","numero_pis","numero_ctps","serie_ctps","endereco","bairro","cep","dados_bancarios","foto_url","cor","data_expedicao_rg","titulo_eleitor","data_cadastro_pis","emissao_ctps","nome_conjuge","cpf_conjuge","primeiro_emprego","vale_transporte","detalhes_vale_transporte","observacoes","plano_escolhido","interesse_plano","cpf_dependentes","dependentes_ir"];
                if (fixedKeys.includes(key)) return null;
                return <Field key={key} label={key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} value={String(value)} />;
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
