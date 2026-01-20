-- Criar bucket para avatares de agentes
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);

-- Policy para upload por staff autenticado
CREATE POLICY "Staff can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND is_staff(auth.uid()));

-- Policy para leitura pública
CREATE POLICY "Public access to avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Policy para staff deletar avatares
CREATE POLICY "Staff can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND is_staff(auth.uid()));

-- Criar tabela de agentes de relacionamento
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  whatsapp_phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ver agentes ativos
CREATE POLICY "Anyone can view active agents"
ON public.agents FOR SELECT
USING (is_active = true OR is_staff(auth.uid()));

-- Staff pode gerenciar agentes
CREATE POLICY "Staff can manage agents"
ON public.agents FOR ALL
USING (is_staff(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_agents_updated_at
BEFORE UPDATE ON public.agents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();