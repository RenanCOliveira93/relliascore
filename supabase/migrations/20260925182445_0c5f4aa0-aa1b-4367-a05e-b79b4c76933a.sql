ALTER TABLE public.analises
  ADD COLUMN IF NOT EXISTS input_type text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS search_query text,
  ADD COLUMN IF NOT EXISTS analysis_mode text,
  ADD COLUMN IF NOT EXISTS weights_applied jsonb,
  ADD COLUMN IF NOT EXISTS technical_geo_version text,
  ADD COLUMN IF NOT EXISTS page_type text,
  ADD COLUMN IF NOT EXISTS page_type_confidence numeric,
  ADD COLUMN IF NOT EXISTS page_type_source text,
  ADD COLUMN IF NOT EXISTS technical_geo_coverage numeric,
  ADD COLUMN IF NOT EXISTS technical_geo_rules jsonb,
  ADD COLUMN IF NOT EXISTS technical_geo_critical_issues jsonb,
  ADD COLUMN IF NOT EXISTS technical_geo_quick_wins jsonb,
  ADD COLUMN IF NOT EXISTS structured_data_recommendations jsonb,
  ADD COLUMN IF NOT EXISTS ai_crawler_access jsonb;

CREATE INDEX IF NOT EXISTS idx_analises_ws_created ON public.analises (workspace_id, created_at DESC);