

# Plano: Escola no Curso + Redesign dos Cards de Turmas

## Resumo

1. Adicionar coluna `school` na tabela `courses` (valores: `escola_de_modelo`, `pop_school`)
2. Adicionar campo de escola nos dialogs de curso (Add/Edit)
3. Remover campo "nome da turma" obrigatório do AddClassDialog — o nome será gerado automaticamente a partir do curso + dia + horário
4. Redesenhar o card de turma com header colorido por escola e layout hierárquico de informações

## 1. Migração SQL

```sql
ALTER TABLE public.courses ADD COLUMN school text DEFAULT 'escola_de_modelo';
```

## 2. Página de Cursos — campo Escola

**Arquivos**: `AddCourseDialog.tsx`, `EditCourseDialog.tsx`, `src/types/database.ts`

- Adicionar `school` ao interface `Course`
- Adicionar Select no form com opções: "Escola de Modelo" e "Pop School"
- Salvar/atualizar o campo `school`

## 3. AddClassDialog — remover nome manual

**Arquivo**: `AddClassDialog.tsx`

- Remover campo "Nome da turma" do formulário
- Gerar nome automaticamente: `{curso} - {dia} {horário} ({faixa etária})`
- Salvar esse nome gerado no insert

## 4. Redesign do card de turma

**Arquivo**: `Classes.tsx` — `renderClassCard`

Novo layout do card:

```text
┌──────────────────────────────────────┐
│ HEADER LARANJA (escola_de_modelo)    │  ← cor laranja com texto preto
│ ou HEADER ROXO (pop_school)          │     para Escola de Modelo
│ Nome do Curso                        │     outra cor para Pop School
├──────────────────────────────────────┤
│ 📅 Segunda-feira        🕐 14:00    │  ← dia + horário em destaque
│                                      │
│ 👶 4 a 7 anos                       │  ← faixa etária grande
│                                      │
│ Prof. João Silva                     │  ← menor
│                                      │
│ 🟢 Matriculados: 12 │ Em Curso: 8  │  ← métricas lado a lado
│ 🔴 Ausentes: 2    │ Rematrícula: 1 │
│                                      │
│ 📅 01/04/2026 → 26/05/2026         │  ← datas
│ 🏫 Sala 1 │ 30 vagas │ 1h/aula    │  ← info complementar
│ 8 aulas                             │
└──────────────────────────────────────┘
```

- A query de `classes` já faz join com `courses` — basta incluir `school` no select
- Header laranja (`bg-orange-500 text-black`) para `escola_de_modelo`
- Header diferente (ex: `bg-purple-500 text-white`) para `pop_school`
- Dia da semana e horário em texto grande/bold
- Faixa etária em texto grande
- Professor em texto menor
- Métricas: matriculados, em curso, ausentes, rematrícula (usar `status_counts` existente, adicionar contagem de `ausente` e `rematricula`)
- Datas de início e fim
- Sala, limite de alunos, duração por aula, quantidade de aulas

## 5. Status counts — adicionar ausentes e rematrícula

**Arquivo**: `Classes.tsx`

Na interface `ClassStatusCounts`, adicionar `ausente` e `rematricula`. Na query que calcula os counts (busca de `class_enrollments` + `enrollments`), incluir esses dois status na contagem.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| **migração SQL** | Adicionar coluna `school` em `courses` |
| `src/types/database.ts` | Adicionar `school` ao interface `Course` |
| `src/components/courses/AddCourseDialog.tsx` | Campo select de escola |
| `src/components/courses/EditCourseDialog.tsx` | Campo select de escola |
| `src/components/classes/AddClassDialog.tsx` | Remover nome manual, gerar automaticamente |
| `src/pages/Classes.tsx` | Redesign do card + incluir `school` no join + novos status counts |

