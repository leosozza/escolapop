-- Tabela de sessões do Studio (produção fotográfica)
CREATE TABLE IF NOT EXISTS public.studio_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIME,
  producer_id UUID REFERENCES public.team_members(id),
  code TEXT,
  status TEXT DEFAULT 'a_ver' CHECK (status IN ('a_ver', 'ok', 'cancelado')),
  plan TEXT,
  
  -- Maquiagem & Estudio
  makeup_artist_id UUID REFERENCES public.team_members(id),
  making_of_done BOOLEAN DEFAULT false,
  photos_done BOOLEAN DEFAULT false,
  photo_count INTEGER DEFAULT 0,
  video_done BOOLEAN DEFAULT false,
  video_notes TEXT,
  
  -- Tempos de produção
  studio_start TIMESTAMPTZ,
  studio_end TIMESTAMPTZ,
  editing_start TIMESTAMPTZ,
  editing_end TIMESTAMPTZ,
  
  -- Entrega
  delivery_status TEXT DEFAULT 'pendente' CHECK (delivery_status IN ('pendente', 'entregue', 'parcial')),
  delivery_notes TEXT,
  
  -- Retorno
  next_return_date DATE,
  return_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_studio_sessions_date ON public.studio_sessions(session_date);
CREATE INDEX idx_studio_sessions_lead ON public.studio_sessions(lead_id);
CREATE INDEX idx_studio_sessions_producer ON public.studio_sessions(producer_id);

-- RLS
ALTER TABLE public.studio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view studio_sessions"
  ON public.studio_sessions FOR SELECT
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage studio_sessions"
  ON public.studio_sessions FOR ALL
  USING (public.is_staff(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_studio_sessions_updated_at
  BEFORE UPDATE ON public.studio_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();