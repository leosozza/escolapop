
-- Add new academic_status enum values
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'novo_lead';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'lead_nao_matriculado';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'reprovado_faltas';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'ausente';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'formado';

-- Add new app_role enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agente_matricula';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';
