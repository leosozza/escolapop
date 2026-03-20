

# Plano: Criar Tabela de Alunos Separada dos Leads

## Problema

Atualmente, alunos e leads/contatos são a mesma entidade na tabela `leads`. Porém, um contato (lead) pode ter 2 ou mais filhos — cada um sendo um aluno diferente. O modelo atual não suporta isso: `enrollments.lead_id` aponta para o contato, mas não identifica qual filho é o aluno.

## Solução

Criar uma tabela `students` que representa o aluno individual, vinculado a um contato (`lead_id`). A tabela `enrollments` passará a referenciar `student_id` (da nova tabela `students`) em vez de usar o `lead_id` diretamente como identificador do aluno.

```text
leads (contato/responsável)
  └── students (aluno 1 - filho)
        └── enrollments (matrícula no curso)
  └── students (aluno 2 - filho)
        └── enrollments (matrícula no curso)
```

## Migração SQL

```sql
-- Tabela de alunos
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  age integer,
  guardian_name text,
  referral_agent_code text,
  enrollment_type text,
  influencer_name text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Staff can manage students" ON public.students FOR ALL USING (is_staff(auth.uid()));
CREATE POLICY "Staff can view students" ON public.students FOR SELECT USING (is_staff(auth.uid()));

-- Adicionar referência na enrollments
ALTER TABLE public.enrollments ADD COLUMN student_record_id uuid REFERENCES public.students(id);

-- Migrar dados existentes: criar um student para cada lead com enrollment
INSERT INTO public.students (lead_id, full_name, age, referral_agent_code, influencer_name)
SELECT DISTINCT ON (e.lead_id) 
  e.lead_id, l.full_name, e.student_age, e.referral_agent_code, e.influencer_name
FROM public.enrollments e
JOIN public.leads l ON l.id = e.lead_id
WHERE e.lead_id IS NOT NULL;

-- Vincular enrollments existentes ao student criado
UPDATE public.enrollments e
SET student_record_id = s.id
FROM public.students s
WHERE s.lead_id = e.lead_id;
```

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabela `students`, migrar dados |
| `src/components/students/AddEnrollmentDialog.tsx` | Ao matricular, criar registro em `students` e vincular ao enrollment |
| `src/pages/Students.tsx` | Query principal busca `students` com join em `leads` e `enrollments` |
| `src/pages/StudentProfile.tsx` | Carregar dados do `student` + `lead` (contato) separadamente |
| `src/components/academic/AddAcademicContactDialog.tsx` | Criar student ao matricular |
| `src/types/database.ts` | Adicionar tipo Student |

## Fluxo Após Mudança

1. Lead é criado (contato/responsável) com nome, telefone, email
2. Ao matricular, cria-se um **student** vinculado ao lead (com nome do aluno, idade, etc.)
3. O enrollment referencia o `student_record_id`
4. Um mesmo lead pode ter N students (filhos)
5. Página de Alunos lista `students` (não leads)
6. Perfil do aluno mostra dados do student + dados do contato (lead pai)

