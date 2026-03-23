

# Plano: Filtrar Operadores por Função

## Contexto
Atualmente, tanto o formulário de matrícula quanto o de agendamento buscam da mesma tabela `agents`. O correto é:

1. **Matrícula** — mostrar funcionários do **departamento de matrícula** (setor `departamento_matricula` na tabela `team_members`), **gestores** e **supervisores** (roles `gestor`, `supervisor` da tabela `user_roles` + `profiles`)
2. **Agendamento** — mostrar apenas o **agente comercial atribuído** à conversa (`assigned_agent_id` do lead), que vem da tabela `agents`

## Mudanças

### 1. `AddEnrollmentDialog.tsx` — Operadores de matrícula
- Substituir a query que busca de `agents` por uma que busca:
  - `team_members` com `sector = 'departamento_matricula'` e `is_active = true`
  - `profiles` + `user_roles` onde role é `gestor` ou `supervisor`
- Combinar ambas as listas sem duplicatas
- Renomear o label de "Agente que Agendou" para "Operador de Matrícula"

### 2. `ScheduleLeadDialog.tsx` — Agente de agendamento
- Manter a busca de `agents`, mas quando chamado dentro do WhatsApp com `assigned_agent_id`, pré-selecionar e limitar ao agente atribuído à conversa
- Adicionar prop opcional `assignedAgentId` para filtrar
- Quando `assignedAgentId` é passado, mostrar apenas esse agente no select

### 3. `WhatsApp.tsx` — Passar contexto ao dialog
- Ao abrir o dialog de matrícula ou agendamento, passar o `assigned_agent_id` do contato selecionado como prop

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/components/students/AddEnrollmentDialog.tsx` | Buscar operadores de matrícula (team_members + roles gestor/supervisor) |
| `src/components/appointments/ScheduleLeadDialog.tsx` | Aceitar prop `assignedAgentId` para filtrar agente |
| `src/pages/WhatsApp.tsx` | Passar `assignedAgentId` do contato ao ScheduleLeadDialog |

