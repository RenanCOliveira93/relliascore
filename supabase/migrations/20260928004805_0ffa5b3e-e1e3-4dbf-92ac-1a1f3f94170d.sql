ALTER TABLE public.analises
  ADD COLUMN territory_snapshot jsonb,
  ADD COLUMN territory_alignment_version text,
  ADD COLUMN territory_alignment_score numeric,
  ADD COLUMN territory_alignment_partial boolean,
  ADD COLUMN territory_alignment_dimensions jsonb,
  ADD COLUMN territory_alignment_weights_applied jsonb,
  ADD COLUMN territory_findings jsonb,
  ADD COLUMN territory_strengths jsonb,
  ADD COLUMN territory_gaps jsonb,
  ADD COLUMN territory_next_actions jsonb,
  ADD COLUMN territory_optimized_version text;