

## Plan: Modern Layout Redesign

### Current State
Both the admin panel (Index.tsx) and the employee portal (MinhaArea.tsx) use a basic horizontal tabs layout with 9-12 tabs crammed into a single row. On mobile, tabs overflow horizontally. The design is functional but feels crowded and dated.

### What Changes

**1. Admin Panel (Index.tsx) — Sidebar Navigation**
- Replace the horizontal `Tabs` with a collapsible sidebar using the existing `Sidebar` component
- Sidebar shows icons + labels, collapses to icon-only on mobile
- Header becomes a slim top bar with the sidebar trigger, app title, and user actions (manage passwords, logout)
- Content area fills the remaining space with better spacing
- Active section highlighted in sidebar with accent color
- Group navigation items logically: Dashboard, People (Funcionarios, Admissao), Documents (Contracheques, VT, Ponto), Benefits (Plano, EPIs), Communication (Comunicados, Chat, Tarefas), Settings

**2. Employee Portal (MinhaArea.tsx) — Sidebar Navigation**
- Same sidebar pattern but with fewer items (9 tabs)
- Employee name and avatar area at the top of sidebar
- Year selector moved into sidebar footer or header area
- Clean content area with more breathing room

**3. Color Palette Refresh (index.css)**
- Update primary color to a modern blue (`217 91% 60%`) instead of the current dark navy
- Add subtle gradient to sidebar background
- Improve card shadows and border radius for a softer feel
- Add chart color variables for consistency

**4. Login Pages (Login.tsx, MinhaArea.tsx login)**
- Add a subtle gradient background or pattern
- Slightly larger card with more padding
- Polished input styling

### Technical Details

- **Files modified**: `src/pages/Index.tsx`, `src/pages/MinhaArea.tsx`, `src/pages/Login.tsx`, `src/index.css`
- **Pattern**: Uses existing `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarMenu` etc. from `@/components/ui/sidebar`
- **State management**: Replace `Tabs` with a `useState` for active section, render content conditionally
- **Responsive**: Sidebar uses `collapsible="icon"` on desktop, `collapsible="offcanvas"` behavior on mobile via `SidebarTrigger`
- **No breaking changes**: All existing component imports and functionality remain intact, only the navigation wrapper changes

### Visual Structure (Admin)

```text
+------------------+------------------------------------------+
| [Logo] Portal RH |  [Senhas] [Sair]                         |
+--------+---------+------------------------------------------+
|        |                                                     |
| Dash   |   [Active Section Content]                          |
| Func   |                                                     |
| Contra |                                                     |
| VT     |                                                     |
| Ponto  |                                                     |
| Plano  |                                                     |
| EPIs   |                                                     |
| Comun  |                                                     |
| Chat 3 |                                                     |
| Taref  |                                                     |
| Admis  |                                                     |
| Config |                                                     |
+--------+-----------------------------------------------------+
```

