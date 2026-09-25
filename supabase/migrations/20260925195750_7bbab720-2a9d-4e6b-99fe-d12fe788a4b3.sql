ALTER TABLE public.analises
  ADD COLUMN IF NOT EXISTS schema_version text,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS strengths jsonb,
  ADD COLUMN IF NOT EXISTS improvements jsonb,
  ADD COLUMN IF NOT EXISTS optimized_version text,
  ADD COLUMN IF NOT EXISTS current_vs_ideal jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS analises_user_request_uidx ON public.analises (user_id, request_id) WHERE request_id IS NOT NULL;