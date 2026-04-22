import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ChevronDown, ExternalLink, KeyRound, Database, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      navigate("/");
    } catch (err: any) {
      toast({ title: "Erro no login", description: err.message || "Credenciais inválidas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
              <Activity className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Portal RH</CardTitle>
            <p className="text-sm text-muted-foreground">Acesso administrativo</p>
          </CardHeader>
          <CardContent className="pt-2">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@empresa.com.br" required className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required className="h-11" />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <div className="text-center">
                <a href="/minha-area" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  Portal do Funcionário →
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0">
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 rounded-lg transition-colors">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Como conectar ao Supabase?</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Siga o passo a passo abaixo para criar/visualizar seu projeto e obter as credenciais (URL e anon key):
                </p>

                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <p className="font-medium">Criar conta / acessar Supabase</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Acesse{" "}
                        <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          supabase.com <ExternalLink className="h-3 w-3" />
                        </a>{" "}
                        e clique em <strong>Start your project</strong>. Faça login com GitHub, Google ou e-mail.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <p className="font-medium">Criar um novo projeto</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        No dashboard, clique em <strong>New Project</strong>. Escolha uma organização, defina nome, senha do banco e a região mais próxima. Aguarde alguns minutos até o projeto ficar pronto.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <p className="font-medium">Visualizar projeto existente</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Se já possui um projeto, basta selecioná-lo no dashboard em{" "}
                        <a href="https://supabase.com/dashboard/projects" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          supabase.com/dashboard <ExternalLink className="h-3 w-3" />
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</div>
                    <div>
                      <p className="font-medium">Obter URL e Anon Key</p>
                      <p className="text-muted-foreground text-xs mt-1 mb-2">
                        Dentro do projeto, vá em <strong>Project Settings</strong> (ícone de engrenagem) → <strong>API</strong>. Copie:
                      </p>
                      <div className="space-y-2 ml-1">
                        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                          <Globe className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Project URL</p>
                            <p className="text-xs text-muted-foreground">Ex: https://xxxxx.supabase.co</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                          <KeyRound className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium">anon / public key</p>
                            <p className="text-xs text-muted-foreground">Chave pública usada no front-end</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</div>
                    <div>
                      <p className="font-medium">Conectar no app</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Cole as credenciais no arquivo <code className="px-1 py-0.5 rounded bg-muted text-xs">.env</code> nas variáveis{" "}
                        <code className="px-1 py-0.5 rounded bg-muted text-xs">VITE_SUPABASE_URL</code> e{" "}
                        <code className="px-1 py-0.5 rounded bg-muted text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                  <Database className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Dica:</strong> Nunca compartilhe a <strong>service_role key</strong>. Use apenas a <strong>anon key</strong> no front-end.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  );
};

export default Login;
