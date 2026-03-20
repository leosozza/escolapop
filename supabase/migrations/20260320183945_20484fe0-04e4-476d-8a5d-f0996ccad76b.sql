
-- Tabela de alunos (separada dos leads/contatos)
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

CREATE POLICY "Staff can manage students" ON public.students FOR ALL USING (public.is_staff(auth.uid()));

-- Adicionar referência student_record_id na tabela enrollments
ALTER TABLE public.enrollments ADD COLUMN student_record_id uuid REFERENCES public.students(id);

-- Migrar dados existentes: criar um student para cada lead com enrollment
INSERT INTO public.students (lead_id, full_name, age, referral_agent_code, influencer_name, enrollment_type)
SELECT DISTINCT ON (e.lead_id) 
  e.lead_id, l.full_name, e.student_age, e.referral_agent_code, e.influencer_name, e.enrollment_type::text
FROM public.enrollments e
JOIN public.leads l ON l.id = e.lead_id
WHERE e.lead_id IS NOT NULL;

-- Vincular enrollments existentes ao student criado
UPDATE public.enrollments e
SET student_record_id = s.id
FROM public.students s
WHERE s.lead_id = e.lead_id;

-- Trigger para updated_at
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
