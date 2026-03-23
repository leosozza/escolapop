ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS maxsystem_contract_number text,
  ADD COLUMN IF NOT EXISTS maxsystem_record_id text;