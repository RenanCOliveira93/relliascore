CREATE TABLE public.brand_problem_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_brain_id uuid NOT NULL REFERENCES public.brand_brains(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.brand_problems(id) ON DELETE CASCADE,
  offering_id uuid NOT NULL REFERENCES public.brand_offerings(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'solves' CHECK (relationship_type IN ('solves','partially_solves','related')),
  origin text NOT NULL DEFAULT 'extraction' CHECK (origin IN ('extraction','user_edit','legacy_name_match')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (problem_id, offering_id)
);
GRANT SELECT ON public.brand_problem_offerings TO authenticated;
GRANT ALL ON public.brand_problem_offerings TO service_role;
ALTER TABLE public.brand_problem_offerings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read problem offerings" ON public.brand_problem_offerings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.brand_brains b JOIN public.workspaces w ON w.id = b.workspace_id WHERE b.id = brand_problem_offerings.brand_brain_id AND b.user_id = auth.uid() AND w.user_id = auth.uid()));
CREATE INDEX idx_bpo_brain ON public.brand_problem_offerings(brand_brain_id);

-- Resolves name-based related_offerings into stable IDs (same brain only). Old name arrays are kept for compatibility.
CREATE OR REPLACE FUNCTION public.bb_link_problem_offerings(p_brain uuid, p_problem uuid DEFAULT NULL, p_origin text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.brand_problem_offerings(brand_brain_id, problem_id, offering_id, relationship_type, origin)
  SELECT DISTINCT ON (p.id, o.id) p_brain, p.id, o.id, 'solves', COALESCE(p_origin, CASE WHEN p.origin = 'user_edit' THEN 'user_edit' ELSE 'extraction' END)
  FROM public.brand_problems p CROSS JOIN LATERAL unnest(p.related_offerings) ref
  JOIN public.brand_offerings o ON o.brand_brain_id = p_brain AND public.bb_norm(o.name) = public.bb_norm(ref) AND o.human_status <> 'rejected'
  WHERE p.brand_brain_id = p_brain AND (p_problem IS NULL OR p.id = p_problem)
  ON CONFLICT (problem_id, offering_id) DO NOTHING
$$;
REVOKE ALL ON FUNCTION public.bb_link_problem_offerings(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_bb_problem_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'brand_problems' THEN
    PERFORM public.bb_link_problem_offerings(NEW.brand_brain_id, NEW.id, NULL);
  ELSE
    PERFORM public.bb_link_problem_offerings(NEW.brand_brain_id, NULL, NULL);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_brand_problems_link AFTER INSERT OR UPDATE OF related_offerings ON public.brand_problems FOR EACH ROW EXECUTE FUNCTION public.trg_bb_problem_link();
CREATE TRIGGER trg_brand_offerings_link AFTER INSERT OR UPDATE OF name ON public.brand_offerings FOR EACH ROW EXECUTE FUNCTION public.trg_bb_problem_link();

-- Safe backfill for existing brains (no deletion of old name relations).
DO $$ DECLARE b uuid; BEGIN
  FOR b IN SELECT id FROM public.brand_brains LOOP PERFORM public.bb_link_problem_offerings(b, NULL, 'legacy_name_match'); END LOOP;
END $$;

ALTER TABLE public.analises
  ADD COLUMN brand_brain_id uuid REFERENCES public.brand_brains(id) ON DELETE SET NULL,
  ADD COLUMN brand_brain_version integer,
  ADD COLUMN brand_context_snapshot jsonb,
  ADD COLUMN brand_alignment_version text,
  ADD COLUMN brand_alignment_score numeric,
  ADD COLUMN brand_alignment_partial boolean,
  ADD COLUMN brand_alignment_dimensions jsonb,
  ADD COLUMN brand_alignment_weights_applied jsonb,
  ADD COLUMN brand_alignment_findings jsonb,
  ADD COLUMN brand_strengths jsonb,
  ADD COLUMN brand_gaps jsonb,
  ADD COLUMN brand_entity_consistency jsonb,
  ADD COLUMN brand_recommendations jsonb,
  ADD COLUMN brand_optimized_version text;