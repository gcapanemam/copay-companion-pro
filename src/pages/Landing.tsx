import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Users, Clock, Bus, FileText, Heart, Stethoscope, ShieldCheck,
  Megaphone, ListTodo, MessageCircle, ArrowRight, CheckCircle2,
  Activity, Sparkles, LayoutDashboard, Smartphone, Lock, Zap,
} from "lucide-react";

const features = [
  { icon: Users, title: "Cadastro de Funcionários", desc: "Ficha completa, documentos, histórico funcional e dependentes em um só lugar." },
  { icon: Clock, title: "Ponto Eletrônico", desc: "Integração direta com relógio de ponto via arquivo AFD. Banco de horas e espelho automáticos." },
  { icon: Bus, title: "Vale Transporte", desc: "Controle de recargas, calendário de uso e detecção automática de inconsistências." },
  { icon: FileText, title: "Contracheques", desc: "Distribuição automática para o portal do colaborador, com histórico mensal e anual." },
  { icon: Heart, title: "Plano de Saúde", desc: "Titulares, dependentes, mensalidades e coparticipação detalhados por beneficiário." },
  { icon: Stethoscope, title: "Exames Periódicos", desc: "Agendamento e controle de validade dos ASOs, com alertas de vencimento." },
  { icon: ShieldCheck, title: "EPIs", desc: "Entregas, fichas e assinatura digital — em conformidade com a NR-6." },
  { icon: Megaphone, title: "Comunicados", desc: "Avisos com confirmação de leitura para garantir que toda a equipe foi informada." },
  { icon: ListTodo, title: "Tarefas", desc: "Atribuição de responsabilidades, prazos e acompanhamento de execução." },
  { icon: MessageCircle, title: "Chat Interno", desc: "Comunicação direta entre RH e colaboradores, sem precisar de WhatsApp." },
];

