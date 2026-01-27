-- Create certificate_templates table
CREATE TABLE public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  background_url TEXT,
  text_elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can manage certificate templates"
ON public.certificate_templates
FOR ALL
USING (is_staff(auth.uid()));

CREATE POLICY "Anyone can view active templates"
ON public.certificate_templates
FOR SELECT
USING ((is_active = true) OR is_staff(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_certificate_templates_updated_at
BEFORE UPDATE ON public.certificate_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);

-- Storage policies for certificates bucket
CREATE POLICY "Staff can upload certificate files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND is_staff(auth.uid()));

CREATE POLICY "Staff can update certificate files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'certificates' AND is_staff(auth.uid()));

CREATE POLICY "Staff can delete certificate files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'certificates' AND is_staff(auth.uid()));

CREATE POLICY "Anyone can view certificate files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'certificates');