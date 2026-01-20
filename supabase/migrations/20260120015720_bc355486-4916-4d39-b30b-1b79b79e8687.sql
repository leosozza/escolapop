-- Enum para status acadêmico
CREATE TYPE public.academic_status AS ENUM (
  'ativo',
  'em_curso',
  'inadimplente',
  'evasao',
  'concluido',
  'trancado'
);

-- Tabela de perfil de aluno (dados adicionais específicos para modelos/influencers)
CREATE TABLE public.student_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  height_cm INTEGER,
  weight_kg NUMERIC(5,2),
  bust_cm INTEGER,
  waist_cm INTEGER,
  hip_cm INTEGER,
  shoe_size NUMERIC(4,1),
  eye_color TEXT,
  hair_color TEXT,
  skin_tone TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  youtube_channel TEXT,
  followers_count INTEGER,
  bio TEXT,
  portfolio_url TEXT,
  available_for_casting BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de matrículas
CREATE TABLE public.enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  status public.academic_status NOT NULL DEFAULT 'ativo',
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  progress_percentage NUMERIC(5,2) DEFAULT 0,
  grade NUMERIC(4,2),
  certificate_issued BOOLEAN DEFAULT false,
  certificate_issued_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Tabela de histórico de status acadêmico
CREATE TABLE public.enrollment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  from_status public.academic_status,
  to_status public.academic_status NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_history ENABLE ROW LEVEL SECURITY;

-- Policies para student_profiles
CREATE POLICY "Students can view own profile"
ON public.student_profiles FOR SELECT
USING (auth.uid() = user_id OR is_staff(auth.uid()));

CREATE POLICY "Students can update own profile"
ON public.student_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Staff can manage student profiles"
ON public.student_profiles FOR ALL
USING (is_staff(auth.uid()));

-- Policies para enrollments
CREATE POLICY "Students can view own enrollments"
ON public.enrollments FOR SELECT
USING (auth.uid() = student_id OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage enrollments"
ON public.enrollments FOR ALL
USING (is_staff(auth.uid()));

-- Policies para enrollment_history
CREATE POLICY "Staff can view enrollment history"
ON public.enrollment_history FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert enrollment history"
ON public.enrollment_history FOR INSERT
WITH CHECK (is_staff(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_student_profiles_updated_at
BEFORE UPDATE ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_enrollments_updated_at
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para log de mudança de status acadêmico
CREATE OR REPLACE FUNCTION public.log_enrollment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.enrollment_history (enrollment_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_enrollment_status
AFTER UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.log_enrollment_status_change();