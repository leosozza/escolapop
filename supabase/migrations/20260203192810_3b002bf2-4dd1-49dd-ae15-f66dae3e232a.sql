-- Tabela de dias de atendimento comercial
CREATE TABLE IF NOT EXISTS public.service_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_date DATE NOT NULL UNIQUE,
  weekday_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_per_hour INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.service_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read service_days"
  ON public.service_days FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert service_days"
  ON public.service_days FOR INSERT
  TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update service_days"
  ON public.service_days FOR UPDATE
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete service_days"
  ON public.service_days FOR DELETE
  TO authenticated
  USING (public.is_staff(auth.uid()));