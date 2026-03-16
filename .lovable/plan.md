

# Plano: Presença Rápida, Código Agenciado e WhatsApp no Telefone

## Resumo das Solicitações

1. Criar uma ferramenta fixa de "Dar Presença" -- busca por código ou nome, abre detalhes do aluno com suas turmas para marcar presença rapidamente
2. Remover foto/avatar do perfil do aluno (desnecessário)
3. Adicionar campo `referral_agent_code` (6-8 dígitos) quando tipo é `modelo_agenciado_maxfama` no AddEnrollmentDialog
4. Indicar no campo de telefone que o número será usado para WhatsApp, com link direto

## Implementação

### A. Página "Presença Rápida" (nova rota `/attendance`)

Criar `src/pages/QuickAttendance.tsx` -- uma página dedicada e simples:

- Campo de busca no topo: aceita código de agenciado (6-8 dígitos) ou nome completo
- Ao digitar e buscar, consulta `enrollments` JOIN `leads` filtrando por `referral_agent_code` ou `leads.full_name`
- Exibe card do aluno encontrado com: nome, telefone (link WhatsApp), turma(s) ativa(s)
- Para cada turma, mostra a grade de 8 aulas com botões de presença (presente/falta/justificado)
- Após marcar, limpa a busca para o próximo aluno (fluxo de recepção rápido)
- Adicionar link na sidebar do menu Acadêmico

### B. Remover avatar do StudentProfile

No `StudentProfile.tsx`, remover o componente `Avatar` do cabeçalho do card de perfil. Manter apenas nome e informações textuais.

### C. Campo `referral_agent_code` para `modelo_agenciado_maxfama`

No `AddEnrollmentDialog.tsx`:
- O campo "Código do Agenciado" aparece atualmente apenas para `indicacao_aluno`
- Alterar condição para mostrar também quando `enrollment_type === 'modelo_agenciado_maxfama'`
- Aplicar validação: apenas dígitos, mínimo 6, máximo 8 caracteres
- Aplicar mesma lógica na aba "Lead Existente"
- Atualizar label para "Código MaxFama" quando for modelo_agenciado_maxfama

### D. Indicação WhatsApp no campo de telefone

No `PhoneInput` ou nos formulários que usam telefone:
- Adicionar `FormDescription` abaixo do campo: "Este número será usado para contato via WhatsApp"
- No `AddEnrollmentDialog`, adicionar ícone do WhatsApp ao lado do label do telefone
- No `StudentProfile`, ao lado do campo telefone adicionar botão inline que abre WhatsApp Web (já existe no header, reforçar visualmente junto ao campo)

### E. Adicionar rota e sidebar

- Nova rota `/attendance` no `App.tsx`
- Novo item no `AppSidebar.tsx` dentro do grupo Acadêmico: "Presença" com ícone `CheckCircle2`

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/QuickAttendance.tsx` | Novo - página de presença rápida |
| `src/App.tsx` | Adicionar rota `/attendance` |
| `src/components/layout/AppSidebar.tsx` | Adicionar item "Presença" no menu Acadêmico |
| `src/components/students/AddEnrollmentDialog.tsx` | Mostrar código para maxfama, validar 6-8 dígitos |
| `src/pages/StudentProfile.tsx` | Remover avatar, adicionar indicador WhatsApp no telefone |

