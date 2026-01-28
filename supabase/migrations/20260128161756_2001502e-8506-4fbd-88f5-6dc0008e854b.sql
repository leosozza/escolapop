-- Create enum for team member sectors/positions
CREATE TYPE public.team_sector AS ENUM (
  'recepcao',
  'departamento_matricula',
  'professor_teatro',
  'professor_passarela',
  'professor_influencia',
  'administrativo',
  'produtor'
);

-- Create enum for visibility areas
CREATE TYPE public.team_area AS ENUM (
  'comercial',
  'financeiro',
  'academico',
  'gestao'
);

-- Create team_members table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  sector team_sector NOT NULL,
  areas team_area[] NOT NULL DEFAULT '{}',
  show_in_all BOOLEAN DEFAULT false,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active team members"
ON public.team_members
FOR SELECT
USING ((is_active = true) OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage team members"
ON public.team_members
FOR ALL
USING (is_staff(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();