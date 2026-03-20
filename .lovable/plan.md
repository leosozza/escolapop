

# Plano: Corrigir Vinculação de Dados entre Atendimento Matrícula, Alunos e Turmas

## Problema Identificado

Quando um aluno é criado via "Atendimento Matrícula" (`AcademicSupport.tsx`), ele não aparece corretamente nas páginas **Alunos** e **Turmas** por dois motivos:

1. **Join incorreto na página Alunos** (`Students.tsx` linha 120): a query tenta fazer join de `classes.teacher_id` com `profiles` (`profiles!classes_teacher_id_fkey`), mas `teacher_id` referencia `team_members`, não `profiles`. Isso causa erro silencioso no join e pode retornar dados nulos.

2. **Falta de `class_enrollments`**: a tabela `class_enrollments` existe no banco mas nunca é populada. Embora o sistema atual use `enrollments.class_id` diretamente (o que funciona), a inconsistência pode causar problemas futuros.

3. **AcademicSupport busca leads com `status='lead'`** (linha 129) como "novos leads acadêmicos", mas não há distinção entre leads comerciais e acadêmicos — todos os leads com status `lead` aparecem, misturando setores.

## O que será feito

### 1. Corrigir join do teacher na página Alunos
- `Students.tsx`: trocar `profiles!classes_teacher_id_fkey` por `team_members!classes_teacher_id_fkey` no select da query de enrollments.

### 2. Garantir que AddEnrollmentDialog popule `class_enrollments`
- Após inserir o enrollment, inserir também em `class_enrollments` com `class_id` e `enrollment_id` para manter consistência.
- Aplicar isso tanto no fluxo "Novo Aluno" quanto "Lead Existente".

### 3. Separar leads acadêmicos dos comerciais
- Adicionar coluna `origin_sector` (text, default `'comercial'`) na tabela `leads` via migração.
- Quando o `AddEnrollmentDialog` é chamado da página Acadêmica, marcar o lead com `origin_sector = 'academico'`.
- Na `AcademicSupport.tsx`, filtrar apenas leads com `origin_sector = 'academico'` ao buscar novos leads.

### 4. Refetch após criação
- Garantir que `onSuccess` no `AddEnrollmentDialog` invalide as queries do React Query para que as páginas Alunos e Turmas atualizem automaticamente.

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/Students.tsx` | Corrigir join `team_members` em vez de `profiles` |
| `src/components/students/AddEnrollmentDialog.tsx` | Inserir em `class_enrollments` após criar enrollment; marcar `origin_sector` quando acadêmico |
| `src/pages/AcademicSupport.tsx` | Filtrar leads por `origin_sector = 'academico'` |
| Migração SQL | Adicionar coluna `origin_sector` em `leads` |

## Detalhes técnicos

**Migração SQL:**
```sql
ALTER TABLE public.leads ADD COLUMN origin_sector text NOT NULL DEFAULT 'comercial';
```

**AddEnrollmentDialog — após insert do enrollment:**
```typescript
// Após criar enrollment com sucesso
const { data: enrollmentResult } = await supabase
  .from('enrollments')
  .insert(enrollmentData)
  .select('id')
  .single();

// Inserir na tabela de junção
await supabase.from('class_enrollments').insert({
  class_id: values.class_id,
  enrollment_id: enrollmentResult.id,
});
```

**Students.tsx — correção do join (linha 120):**
```
class:classes(id, name, start_date, end_date, teacher:team_members!classes_teacher_id_fkey(full_name))
```

