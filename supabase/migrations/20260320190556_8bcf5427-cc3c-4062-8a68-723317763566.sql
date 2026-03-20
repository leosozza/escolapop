
-- Tabela de instâncias WhatsApp
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wuzapi_user_id text,
  wuzapi_token text,
  connection_type text NOT NULL DEFAULT 'qrcode',
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  qr_code text,
  last_error text,
  last_check_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view instances" ON public.whatsapp_instances
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage instances" ON public.whatsapp_instances
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Tabela de permissões por instância
CREATE TABLE public.whatsapp_instance_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

ALTER TABLE public.whatsapp_instance_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own access" ON public.whatsapp_instance_access
  FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Admins can manage access" ON public.whatsapp_instance_access
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Adicionar instance_id em whatsapp_messages
ALTER TABLE public.whatsapp_messages ADD COLUMN instance_id uuid REFERENCES public.whatsapp_instances(id);

-- Habilitar realtime para instâncias
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;
