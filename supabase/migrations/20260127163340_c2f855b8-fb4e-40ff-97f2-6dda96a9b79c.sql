-- Create enrollment type enum
CREATE TYPE public.enrollment_type AS ENUM (
  'modelo_agenciado_maxfama',
  'modelo_agenciado_popschool',
  'indicacao_influencia',
  'indicacao_aluno'
);

-- Add enrollment_type and related fields to enrollments table
ALTER TABLE public.enrollments
ADD COLUMN enrollment_type public.enrollment_type,
ADD COLUMN influencer_name TEXT,
ADD COLUMN referral_agent_code TEXT,
ADD COLUMN student_age INTEGER,
ADD COLUMN class_id UUID REFERENCES public.classes(id);

-- Create an index for faster lookups
CREATE INDEX idx_enrollments_enrollment_type ON public.enrollments(enrollment_type);
CREATE INDEX idx_enrollments_class_id ON public.enrollments(class_id);

-- Add room field validation to classes table (rooms: Sala 1, Sala 2, Sala 5, Sala 6)
-- The room field already exists as TEXT, so we can use it directly

-- Create a table for influencer references (for the dropdown)
CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

-- RLS policies for influencers
CREATE POLICY "Anyone can view active influencers" 
ON public.influencers 
FOR SELECT 
USING ((is_active = true) OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage influencers" 
ON public.influencers 
FOR ALL 
USING (is_staff(auth.uid()));

-- Insert the initial influencers
INSERT INTO public.influencers (name) VALUES 
  ('Mitty'),
  ('Alice Monteiro'),
  ('Kauanny'),
  ('Professor Claudio');