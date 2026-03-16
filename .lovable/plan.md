

# Plano: Presenca Inline na Pagina Alunos + Remover Pagina Presenca

## O que sera feito

1. **Criar componente `QuickAttendancePopover`** -- botao "Dar Presenca" na pagina Alunos que abre um popover/dialog com busca auto-complete (debounced, dispara enquanto digita). Ao encontrar o aluno, mostra suas turmas com grade de 8 aulas para marcar presenca rapidamente. Reutiliza a logica do `QuickAttendance.tsx` atual.

2. **Remover pagina `/attendance`** -- deletar `QuickAttendance.tsx`, remover rota do `App.tsx`, remover item "Presenca" do sidebar.

3. **Adicionar botao "Nova Matricula" no perfil do aluno** -- no `StudentProfile.tsx`, adicionar possibilidade de matricular o aluno em mais cursos/turmas (abrir `AddEnrollmentDialog` pre-selecionando o lead).

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/components/students/QuickAttendancePopover.tsx` | Novo -- popover com busca auto e grade de presenca |
| `src/pages/Students.tsx` | Adicionar botao "Dar Presenca" que abre o popover |
| `src/pages/QuickAttendance.tsx` | Deletar |
| `src/App.tsx` | Remover rota `/attendance` e import |
| `src/components/layout/AppSidebar.tsx` | Remover item "Presenca" do menu Academico |
| `src/pages/StudentProfile.tsx` | Adicionar botao "Nova Matricula" que abre AddEnrollmentDialog pre-preenchido com o lead |
| `src/components/students/AddEnrollmentDialog.tsx` | Aceitar prop `preSelectedLeadId` para pular selecao de lead |

## Detalhes tecnicos

**QuickAttendancePopover:**
- Usa `Dialog` (modal) em vez de popover para ter espaco suficiente para a grade
- Busca debounced (300ms) -- `useEffect` com `setTimeout` que atualiza `searchQuery` conforme `searchTerm` muda
- Mesma logica de busca: codigo MaxFama (regex `^\d{6,8}$`) ou nome via `ilike`
- Grid de 8 aulas com botoes presente/falta/justificado
- Apos marcar, mantem busca aberta para proximo aluno

**AddEnrollmentDialog com pre-selecao:**
- Nova prop `preSelectedLeadId?: string`
- Quando definida, forca tab "Lead Existente" e pre-seleciona o lead, travando o campo

