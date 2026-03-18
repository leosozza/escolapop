
-- Create non_enrollment_reason enum
CREATE TYPE public.non_enrollment_reason AS ENUM (
  'sem_resposta',
  'sem_interesse',
  'contrato_cancelado',
  'sem_disponibilidade',
  'distancia',
  'outro'
);

-- Create lead_non_enrollment_reasons table
CREATE TABLE public.lead_non_enrollment_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reason public.non_enrollment_reason NOT NULL,
  custom_reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_non_enrollment_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage non-enrollment reasons" ON public.lead_non_enrollment_reasons
  FOR ALL TO public USING (is_staff(auth.uid()));

CREATE POLICY "Staff can view non-enrollment reasons" ON public.lead_non_enrollment_reasons
  FOR SELECT TO public USING (is_staff(auth.uid()));

-- Create lead_response_tracking table
CREATE TABLE public.lead_response_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE UNIQUE,
  first_contact_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  first_response_at TIMESTAMP WITH TIME ZONE,
  response_time_minutes INTEGER,
  alert_24h BOOLEAN DEFAULT false,
  auto_tabulated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_response_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage response tracking" ON public.lead_response_tracking
  FOR ALL TO public USING (is_staff(auth.uid()));

CREATE POLICY "Staff can view response tracking" ON public.lead_response_tracking
  FOR SELECT TO public USING (is_staff(auth.uid()));

-- Create access_audit_log table
CREATE TABLE public.access_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  performed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit log" ON public.access_audit_log
  FOR ALL TO public USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admins can view audit log" ON public.access_audit_log
  FOR SELECT TO public USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Update is_staff function to include new roles
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gestor', 'agente_comercial', 'recepcao', 'professor', 'produtor', 'scouter', 'agente_matricula', 'supervisor')
  )
$$;
