
-- Tabela de mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id),
  phone text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  wuzapi_message_id text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage messages" ON public.whatsapp_messages
  FOR ALL USING (public.is_staff(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Tabela de sessão WhatsApp
CREATE TABLE public.whatsapp_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  last_check_at timestamptz DEFAULT now(),
  last_error text,
  qr_code text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage session" ON public.whatsapp_session
  FOR ALL USING (public.is_staff(auth.uid()));
