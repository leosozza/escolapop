-- =============================================
-- FASE 1: CRM COMERCIAL + BASE DO SISTEMA
-- =============================================

-- 1. ENUM para roles de usuário
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'gestor',
  'agente_comercial',
  'recepcao',
  'professor',
  'produtor',
  'scouter',
  'aluno'
);

-- 2. ENUM para status de lead
CREATE TYPE public.lead_status AS ENUM (
  'lead',
  'em_atendimento',
  'agendado',
  'confirmado',
  'compareceu',
  'proposta',
  'matriculado',
  'perdido'
);

-- 3. ENUM para modalidade de curso
CREATE TYPE public.course_modality AS ENUM (
  'presencial',
  'online',
  'hibrido'
);

-- 4. ENUM para origem do lead
CREATE TYPE public.lead_source AS ENUM (
  'whatsapp',
  'instagram',
  'facebook',
  'google',
  'indicacao',
  'site',
  'presencial',
  'outro'
);

-- 5. Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabela de roles (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- 7. Tabela de cursos
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  modality course_modality NOT NULL DEFAULT 'presencial',
  duration_hours INTEGER,
  price DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabela de leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  source lead_source NOT NULL DEFAULT 'outro',
  campaign TEXT,
  ad_set TEXT,
  ad_name TEXT,
  status lead_status NOT NULL DEFAULT 'lead',
  course_interest_id UUID REFERENCES public.courses(id),
  assigned_agent_id UUID REFERENCES auth.users(id),
  notes TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Tabela de histórico de movimentação do lead
CREATE TABLE public.lead_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  from_status lead_status,
  to_status lead_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Tabela de agendamentos
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES auth.users(id) NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  confirmed BOOLEAN DEFAULT false,
  attended BOOLEAN,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Função para verificar role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 12. Função para verificar se usuário tem alguma role de staff
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gestor', 'agente_comercial', 'recepcao', 'professor', 'produtor', 'scouter')
  )
$$;

-- 13. Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 14. Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. Trigger para registrar histórico de lead
CREATE OR REPLACE FUNCTION public.log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.lead_history (lead_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER log_lead_status_changes
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_status_change();

-- 16. Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Profiles: usuários podem ver/editar próprio perfil, staff pode ver todos
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

-- User Roles: apenas admins podem gerenciar, staff pode visualizar
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view roles"
  ON public.user_roles FOR SELECT
  USING (public.is_staff(auth.uid()));

-- Courses: todos podem ver cursos ativos, staff pode gerenciar
CREATE POLICY "Anyone can view active courses"
  ON public.courses FOR SELECT
  USING (is_active = true OR public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage courses"
  ON public.courses FOR ALL
  USING (public.is_staff(auth.uid()));

-- Leads: staff pode ver e gerenciar leads
CREATE POLICY "Staff can view leads"
  ON public.leads FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert leads"
  ON public.leads FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update leads"
  ON public.leads FOR UPDATE
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Lead History: staff pode ver histórico
CREATE POLICY "Staff can view lead history"
  ON public.lead_history FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "System can insert lead history"
  ON public.lead_history FOR INSERT
  WITH CHECK (true);

-- Appointments: staff pode gerenciar agendamentos
CREATE POLICY "Staff can view appointments"
  ON public.appointments FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage appointments"
  ON public.appointments FOR ALL
  USING (public.is_staff(auth.uid()));