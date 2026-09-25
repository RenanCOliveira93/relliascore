
CREATE TABLE public.brand_brains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'extracted' CHECK (status IN ('draft','extracted','reviewed')),
  is_active boolean NOT NULL DEFAULT false,
  model_version text NOT NULL DEFAULT 'brand_brain_v1',
  request_id text,
  company_name text,
  primary_domain text,
  short_description text,
  long_description text,
  primary_category text,
  secondary_categories text[] NOT NULL DEFAULT '{}',
  business_model text,
  geographic_markets text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  positioning text,
  value_proposition text,
  mission text,
  target_summary text,
  tone_summary text,
  visual_summary text,
  positioning_conflicts jsonb NOT NULL DEFAULT '[]',
  field_provenance jsonb NOT NULL DEFAULT '{}',
  sources_status jsonb NOT NULL DEFAULT '[]',
  suggested_pages jsonb NOT NULL DEFAULT '[]',
  extraction_confidence numeric CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
  last_analyzed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, version)
);
CREATE UNIQUE INDEX brand_brains_one_active ON public.brand_brains(empresa_id) WHERE is_active;
CREATE INDEX brand_brains_ws ON public.brand_brains(workspace_id);
GRANT SELECT ON public.brand_brains TO authenticated;
GRANT ALL ON public.brand_brains TO service_role;
ALTER TABLE public.brand_brains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read brand brains" ON public.brand_brains FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()));
CREATE TRIGGER trg_brand_brains_updated_at BEFORE UPDATE ON public.brand_brains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $$
DECLARE t text; extra text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_offerings','brand_audiences','brand_problems','brand_differentiators','brand_claims','brand_evidence','brand_entities','brand_positioning','brand_voice','brand_visual_identity'] LOOP
    extra := CASE t
      WHEN 'brand_offerings' THEN $x$name text NOT NULL, type text NOT NULL CHECK (type IN ('product','service','platform','solution','other')), description text, category text, target_audience text, problems_solved text[] NOT NULL DEFAULT '{}', value_proposition text,$x$
      WHEN 'brand_audiences' THEN $x$name text NOT NULL, description text, audience_type text NOT NULL CHECK (audience_type IN ('company','professional','consumer','creator','institution','other')), needs text[] NOT NULL DEFAULT '{}', problems text[] NOT NULL DEFAULT '{}', industries text[] NOT NULL DEFAULT '{}', roles text[] NOT NULL DEFAULT '{}',$x$
      WHEN 'brand_problems' THEN $x$name text NOT NULL, description text, affected_audience text[] NOT NULL DEFAULT '{}', related_offerings text[] NOT NULL DEFAULT '{}',$x$
      WHEN 'brand_differentiators' THEN $x$statement text NOT NULL, category text NOT NULL CHECK (category IN ('technology','methodology','expertise','performance','experience','integration','service','positioning','other')),$x$
      WHEN 'brand_claims' THEN $x$statement text NOT NULL, claim_type text NOT NULL CHECK (claim_type IN ('performance','market','customer','technology','capability','experience','certification','statistic','positioning','other')), verification_status text NOT NULL CHECK (verification_status IN ('evidenced','partially_evidenced','unevidenced','unknown')), evidence_refs text[] NOT NULL DEFAULT '{}',$x$
      WHEN 'brand_evidence' THEN $x$evidence_type text NOT NULL CHECK (evidence_type IN ('case_study','customer','testimonial','statistic','certification','award','research','partnership','publication','result','other')), title text NOT NULL, description text, value text,$x$
      WHEN 'brand_entities' THEN $x$name text NOT NULL, entity_type text NOT NULL CHECK (entity_type IN ('organization','person','product','service','technology','location','market','concept','customer','partner','other')), relationship text, description text,$x$
      WHEN 'brand_positioning' THEN $x$kind text NOT NULL CHECK (kind IN ('declared','observed')), statement text, primary_category text, alternative_categories text[] NOT NULL DEFAULT '{}', value_proposition text, differentiators text[] NOT NULL DEFAULT '{}', target_market text,$x$
      WHEN 'brand_voice' THEN $x$tone_traits text[] NOT NULL DEFAULT '{}', communication_style text, vocabulary_preferred text[] NOT NULL DEFAULT '{}', vocabulary_avoided text[] NOT NULL DEFAULT '{}', complexity_level text, formality text, emotional_style text, recurring_phrases text[] NOT NULL DEFAULT '{}',$x$
      WHEN 'brand_visual_identity' THEN $x$primary_colors jsonb NOT NULL DEFAULT '[]', secondary_colors jsonb NOT NULL DEFAULT '[]', accent_colors jsonb NOT NULL DEFAULT '[]', detected_fonts text[] NOT NULL DEFAULT '{}', logo_url text, visual_style text, imagery_style text, consistency_notes text,$x$
    END;
    EXECUTE format($f$
      CREATE TABLE public.%1$I (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_brain_id uuid NOT NULL REFERENCES public.brand_brains(id) ON DELETE CASCADE,
        %2$s
        source_type text NOT NULL CHECK (source_type IN ('website','linkedin','instagram','user_description','user_edit','existing_brand_analysis')),
        source_url text,
        evidence text,
        confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
        explicit_or_inferred text NOT NULL CHECK (explicit_or_inferred IN ('explicit','inferred')),
        observed_at timestamptz NOT NULL DEFAULT now(),
        sources jsonb NOT NULL DEFAULT '[]',
        origin text NOT NULL DEFAULT 'extraction' CHECK (origin IN ('extraction','user_edit')),
        carried_from_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX %1$s_brain_idx ON public.%1$I(brand_brain_id);
      GRANT SELECT ON public.%1$I TO authenticated;
      GRANT ALL ON public.%1$I TO service_role;
      ALTER TABLE public.%1$I ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Owners read" ON public.%1$I FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.brand_brains b JOIN public.workspaces w ON w.id = b.workspace_id
                       WHERE b.id = brand_brain_id AND b.user_id = auth.uid() AND w.user_id = auth.uid()));
      CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    $f$, t, extra);
  END LOOP;
