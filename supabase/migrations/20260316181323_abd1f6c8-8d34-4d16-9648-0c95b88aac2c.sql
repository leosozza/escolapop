
CREATE TRIGGER on_enrollment_status_change
  BEFORE UPDATE ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_enrollment_status_change();
