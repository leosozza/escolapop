-- Corrigir policies permissivas

-- 1. Drop policy permissiva de profiles insert
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

-- 2. Criar policy mais restritiva para insert de profiles (apenas trigger do sistema)
CREATE POLICY "Trigger can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Drop policy permissiva de lead_history insert
DROP POLICY IF EXISTS "System can insert lead history" ON public.lead_history;

-- 4. Criar policy mais restritiva para lead_history (staff pode inserir)
CREATE POLICY "Staff can insert lead history"
  ON public.lead_history FOR INSERT
  WITH CHECK (public.is_staff(auth.uid()));