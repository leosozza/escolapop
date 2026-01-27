-- Remove the old foreign key that references profiles
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;

-- Add new foreign key that references leads table
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.leads(id);

-- Update the unique constraint if needed (for upsert operations)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_class_id_student_id_attendance_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_class_student_date_unique 
  ON public.attendance (class_id, student_id, attendance_date);