
-- Create whatsapp-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read whatsapp media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow service role (edge functions) to insert files
CREATE POLICY "Service role can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Add reaction_to_id column to whatsapp_messages for linking reactions
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS reaction_to_id text;
