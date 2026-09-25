ALTER TABLE public.analises
  ADD COLUMN IF NOT EXISTS score_version text,
  ADD COLUMN IF NOT EXISTS content_score numeric(6,3),
  ADD COLUMN IF NOT EXISTS content_score_partial boolean,
  ADD COLUMN IF NOT EXISTS dim_semantic_relevance numeric(6,3),
  ADD COLUMN IF NOT EXISTS dim_entity_clarity numeric(6,3),
  ADD COLUMN IF NOT EXISTS dim_evidence_authority numeric(6,3),
  ADD COLUMN IF NOT EXISTS dim_citation_readiness numeric(6,3),
  ADD COLUMN IF NOT EXISTS dim_technical_geo numeric(6,3),
  ADD COLUMN IF NOT EXISTS score_dimensions jsonb,
  ADD COLUMN IF NOT EXISTS entity_clarity jsonb,
  ADD COLUMN IF NOT EXISTS entity_signals jsonb,
  ADD COLUMN IF NOT EXISTS content_claims jsonb,
  ADD COLUMN IF NOT EXISTS evidence_readiness jsonb,
  ADD COLUMN IF NOT EXISTS citation_readiness jsonb,
  ADD COLUMN IF NOT EXISTS technical_signals jsonb;

ALTER TABLE public.analises
  ADD CONSTRAINT analises_score_version_chk CHECK (score_version IS NULL OR score_version IN ('2.0')),
  ADD CONSTRAINT analises_content_score_range CHECK (content_score IS NULL OR (content_score >= 0 AND content_score <= 100));

CREATE INDEX IF NOT EXISTS idx_analises_version_created ON public.analises (workspace_id, score_version, created_at DESC);

ALTER TABLE public.plano_de_acao
  ADD COLUMN IF NOT EXISTS affected_dimension text;
ALTER TABLE public.plano_de_acao
  ADD CONSTRAINT plano_affected_dimension_chk CHECK (affected_dimension IS NULL OR affected_dimension IN
    ('semantic_relevance','entity_clarity','evidence_authority','citation_readiness','technical_geo'));