
-- Enum for content types
CREATE TYPE public.content_type AS ENUM ('video', 'text', 'file', 'quiz');

-- Modules table (course sections)
CREATE TABLE public.modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lesson contents (videos, texts, files)
CREATE TABLE public.lesson_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  content_type public.content_type NOT NULL DEFAULT 'video',
  title TEXT NOT NULL,
  content_url TEXT,
  content_text TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Lesson progress (tracks which lessons student has completed)
CREATE TABLE public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage NUMERIC NOT NULL DEFAULT 0,
  last_position_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, lesson_id)
);

-- Content progress (tracks video watch progress)
CREATE TABLE public.content_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.lesson_contents(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  total_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, content_id)
);

-- Enable RLS
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_progress ENABLE ROW LEVEL SECURITY;

-- Modules policies
CREATE POLICY "Anyone can view active modules of active courses"
  ON public.modules FOR SELECT
  USING (
    is_active = true 
    AND EXISTS (SELECT 1 FROM public.courses WHERE courses.id = modules.course_id AND courses.is_active = true)
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff can manage modules"
  ON public.modules FOR ALL
  USING (is_staff(auth.uid()));

-- Lessons policies
CREATE POLICY "Anyone can view active lessons"
  ON public.lessons FOR SELECT
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM public.modules m 
      JOIN public.courses c ON c.id = m.course_id 
      WHERE m.id = lessons.module_id AND m.is_active = true AND c.is_active = true
    )
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff can manage lessons"
  ON public.lessons FOR ALL
  USING (is_staff(auth.uid()));

-- Lesson contents policies
CREATE POLICY "Enrolled students can view lesson contents"
  ON public.lesson_contents FOR SELECT
  USING (
    is_active = true 
    AND EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.modules m ON m.id = l.module_id
      JOIN public.enrollments e ON e.course_id = m.course_id
      WHERE l.id = lesson_contents.lesson_id 
        AND e.student_id = auth.uid()
        AND e.status IN ('ativo', 'em_curso')
    )
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff can manage lesson contents"
  ON public.lesson_contents FOR ALL
  USING (is_staff(auth.uid()));

-- Lesson progress policies
CREATE POLICY "Students can view own lesson progress"
  ON public.lesson_progress FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Students can update own lesson progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Students can modify own lesson progress"
  ON public.lesson_progress FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff can manage lesson progress"
  ON public.lesson_progress FOR ALL
  USING (is_staff(auth.uid()));

-- Content progress policies
CREATE POLICY "Students can view own content progress"
  ON public.content_progress FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Students can insert own content progress"
  ON public.content_progress FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Students can update own content progress"
  ON public.content_progress FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid())
    OR is_staff(auth.uid())
  );

CREATE POLICY "Staff can manage content progress"
  ON public.content_progress FOR ALL
  USING (is_staff(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_contents_updated_at
  BEFORE UPDATE ON public.lesson_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_progress_updated_at
  BEFORE UPDATE ON public.content_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_modules_course_id ON public.modules(course_id);
CREATE INDEX idx_lessons_module_id ON public.lessons(module_id);
CREATE INDEX idx_lesson_contents_lesson_id ON public.lesson_contents(lesson_id);
CREATE INDEX idx_lesson_progress_enrollment_id ON public.lesson_progress(enrollment_id);
CREATE INDEX idx_content_progress_enrollment_id ON public.content_progress(enrollment_id);
