
CREATE TABLE public.whatsapp_quick_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shortcut TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view quick replies"
ON public.whatsapp_quick_replies
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()) AND (is_global = true OR created_by = auth.uid()));

CREATE POLICY "Staff can insert quick replies"
ON public.whatsapp_quick_replies
FOR INSERT
TO authenticated
WITH CHECK (is_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Staff can update own quick replies"
ON public.whatsapp_quick_replies
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Staff can delete own quick replies"
ON public.whatsapp_quick_replies
FOR DELETE
TO authenticated
USING (is_staff(auth.uid()) AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)));
