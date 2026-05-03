## Landing Page de Vendas - Portal RH

Criar uma landing page pública para apresentar e vender o sistema, destacando todas as funcionalidades.

### Rota e acesso
- Nova rota pública `/landing` (acessível sem login)
- Adicionar link "Entrar" que leva para `/login`
- CTAs principais: "Começar agora" e "Falar com vendas"

### Estrutura da página

**1. Hero**
- Título forte: "Toda a gestão de RH da sua empresa em um só lugar"
- Subtítulo explicando o valor (centraliza pessoas, ponto, benefícios, comunicação)
- Dois botões CTA (primário "Teste grátis" / secundário "Ver funcionalidades")
- Mockup/ilustração do dashboard à direita

**2. Faixa de prova social**
- "Empresas que confiam" + logos placeholder
- Métricas (ex.: "10x menos planilhas", "100% LGPD", "Integração com relógio de ponto")

**3. Grid de Funcionalidades** (cards com ícone, título e descrição curta)
- Cadastro de Funcionários — ficha completa, documentos, histórico
- Ponto Eletrônico — integração com relógio (AFD), banco de horas, espelho
- Vale Transporte — controle de recargas, calendário e inconsistências
- Contracheques — distribuição automática e portal do colaborador
- Plano de Saúde — titulares, dependentes, mensalidades e coparticipação
- Exames Periódicos — agendamento e controle de validade
- EPIs — entregas, fichas e assinatura digital
- Comunicados — avisos com confirmação de leitura
- Tarefas — atribuição, prazos e acompanhamento
- Chat Interno — comunicação direta entre RH e colaboradores

**4. Seção "Como funciona"** (3 passos)
- Cadastre sua equipe → Configure módulos → Acompanhe tudo no dashboard

**5. Destaque Ponto Eletrônico** (seção dedicada por ser diferencial)
- Importação de arquivo AFD do relógio
- Vinculação automática PIS ↔ CPF
- Cálculo de horas, faltas e adicionais

**6. Portal do Colaborador**
- Mostrar que o funcionário também tem acesso (contracheques, comunicados, tarefas, dados)

**7. FAQ** (accordion)
- Preciso instalar algo? Funciona com qualquer relógio? Os dados ficam seguros? Tem app mobile?

**8. CTA final**
- "Pronto para modernizar seu RH?" + botão grande

**9. Footer**
- Links, contato, redes, copyright

### Detalhes técnicos
- Arquivo: `src/pages/Landing.tsx`
- Registrar rota em `src/App.tsx` (`/landing`, pública — fora do `ProtectedRoute`)
- Tornar `/landing` a rota inicial pública? **Não** — manter `/` como app autenticado; landing fica em `/landing`. (Posso trocar se preferir.)
- Usar componentes existentes: `Button`, `Card`, `Accordion`, ícones do `lucide-react` (já em uso)
- Estilo: seguir tokens do `index.css` (primary azul, cards, radius), responsivo mobile-first
- Sem backend novo, sem dependências novas
- Sem formulário funcional nesta etapa — CTAs apontam para `/login` (e um `mailto:` para vendas)

### Fora do escopo (pode ser próxima etapa)
- Formulário de captura de leads salvando no backend
- Página de preços
- Internacionalização
