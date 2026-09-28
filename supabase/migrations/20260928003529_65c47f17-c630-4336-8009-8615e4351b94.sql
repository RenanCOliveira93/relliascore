CREATE TABLE public.brand_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  territory_type text NOT NULL DEFAULT 'concept' CHECK (territory_type IN ('category','problem','solution','expertise','technology','market','concept','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  priority text NOT NULL DEFAULT 'secondary' CHECK (priority IN ('primary','secondary','exploratory')),
  strategic_intent text,
  target_audience_summary text,
  desired_association text,
  core_concept text,
  included_topics text[] NOT NULL DEFAULT '{}',
  excluded_topics text[] NOT NULL DEFAULT '{}',
  related_concepts text[] NOT NULL DEFAULT '{}',
  origin text NOT NULL DEFAULT 'user_defined' CHECK (origin IN ('user_defined','brand_brain_suggestion')),
  source_brand_brain_id uuid REFERENCES public.brand_brains(id) ON DELETE SET NULL,
  source_brand_brain_version integer,
  suggestion_confidence numeric,
  suggestion_rationale text,
  suggestion_breadth text CHECK (suggestion_breadth IS NULL OR suggestion_breadth IN ('broad','balanced','narrow')),
  last_reviewed_brand_brain_id uuid REFERENCES public.brand_brains(id) ON DELETE SET NULL,
  last_reviewed_brand_brain_version integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT ON public.brand_territories TO authenticated;
GRANT ALL ON public.brand_territories TO service_role;
ALTER TABLE public.brand_territories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read territories" ON public.brand_territories FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()));
CREATE UNIQUE INDEX brand_territories_one_primary ON public.brand_territories(empresa_id) WHERE priority = 'primary' AND status <> 'archived';
CREATE UNIQUE INDEX brand_territories_slug ON public.brand_territories(empresa_id, slug) WHERE status <> 'archived';
CREATE INDEX brand_territories_empresa ON public.brand_territories(empresa_id, status);
CREATE TRIGGER trg_brand_territories_updated_at BEFORE UPDATE ON public.brand_territories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_territory_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.brand_territories(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  relation_kind text NOT NULL CHECK (relation_kind IN ('positioning','offering','problem','audience','differentiator','claim','evidence','entity')),
  item_id uuid NOT NULL,
  brand_brain_id uuid NOT NULL REFERENCES public.brand_brains(id) ON DELETE CASCADE,
  brand_brain_version integer NOT NULL,
  item_label text NOT NULL,
  origin text NOT NULL DEFAULT 'user_defined' CHECK (origin IN ('user_defined','brand_brain_suggestion')),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (territory_id, relation_kind, item_id)
);
GRANT SELECT ON public.brand_territory_relations TO authenticated;
GRANT ALL ON public.brand_territory_relations TO service_role;
ALTER TABLE public.brand_territory_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read territory relations" ON public.brand_territory_relations FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()));
CREATE INDEX brand_territory_relations_territory ON public.brand_territory_relations(territory_id);

-- Prepared for future territory-aware analyses (unused in 04A).
ALTER TABLE public.analises ADD COLUMN territory_id uuid REFERENCES public.brand_territories(id) ON DELETE SET NULL;

-- Atomic priority change: demotes the current active primary (→ secondary) before promoting.
CREATE OR REPLACE FUNCTION public.bt_set_priority(p_territory uuid, p_priority text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_emp uuid; v_prev uuid;
BEGIN
  IF p_priority NOT IN ('primary','secondary','exploratory') THEN RAISE EXCEPTION 'invalid_priority'; END IF;
  SELECT empresa_id INTO v_emp FROM public.brand_territories WHERE id = p_territory AND status <> 'archived' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'territory_not_found'; END IF;
  IF p_priority = 'primary' THEN
    PERFORM 1 FROM public.empresas WHERE id = v_emp FOR UPDATE;
    UPDATE public.brand_territories SET priority = 'secondary'
      WHERE empresa_id = v_emp AND priority = 'primary' AND status <> 'archived' AND id <> p_territory
      RETURNING id INTO v_prev;
  END IF;
  UPDATE public.brand_territories SET priority = p_priority WHERE id = p_territory;
  RETURN v_prev;
END $$;
REVOKE ALL ON FUNCTION public.bt_set_priority(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bt_set_priority(uuid, text) TO service_role;