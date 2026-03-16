
ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_teacher_id_fkey;

UPDATE public.classes SET teacher_id = NULL 
WHERE teacher_id IS NOT NULL 
AND teacher_id NOT IN (SELECT id FROM public.team_members);

ALTER TABLE public.classes 
  ADD CONSTRAINT classes_teacher_id_fkey 
  FOREIGN KEY (teacher_id) REFERENCES public.team_members(id) ON DELETE SET NULL;
