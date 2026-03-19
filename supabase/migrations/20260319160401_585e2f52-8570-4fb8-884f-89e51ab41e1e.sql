-- Add new academic statuses: remanejado, rematricula, desistente
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'remanejado';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'rematricula';
ALTER TYPE public.academic_status ADD VALUE IF NOT EXISTS 'desistente';