const faqs = [
  { q: "Preciso instalar algum software?", a: "Não. O Portal RH é 100% web — basta um navegador. Funciona em desktop, tablet e celular." },
  { q: "Funciona com qualquer relógio de ponto?", a: "Sim. Importamos o arquivo AFD (Portaria 671/MTE), padrão obrigatório para todos os REPs no Brasil." },
  { q: "Os dados ficam seguros?", a: "Sim. Infraestrutura em nuvem com criptografia, backups automáticos e conformidade com a LGPD." },
  { q: "Os funcionários têm acesso?", a: "Sim. Cada colaborador tem um portal próprio para ver contracheques, comunicados, tarefas e atualizar dados." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Portal RH</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
            <a href="#cta"><Button size="sm">Teste grátis</Button></a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
                <Sparkles className="h-3 w-3 text-primary" />
                A plataforma completa de RH para sua empresa
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
                Toda a gestão de RH em <span className="text-primary">um só lugar</span>.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                Cadastre funcionários, controle ponto, distribua contracheques, gerencie benefícios e converse com sua equipe — sem planilhas, sem retrabalho.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a href="#cta"><Button size="lg" className="w-full sm:w-auto">Começar agora <ArrowRight className="ml-1" /></Button></a>
                <a href="#funcionalidades"><Button size="lg" variant="outline" className="w-full sm:w-auto">Ver funcionalidades</Button></a>
              </div>
              <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Sem instalação</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Conforme LGPD</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Suporte humano</div>
              </div>
            </div>

            {/* Mock dashboard */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 to-transparent rounded-3xl blur-2xl" />
              <Card className="relative p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-destructive/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  <span className="ml-2 text-xs text-muted-foreground">portal-rh.app</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Users, label: "Funcionários", val: "248" },
                    { icon: Clock, label: "Ponto hoje", val: "98%" },
                    { icon: FileText, label: "Contracheques", val: "248" },
                    { icon: Megaphone, label: "Comunicados", val: "12" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border bg-muted/30 p-4">
                      <s.icon className="h-5 w-5 text-primary mb-2" />
                      <div className="text-2xl font-bold">{s.val}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold">Ponto eletrônico — semana</span>
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-end gap-2 h-20">
                    {[40, 70, 55, 85, 90, 30, 20].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: "10x", label: "menos planilhas" },
            { val: "100%", label: "conforme LGPD" },
            { val: "AFD", label: "integrado ao relógio" },
            { val: "24/7", label: "acesso pelo celular" },
          ].map((m) => (
            <div key={m.label}>
              <div className="text-3xl font-bold text-primary">{m.val}</div>
              <div className="text-sm text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="funcionalidades" className="container mx-auto px-4 py-20 md:py-28">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-bold">Tudo o que o RH precisa</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Dez módulos integrados que cobrem todo o ciclo de vida do colaborador.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((f) => (
            <Card key={f.title} className="p-6 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="bg-muted/30 border-y">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">Comece em 3 passos</h2>
            <p className="mt-4 text-muted-foreground text-lg">Implementação simples, sem consultoria longa.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Cadastre sua equipe", desc: "Importe funcionários ou cadastre manualmente. Ficha completa em minutos." },
              { n: "02", title: "Configure os módulos", desc: "Ative apenas o que sua empresa precisa: ponto, benefícios, comunicados…" },
              { n: "03", title: "Acompanhe pelo dashboard", desc: "Visão geral em tempo real do que está acontecendo no seu RH." },
            ].map((s) => (
              <Card key={s.n} className="p-8 relative">
                <div className="text-5xl font-bold text-primary/20 mb-2">{s.n}</div>
                <h3 className="font-semibold text-xl mb-2">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PONTO ELETRÔNICO HIGHLIGHT */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-4">
              <Zap className="h-4 w-4" /> Destaque
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ponto eletrônico que conversa com seu relógio</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Importe o arquivo AFD direto do seu REP e tenha as marcações dos funcionários processadas automaticamente.
            </p>
            <ul className="space-y-3">
              {[
                "Importação de arquivos AFD (Portaria 671/MTE)",
                "Vinculação automática PIS ↔ CPF por similaridade de nome",
                "Cálculo de horas trabalhadas, faltas e adicionais",
                "Espelho de ponto e fechamento mensal",
                "Detecção de inconsistências para revisão",
              ].map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-primary" />
              <span className="font-semibold">AFD_2025_06.txt</span>
              <span className="ml-auto text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600">Processado</span>
            </div>
            <div className="space-y-2 text-sm font-mono">
              {[
                ["08:02", "Maria Silva", "Entrada"],
                ["12:01", "Maria Silva", "Saída almoço"],
                ["13:05", "João Souza", "Entrada"],
                ["17:58", "Maria Silva", "Saída"],
                ["18:03", "Ana Costa", "Saída"],
              ].map(([h, n, t], i) => (
                <div key={i} className="flex items-center justify-between rounded border bg-background p-2">
                  <span className="text-primary font-bold">{h}</span>
                  <span className="flex-1 ml-3">{n}</span>
                  <span className="text-xs text-muted-foreground">{t}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* PORTAL DO COLABORADOR */}
      <section className="bg-muted/30 border-y">
        <div className="container mx-auto px-4 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <Card className="p-8 order-2 lg:order-1">
            <Smartphone className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-bold mb-4">No celular do colaborador</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: FileText, label: "Contracheques" },
                { icon: Megaphone, label: "Comunicados" },
                { icon: ListTodo, label: "Tarefas" },
                { icon: MessageCircle, label: "Chat com RH" },
                { icon: Bus, label: "Vale Transporte" },
                { icon: ShieldCheck, label: "EPIs" },
              ].map((i) => (
                <div key={i.label} className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm">
                  <i.icon className="h-4 w-4 text-primary" />
                  {i.label}
                </div>
              ))}
            </div>
          </Card>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Portal do colaborador incluso</h2>
            <p className="text-lg text-muted-foreground mb-4">
              Cada funcionário tem acesso ao próprio portal — vê contracheques, recebe comunicados, conclui tarefas e fala direto com o RH.
            </p>
            <p className="text-muted-foreground">
              Menos perguntas no WhatsApp, menos papel circulando, mais autonomia para todos.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container mx-auto px-4 py-20 md:py-28 max-w-3xl">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">Perguntas frequentes</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA FINAL */}
      <section id="cta" className="container mx-auto px-4 pb-20">
        <Card className="p-10 md:p-16 text-center bg-gradient-to-br from-primary to-primary/70 border-0 text-primary-foreground">
          <Lock className="h-10 w-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Pronto para modernizar seu RH?</h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto mb-8">
            Comece hoje mesmo. Sem cartão de crédito, sem instalação, sem complicação.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">Começar grátis <ArrowRight className="ml-1" /></Button>
            </Link>
            <a href="mailto:vendas@portalrh.app">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                Falar com vendas
              </Button>
            </a>
          </div>
        </Card>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Portal RH</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <Link to="/login" className="hover:text-foreground">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
