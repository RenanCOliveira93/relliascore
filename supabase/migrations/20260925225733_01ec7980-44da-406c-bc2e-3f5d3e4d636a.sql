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

  FOREACH t IN ARRAY child_tables LOOP
    SELECT COALESCE(jsonb_object_agg(c.column_name, '[]'::jsonb), '{}') INTO defs FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = t AND c.data_type IN ('ARRAY','jsonb');
    arr := p_payload->'children'->t;
    IF arr IS NOT NULL AND jsonb_typeof(arr) = 'array' AND jsonb_array_length(arr) > 0 THEN
      EXECUTE format(
        'INSERT INTO public.%1$I SELECT (jsonb_populate_record(NULL::public.%1$I, $3 || jsonb_strip_nulls(e) || jsonb_build_object(''id'', gen_random_uuid(), ''brand_brain_id'', $1, ''origin'', ''extraction'', ''carried_from_id'', NULL, ''created_at'', now(), ''updated_at'', now(), ''observed_at'', COALESCE(e->>''observed_at'', now()::text)))).* FROM jsonb_array_elements($2) e',
        t) USING v_new, arr, defs;
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