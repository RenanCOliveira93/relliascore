
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_offerings','brand_audiences','brand_problems','brand_differentiators','brand_claims','brand_evidence','brand_entities','brand_positioning','brand_voice','brand_visual_identity'] LOOP
    EXECUTE format($f$
      ALTER TABLE public.%1$I
        ADD COLUMN human_status text NOT NULL DEFAULT 'none' CHECK (human_status IN ('none','confirmed','rejected')),
        ADD COLUMN reviewed_by uuid,
        ADD COLUMN reviewed_at timestamptz,
        ADD COLUMN supersedes_id uuid;
    $f$, t);
  END LOOP;
END $$;

CREATE TABLE public.brand_field_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_brain_id uuid NOT NULL REFERENCES public.brand_brains(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('company_name','short_description','long_description','primary_category','business_model','value_proposition','mission','target_summary','tone_summary','visual_summary','positioning','secondary_categories','geographic_markets','languages')),
  status text NOT NULL CHECK (status IN ('user_edit','confirmed')),
  value jsonb,
  observed_value jsonb,
  user_id uuid NOT NULL,
  carried_from_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_brain_id, field)
);
GRANT SELECT ON public.brand_field_overrides TO authenticated;
GRANT ALL ON public.brand_field_overrides TO service_role;
ALTER TABLE public.brand_field_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read" ON public.brand_field_overrides FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brand_brains b JOIN public.workspaces w ON w.id = b.workspace_id WHERE b.id = brand_brain_id AND b.user_id = auth.uid() AND w.user_id = auth.uid()));
CREATE TRIGGER trg_brand_field_overrides_updated_at BEFORE UPDATE ON public.brand_field_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.brand_claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_brain_id uuid NOT NULL REFERENCES public.brand_brains(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.brand_claims(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.brand_evidence(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'supports' CHECK (relationship_type IN ('supports','partially_supports','contradicts','related')),
  origin text NOT NULL DEFAULT 'extraction' CHECK (origin IN ('extraction','user_edit')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, evidence_id)
);
CREATE INDEX brand_claim_evidence_brain ON public.brand_claim_evidence(brand_brain_id);
GRANT SELECT ON public.brand_claim_evidence TO authenticated;
GRANT ALL ON public.brand_claim_evidence TO service_role;
ALTER TABLE public.brand_claim_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read" ON public.brand_claim_evidence FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.brand_brains b JOIN public.workspaces w ON w.id = b.workspace_id WHERE b.id = brand_brain_id AND b.user_id = auth.uid() AND w.user_id = auth.uid()));

CREATE TABLE public.brand_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  brand_brain_id uuid REFERENCES public.brand_brains(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  field text,
  old_value jsonb,
  new_value jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_audit_log_empresa ON public.brand_audit_log(empresa_id, created_at DESC);
GRANT SELECT ON public.brand_audit_log TO authenticated;
GRANT ALL ON public.brand_audit_log TO service_role;
ALTER TABLE public.brand_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read" ON public.brand_audit_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid()));

-- Normalized natural key used to match items across versions (conservative, exact after normalization).
CREATE OR REPLACE FUNCTION public.bb_norm(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS
$$ SELECT trim(regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]+', ' ', 'g')) $$;

CREATE OR REPLACE FUNCTION public.bb_item_key(p_table text, r jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_table
    WHEN 'brand_offerings' THEN (r->>'type') || ':' || public.bb_norm(r->>'name')
    WHEN 'brand_audiences' THEN public.bb_norm(r->>'name')
    WHEN 'brand_problems' THEN public.bb_norm(r->>'name')
    WHEN 'brand_differentiators' THEN public.bb_norm(r->>'statement')
    WHEN 'brand_claims' THEN public.bb_norm(r->>'statement')
    WHEN 'brand_evidence' THEN (r->>'evidence_type') || ':' || public.bb_norm(r->>'title')
    WHEN 'brand_entities' THEN (r->>'entity_type') || ':' || public.bb_norm(r->>'name')
    WHEN 'brand_positioning' THEN (r->>'kind') || ':' || (r->>'source_type')
    ELSE 'singleton' END
$$;

CREATE OR REPLACE FUNCTION public.persist_brand_brain(p_user_id uuid, p_workspace_id uuid, p_empresa_id uuid, p_request_id text, p_payload jsonb)
RETURNS TABLE(brand_brain_id uuid, version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old uuid; v_new uuid := gen_random_uuid(); v_ver integer; t text; arr jsonb; defs jsonb;
  child_tables text[] := ARRAY['brand_offerings','brand_audiences','brand_problems','brand_differentiators','brand_claims','brand_evidence','brand_entities','brand_positioning','brand_voice','brand_visual_identity'];
BEGIN
  PERFORM 1 FROM public.empresas e JOIN public.workspaces w ON w.id = e.workspace_id
    WHERE e.id = p_empresa_id AND e.workspace_id = p_workspace_id AND e.user_id = p_user_id AND w.user_id = p_user_id
    FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden_empresa'; END IF;

  SELECT b.id INTO v_old FROM public.brand_brains b WHERE b.empresa_id = p_empresa_id AND b.is_active;
  SELECT COALESCE(max(b.version), 0) + 1 INTO v_ver FROM public.brand_brains b WHERE b.empresa_id = p_empresa_id;

  SELECT COALESCE(jsonb_object_agg(c.column_name, CASE WHEN c.column_name = 'field_provenance' THEN '{}'::jsonb ELSE '[]'::jsonb END), '{}')
    INTO defs FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'brand_brains' AND c.data_type IN ('ARRAY','jsonb');

  INSERT INTO public.brand_brains
  SELECT (jsonb_populate_record(NULL::public.brand_brains,
    defs || jsonb_strip_nulls(COALESCE(p_payload->'brain', '{}'::jsonb)) || jsonb_build_object(
      'id', v_new, 'workspace_id', p_workspace_id, 'empresa_id', p_empresa_id, 'user_id', p_user_id,
      'version', v_ver, 'status', 'extracted', 'is_active', false, 'request_id', p_request_id,
      'model_version', COALESCE(p_payload->'brain'->>'model_version', 'brand_brain_v1'),
      'last_analyzed_at', now(), 'created_at', now(), 'updated_at', now()))).*;

  CREATE TEMP TABLE IF NOT EXISTS _bb_map(old_id uuid PRIMARY KEY, new_id uuid) ON COMMIT DROP;
  DELETE FROM _bb_map;

  FOREACH t IN ARRAY child_tables LOOP
    SELECT COALESCE(jsonb_object_agg(c.column_name, '[]'::jsonb), '{}') INTO defs FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t AND c.data_type IN ('ARRAY','jsonb');
    arr := p_payload->'children'->t;
    -- 1) fresh extraction (human fields forced to defaults)
    IF arr IS NOT NULL AND jsonb_typeof(arr) = 'array' AND jsonb_array_length(arr) > 0 THEN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, $3 || jsonb_strip_nulls(e) || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''origin'', ''extraction'', ''carried_from_id'', NULL, ''supersedes_id'', NULL, ''human_status'', ''none'', ''reviewed_by'', NULL, ''reviewed_at'', NULL, ''created_at'', now(), ''updated_at'', now(), ''observed_at'', COALESCE(e->>''observed_at'', now()::text)))).* FROM jsonb_array_elements($2) e',
        t) USING v_new, arr, defs;
    END IF;
    IF v_old IS NOT NULL THEN
      -- 2) reviewed extracted items that reappear: inherit the human decision (rejections are never silently reactivated)
      EXECUTE format(
        'WITH prev AS (SELECT x.id, x.human_status, x.reviewed_by, x.reviewed_at, public.bb_item_key(%1$L, to_jsonb(x)) k FROM public.%1$I x WHERE x.brand_brain_id = $2 AND x.origin = ''extraction'' AND x.human_status <> ''none''),
              cur AS (SELECT y.id, public.bb_item_key(%1$L, to_jsonb(y)) k FROM public.%1$I y WHERE y.brand_brain_id = $1 AND y.origin = ''extraction''),
              m AS (SELECT DISTINCT ON (prev.id) prev.*, cur.id AS new_id FROM prev JOIN cur ON cur.k = prev.k ORDER BY prev.id),
              upd AS (UPDATE public.%1$I z SET human_status = m.human_status, reviewed_by = m.reviewed_by, reviewed_at = m.reviewed_at FROM m WHERE z.id = m.new_id RETURNING m.id AS old_id, z.id AS new_id)
         INSERT INTO _bb_map SELECT old_id, new_id FROM upd ON CONFLICT DO NOTHING', t) USING v_new, v_old;
      -- also map unreviewed extracted items that reappear (so user edits/links can re-point to them)
      EXECUTE format(
        'INSERT INTO _bb_map SELECT DISTINCT ON (x.id) x.id, y.id FROM public.%1$I x JOIN public.%1$I y ON y.brand_brain_id = $1 AND y.origin = ''extraction'' AND public.bb_item_key(%1$L, to_jsonb(y)) = public.bb_item_key(%1$L, to_jsonb(x))
         WHERE x.brand_brain_id = $2 AND x.origin = ''extraction'' ORDER BY x.id ON CONFLICT DO NOTHING', t) USING v_new, v_old;
      -- 3) reviewed extracted items that did NOT reappear: carry the old row so the decision is not lost
      EXECUTE format(
        'WITH src AS (SELECT x.* FROM public.%1$I x WHERE x.brand_brain_id = $2 AND x.origin = ''extraction'' AND x.human_status <> ''none'' AND NOT EXISTS (SELECT 1 FROM _bb_map mm WHERE mm.old_id = x.id)),
              ins AS (INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, to_jsonb(s) || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''carried_from_id'', s.id, ''created_at'', now(), ''updated_at'', now()))).* FROM src s RETURNING id, carried_from_id)
         INSERT INTO _bb_map SELECT carried_from_id, id FROM ins ON CONFLICT DO NOTHING', t) USING v_new, v_old;
      -- 4) user_edit rows: always carried, supersedes_id re-pointed to the matching new item (or cleared)
      EXECUTE format(
        'WITH ins AS (INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, to_jsonb(x) || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''carried_from_id'', x.id, ''supersedes_id'', (SELECT mm.new_id FROM _bb_map mm WHERE mm.old_id = x.supersedes_id), ''created_at'', now(), ''updated_at'', now()))).* FROM public.%1$I x WHERE x.brand_brain_id = $2 AND x.origin = ''user_edit'' RETURNING id, carried_from_id)
         INSERT INTO _bb_map SELECT carried_from_id, id FROM ins ON CONFLICT DO NOTHING', t) USING v_new, v_old;
    END IF;
  END LOOP;

  -- Claim ↔ evidence by ID for this extraction (model refers to evidence titles; resolved here once, within the version).
  INSERT INTO public.brand_claim_evidence(brand_brain_id, claim_id, evidence_id, relationship_type, origin)
  SELECT DISTINCT ON (c.id, e.id) v_new, c.id, e.id, 'supports', 'extraction'
  FROM public.brand_claims c CROSS JOIN LATERAL unnest(c.evidence_refs) ref
  JOIN public.brand_evidence e ON e.brand_brain_id = v_new AND public.bb_norm(e.title) = public.bb_norm(ref)
  WHERE c.brand_brain_id = v_new AND c.origin = 'extraction'
  ON CONFLICT DO NOTHING;

  IF v_old IS NOT NULL THEN
    -- human links carried with both ends re-mapped; unmappable links are dropped
    INSERT INTO public.brand_claim_evidence(brand_brain_id, claim_id, evidence_id, relationship_type, origin, created_by)
    SELECT v_new, mc.new_id, me.new_id, l.relationship_type, 'user_edit', l.created_by
    FROM public.brand_claim_evidence l
    JOIN _bb_map mc ON mc.old_id = l.claim_id JOIN _bb_map me ON me.old_id = l.evidence_id
    WHERE l.brand_brain_id = v_old AND l.origin = 'user_edit'
    ON CONFLICT (claim_id, evidence_id) DO UPDATE SET relationship_type = EXCLUDED.relationship_type, origin = 'user_edit', created_by = EXCLUDED.created_by;

    INSERT INTO public.brand_field_overrides(brand_brain_id, field, status, value, observed_value, user_id, carried_from_id)
    SELECT v_new, o.field, o.status, o.value, o.observed_value, o.user_id, o.id FROM public.brand_field_overrides o WHERE o.brand_brain_id = v_old;
  END IF;

  UPDATE public.brand_brains SET is_active = false WHERE id = v_old;
  UPDATE public.brand_brains SET is_active = true WHERE id = v_new;
  RETURN QUERY SELECT v_new, v_ver;
END;
$$;
REVOKE ALL ON FUNCTION public.persist_brand_brain(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_brand_brain(uuid, uuid, uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bb_item_key(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bb_norm(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bb_item_key(text, jsonb), public.bb_norm(text) TO service_role;
