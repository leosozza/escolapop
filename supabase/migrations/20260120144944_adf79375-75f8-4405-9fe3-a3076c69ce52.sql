-- Create lead_sources table for dynamic sources
CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text DEFAULT 'Globe',
  color text DEFAULT '#6B7280',
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_sources
CREATE POLICY "Anyone can view active sources" ON public.lead_sources
  FOR SELECT USING (is_active = true OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage sources" ON public.lead_sources
  FOR ALL USING (is_staff(auth.uid()));

-- Insert default sources
INSERT INTO public.lead_sources (name, icon, color, is_system) VALUES
  ('WhatsApp', 'MessageCircle', '#25D366', true),
  ('Instagram', 'Instagram', '#E4405F', true),
  ('Facebook', 'Facebook', '#1877F2', true),
  ('Google', 'Search', '#4285F4', true),
  ('Indicação', 'Users', '#8B5CF6', true),
  ('Site', 'Globe', '#06B6D4', true),
  ('Presencial', 'MapPin', '#F59E0B', true),
  ('Bitrix', 'Database', '#00AEEF', true),
  ('Importação CSV', 'FileSpreadsheet', '#10B981', true),
  ('Outro', 'MoreHorizontal', '#6B7280', true);

-- Create custom_fields table
CREATE TABLE public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'lead',
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean')),
  options jsonb,
  is_required boolean DEFAULT false,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(entity_type, field_name)
);

-- Enable RLS
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- RLS policies for custom_fields
CREATE POLICY "Anyone can view active custom fields" ON public.custom_fields
  FOR SELECT USING (is_active = true OR is_staff(auth.uid()));

CREATE POLICY "Staff can manage custom fields" ON public.custom_fields
  FOR ALL USING (is_staff(auth.uid()));

-- Create lead_custom_values table
CREATE TABLE public.lead_custom_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  value_text text,
  value_number numeric,
  value_date timestamptz,
  value_boolean boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, field_id)
);

-- Enable RLS
ALTER TABLE public.lead_custom_values ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_custom_values
CREATE POLICY "Staff can view custom values" ON public.lead_custom_values
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage custom values" ON public.lead_custom_values
  FOR ALL USING (is_staff(auth.uid()));

-- Create csv_imports table for import logs
CREATE TABLE public.csv_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  total_rows integer NOT NULL,
  imported_rows integer DEFAULT 0,
  failed_rows integer DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_log jsonb,
  imported_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.csv_imports ENABLE ROW LEVEL SECURITY;

-- RLS policies for csv_imports
CREATE POLICY "Staff can view imports" ON public.csv_imports
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Staff can manage imports" ON public.csv_imports
  FOR ALL USING (is_staff(auth.uid()));

-- Alter leads table to add new columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.lead_sources(id),
  ADD COLUMN IF NOT EXISTS attended_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_source text;

-- Create trigger to auto-update date fields based on status change
CREATE OR REPLACE FUNCTION public.update_lead_status_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'agendado' THEN
        NEW.scheduled_at := COALESCE(NEW.scheduled_at, now());
      WHEN 'compareceu' THEN
        NEW.attended_at := COALESCE(NEW.attended_at, now());
      WHEN 'proposta' THEN
        NEW.proposal_at := COALESCE(NEW.proposal_at, now());
      WHEN 'matriculado' THEN
        NEW.enrolled_at := COALESCE(NEW.enrolled_at, now());
      WHEN 'perdido' THEN
        NEW.lost_at := COALESCE(NEW.lost_at, now());
      ELSE
        NULL;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS update_lead_dates_trigger ON public.leads;
CREATE TRIGGER update_lead_dates_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_status_dates();

-- Add updated_at trigger for lead_custom_values
CREATE TRIGGER update_lead_custom_values_updated_at
  BEFORE UPDATE ON public.lead_custom_values
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();