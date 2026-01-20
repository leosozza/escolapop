-- Add foreign key from enrollments.student_id to profiles.user_id
ALTER TABLE public.enrollments
ADD CONSTRAINT enrollments_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE RESTRICT;