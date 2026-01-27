-- Remove unique constraint that causes issues
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_course_id_key;

-- Make student_id nullable since students are managed via lead_id
ALTER TABLE public.enrollments ALTER COLUMN student_id DROP NOT NULL;

-- Drop the foreign key constraint that references profiles
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;