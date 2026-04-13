

## Plano: Tornar o Sistema Responsivo para Mobile e Tablet

### Problemas Identificados

1. **Tabs de navegação (Admin e Portal)**: Usam `grid-cols-12` e `grid-cols-9` fixos. No mobile, o texto fica cortado e ilegível (confirmado no screenshot).
2. **Chat**: Layout fixo `w-80` para sidebar + flex-1 para janela. No mobile, a sidebar ocupa toda a tela e o chat fica inacessível.
3. **Header admin**: Botões "Senhas" e "Sair" podem sobrepor o título em telas pequenas.
4. **Tabelas de dados**: Tabelas largas (contracheques, EPIs, VT, ponto) não têm scroll horizontal no mobile.

### Solução

#### 1. Navegação por abas responsiva
- **Mobile**: Trocar grid fixo por `flex overflow-x-auto` com scroll horizontal nas tabs
- **Mostrar apenas ícones** no mobile (sem texto), com tooltip para identificação
- Aplicar em ambas as páginas: `Index.tsx` (Admin, 12 tabs) e `MinhaArea.tsx` (Portal, 9 tabs)

#### 2. Chat responsivo
- **Mobile**: Mostrar sidebar ou janela, não ambos simultaneamente
- Quando selecionar conversa, esconder sidebar e mostrar chat com botão "Voltar"
- Usar `useIsMobile()` hook já existente

#### 3. Header responsivo
- Empilhar título e botões em coluna no mobile
- Reduzir tamanho dos botões

#### 4. Tabelas com scroll horizontal
- Envolver tabelas em `div` com `overflow-x-auto` onde ainda não estiver aplicado

#### 5. Dashboard responsivo
- Gráficos do `AdminDashboard` devem ter `ResponsiveContainer` (já usam recharts)
- Cards KPI em coluna no mobile

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/pages/Index.tsx` | Tabs responsivas (overflow-x-auto, ícones-only no mobile), header responsivo |
| `src/pages/MinhaArea.tsx` | Tabs responsivas, header responsivo |
| `src/components/chat/ChatContainer.tsx` | Layout sidebar/janela alternante no mobile |
| `src/components/admin/AdminDashboard.tsx` | Cards empilhados no mobile |
| Componentes portal/admin com tabelas | Garantir `overflow-x-auto` nos wrappers de tabela |

