

# Plano: Faixa Etária, Dia/Horário e Filtros nas Turmas

## Resumo

Adicionar `age_range` à tabela `classes` para categorizar turmas por faixa etária. Exibir dia da semana e horário de forma mais clara. Melhorar os selects de turma em todos os dialogs de matrícula com filtros (faixa etária, dia, horário). Garantir que turmas só são criadas na página Turmas.

## 1. Migração SQL — coluna `age_range`

```sql
ALTER TABLE public.classes ADD COLUMN age_range text DEFAULT 'todas';
```

Valores possíveis: `'4_a_7'`, `'8_a_12'`, `'13_mais'`, `'todas'`

## 2. Página Turmas (`Classes.tsx`) — Filtros e exibição

- Adicionar filtros no topo: **faixa etária**, **dia da semana**, **horário**
- Exibir badge de faixa etária nos cards/lista de turmas
- Filtrar `filteredClasses` com base nos novos filtros

## 3. `AddClassDialog.tsx` e `EditClassDialog.tsx` — Campo faixa etária

- Adicionar campo `age_range` (Select) com opções: "4 a 7 anos", "8 a 12 anos", "13+ anos", "Todas as idades"
- Salvar na coluna `age_range` ao criar/editar

## 4. `AddEnrollmentDialog.tsx` — Filtros na seleção de turma

Atualmente o select de turma mostra apenas nome + sala + horário. Melhorar para:
- Adicionar filtros inline acima do select: **faixa etária**, **dia da semana**
- Buscar turmas com os campos `age_range` e `schedule` para filtragem
- Exibir no select: nome + dia + horário + faixa etária + sala
- Aplicar nos dois forms (novo aluno e lead existente)

## 5. WhatsApp.tsx, StudentProfile.tsx, Students.tsx — Consistência

Todos usam `AddEnrollmentDialog` com as mesmas props. Não criam turmas, apenas selecionam turmas existentes. As melhorias no `AddEnrollmentDialog` se propagam automaticamente.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| **migração SQL** | Adicionar coluna `age_range` na tabela `classes` |
| `src/components/classes/AddClassDialog.tsx` | Adicionar campo faixa etária |
| `src/components/classes/EditClassDialog.tsx` | Adicionar campo faixa etária |
| `src/pages/Classes.tsx` | Filtros de faixa etária, dia, horário; badge nos cards |
| `src/components/students/AddEnrollmentDialog.tsx` | Filtros inline na seleção de turma (faixa etária, dia) |

## Constantes reutilizáveis (em `course-schedule-config.ts`)

```typescript
export const AGE_RANGES = [
  { id: 'todas', label: 'Todas as idades' },
  { id: '4_a_7', label: '4 a 7 anos' },
  { id: '8_a_12', label: '8 a 12 anos' },
  { id: '13_mais', label: '13+ anos' },
] as const;
```