END $$;

ALTER TABLE public.brand_analyses ADD COLUMN brand_brain_id uuid REFERENCES public.brand_brains(id) ON DELETE SET NULL;

-- Atomic persistence: create version, insert children, carry user_edit rows forward, then flip active.
-- Any error rolls everything back, so the previously active version stays active.
CREATE OR REPLACE FUNCTION public.persist_brand_brain(p_user_id uuid, p_workspace_id uuid, p_empresa_id uuid, p_request_id text, p_payload jsonb)
RETURNS TABLE(brand_brain_id uuid, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old uuid; v_new uuid := gen_random_uuid(); v_ver integer; t text; arr jsonb;
  child_tables text[] := ARRAY['brand_offerings','brand_audiences','brand_problems','brand_differentiators','brand_claims','brand_evidence','brand_entities','brand_positioning','brand_voice','brand_visual_identity'];
BEGIN
  PERFORM 1 FROM public.empresas e JOIN public.workspaces w ON w.id = e.workspace_id
    WHERE e.id = p_empresa_id AND e.workspace_id = p_workspace_id AND e.user_id = p_user_id AND w.user_id = p_user_id
    FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden_empresa'; END IF;

  SELECT b.id INTO v_old FROM public.brand_brains b WHERE b.empresa_id = p_empresa_id AND b.is_active;
  SELECT COALESCE(max(b.version), 0) + 1 INTO v_ver FROM public.brand_brains b WHERE b.empresa_id = p_empresa_id;

  INSERT INTO public.brand_brains
  SELECT (jsonb_populate_record(NULL::public.brand_brains,
    jsonb_strip_nulls(COALESCE(p_payload->'brain', '{}'::jsonb)) || jsonb_build_object(
      'id', v_new, 'workspace_id', p_workspace_id, 'empresa_id', p_empresa_id, 'user_id', p_user_id,
      'version', v_ver, 'status', 'extracted', 'is_active', false, 'request_id', p_request_id,
      'model_version', COALESCE(p_payload->'brain'->>'model_version', 'brand_brain_v1'),
      'secondary_categories', COALESCE(p_payload->'brain'->'secondary_categories', '[]'),
      'geographic_markets', COALESCE(p_payload->'brain'->'geographic_markets', '[]'),
      'languages', COALESCE(p_payload->'brain'->'languages', '[]'),
      'positioning_conflicts', COALESCE(p_payload->'brain'->'positioning_conflicts', '[]'),
      'field_provenance', COALESCE(p_payload->'brain'->'field_provenance', '{}'),
      'sources_status', COALESCE(p_payload->'brain'->'sources_status', '[]'),
      'suggested_pages', COALESCE(p_payload->'brain'->'suggested_pages', '[]'),
      'last_analyzed_at', now(), 'created_at', now(), 'updated_at', now()))).*;

  FOREACH t IN ARRAY child_tables LOOP
    arr := p_payload->'children'->t;
    IF arr IS NOT NULL AND jsonb_typeof(arr) = 'array' AND jsonb_array_length(arr) > 0 THEN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, e || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''origin'', ''extraction'', ''carried_from_id'', NULL, ''created_at'', now(), ''updated_at'', now(), ''observed_at'', COALESCE(e->>''observed_at'', now()::text), ''sources'', COALESCE(e->''sources'', ''[]''::jsonb)))).* FROM jsonb_array_elements($2) e',
        t) USING v_new, arr;
    END IF;
    IF v_old IS NOT NULL THEN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, to_jsonb(x) || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''carried_from_id'', x.id, ''created_at'', now(), ''updated_at'', now()))).* FROM public.%1$I x WHERE x.brand_brain_id = $2 AND x.origin = ''user_edit''',
        t) USING v_new, v_old;
    END IF;
  END LOOP;

  UPDATE public.brand_brains SET is_active = false WHERE id = v_old;
  UPDATE public.brand_brains SET is_active = true WHERE id = v_new;
  RETURN QUERY SELECT v_new, v_ver;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_brand_brain(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_brand_brain(uuid, uuid, uuid, text, jsonb) TO service_role;
