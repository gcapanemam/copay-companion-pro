import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Briefcase, MapPin, Building, CreditCard, FileText, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PortalMeusDadosProps {
  admissao: any | null;
  nome: string;
  cpf: string;
}

const formatCpf = (cpf: string) => {
  const digits = (cpf || "").replace(/\D/g, "");
  if (!digits || digits.length > 11) return cpf;
  const normalized = digits.padStart(11, "0");
  return `${normalized.slice(0, 3)}.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-${normalized.slice(9)}`;
};

const normalizeCpf = (cpf: string) => {
  const digits = (cpf || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(11, "0");
};

const getInitials = (name: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const formatTipoDoc = (tipo: string) =>
  (tipo || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

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
  const cpfNormalizado = normalizeCpf(cpf || admissao?.cpf || "");
  const cpfFormatado = formatCpf(cpfNormalizado);

  // Resolver URL pública da foto de perfil
  const fotoPublicUrl = useMemo(() => {
    const fotoPath = admissao?.foto_url;
    if (!fotoPath) return null;
    // Se já é uma URL absoluta, usa direto
    if (/^https?:\/\//i.test(fotoPath)) return fotoPath;
    const { data } = supabase.storage.from("funcionarios-fotos").getPublicUrl(fotoPath);
    return data?.publicUrl || null;
  }, [admissao?.foto_url]);

  // Buscar documentos do funcionário (importados do Drive ou enviados pelo admin)
  const { data: documentos = [] } = useQuery({
    queryKey: ["portal-funcionario-documentos", cpfNormalizado],
    queryFn: async () => {
      if (!cpfNormalizado) return [];
      // Busca por CPF normalizado e formatado para cobrir variações
      const { data, error } = await supabase
        .from("funcionario_documentos")
        .select("*")
        .or(`cpf.eq.${cpfNormalizado},cpf.eq.${cpfFormatado}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpfNormalizado,
  });

  const getDocPublicUrl = (path: string) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = supabase.storage.from("funcionarios-documentos").getPublicUrl(path);
    return data?.publicUrl || "";
  };

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
          <div className="flex flex-col sm:flex-row gap-6">
            <Avatar className="w-28 h-28 rounded-lg border">
              {fotoPublicUrl && <AvatarImage src={fotoPublicUrl} alt={nome} className="object-cover" />}
              <AvatarFallback className="rounded-lg text-2xl">{getInitials(admissao.nome_completo || nome)}</AvatarFallback>
            </Avatar>
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

      {/* Documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meus Documentos
            {documentos.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({documentos.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum documento disponível.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documentos.map((doc: any) => {
                const url = getDocPublicUrl(doc.arquivo_url);
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.nome_arquivo || doc.arquivo_url || "");
                return (
                  <div key={doc.id} className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {isImg && url ? (
                        <img src={url} alt={doc.nome_arquivo} className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{formatTipoDoc(doc.tipo_documento)}</p>
                      <p className="text-xs text-muted-foreground truncate">{doc.nome_arquivo}</p>
                    </div>
                    <div className="flex gap-1">
                      {url && (
                        <>
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Abrir">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Baixar">
                            <a href={url} download={doc.nome_arquivo}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
