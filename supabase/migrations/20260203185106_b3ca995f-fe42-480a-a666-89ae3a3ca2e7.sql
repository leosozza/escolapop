-- Add new lead statuses for commercial workflow
-- aguardando_confirmacao: waiting for WhatsApp confirmation
-- atrasado: auto-flagged 1h after scheduled time
-- fechado: closed by reception
-- nao_fechado: not closed by reception
-- reagendar: auto-flagged at 18:00 for non-attended
-- declinou: declined by relationship agent

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'aguardando_confirmacao' AFTER 'agendado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'atrasado' AFTER 'confirmado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'fechado' AFTER 'compareceu';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'nao_fechado' AFTER 'fechado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'reagendar' AFTER 'nao_fechado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'declinou' AFTER 'reagendar';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'limbo' AFTER 'declinou';