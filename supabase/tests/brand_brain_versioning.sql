-- Brand Brain DB test (versioning, user_edit carry-forward, failure isolation, RLS).
-- Everything runs inside one DO block that ALWAYS aborts at the end, so no residual data is left.
-- Result is reported in the final exception message: 'BRAND_BRAIN_TEST_OK ...' or the failing assertion.
DO $$
DECLARE
  ua uuid := (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
  ub uuid := gen_random_uuid();
  ws uuid; emp uuid; v1 uuid; v2 uuid; n int; ok boolean := false;
  payload jsonb := jsonb_build_object(
    'brain', jsonb_build_object('company_name','Test Co','secondary_categories', jsonb_build_array('a'),'extraction_confidence',0.7),
    'children', jsonb_build_object(
      'brand_offerings', jsonb_build_array(jsonb_build_object('name','P1','type','product','problems_solved',jsonb_build_array('x'),'source_type','website','confidence',0.8,'explicit_or_inferred','explicit','evidence','e')),
      'brand_positioning', jsonb_build_array(
        jsonb_build_object('kind','declared','statement','Inteligência de varejo','source_type','user_description','confidence',0.9,'explicit_or_inferred','explicit'),
        jsonb_build_object('kind','observed','statement','Visão computacional','source_type','website','confidence',0.8,'explicit_or_inferred','explicit'))));
BEGIN
  INSERT INTO public.workspaces(user_id, name) VALUES (ua, '__bb_test__') RETURNING id INTO ws;
  INSERT INTO public.empresas(workspace_id, user_id, nome, url, search_query) VALUES (ws, ua, '__bb_test__', 'https://bbtest.example', 'q') RETURNING id INTO emp;

  -- 1) creation
  SELECT brand_brain_id INTO v1 FROM public.persist_brand_brain(ua, ws, emp, 'req-1', payload);
  IF NOT (SELECT is_active AND version = 1 AND secondary_categories = ARRAY['a'] FROM public.brand_brains WHERE id = v1) THEN RAISE EXCEPTION 'FAIL creation'; END IF;
  IF (SELECT count(*) FROM public.brand_positioning WHERE brand_brain_id = v1) <> 2 THEN RAISE EXCEPTION 'FAIL declared/observed rows'; END IF;

  -- simulate a future user edit on v1
  INSERT INTO public.brand_offerings(brand_brain_id, name, type, source_type, confidence, explicit_or_inferred, origin)
  VALUES (v1, 'Editado pelo usuário', 'service', 'user_edit', 1, 'explicit', 'user_edit');

  -- 2) new analysis → new version, previous preserved, user_edit carried
  SELECT brand_brain_id INTO v2 FROM public.persist_brand_brain(ua, ws, emp, 'req-2', payload);
  IF (SELECT version FROM public.brand_brains WHERE id = v2) <> 2 THEN RAISE EXCEPTION 'FAIL version 2'; END IF;
  IF (SELECT is_active FROM public.brand_brains WHERE id = v1) THEN RAISE EXCEPTION 'FAIL old still active'; END IF;
  IF (SELECT count(*) FROM public.brand_offerings WHERE brand_brain_id = v1) <> 2 THEN RAISE EXCEPTION 'FAIL v1 not preserved'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.brand_offerings WHERE brand_brain_id = v2 AND origin = 'user_edit' AND name = 'Editado pelo usuário' AND carried_from_id IS NOT NULL) THEN RAISE EXCEPTION 'FAIL user_edit not carried'; END IF;

  -- 3) failed persistence (invalid enum) must not replace the active version
  BEGIN
    PERFORM public.persist_brand_brain(ua, ws, emp, 'req-3', jsonb_set(payload, '{children,brand_offerings,0,type}', '"invalid"'));
    RAISE EXCEPTION 'FAIL invalid payload accepted';
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok OR NOT (SELECT is_active FROM public.brand_brains WHERE id = v2) OR (SELECT count(*) FROM public.brand_brains WHERE empresa_id = emp) <> 2 THEN RAISE EXCEPTION 'FAIL failure replaced active'; END IF;

  -- 4) wrong owner / wrong workspace rejected
  ok := false;
  BEGIN PERFORM public.persist_brand_brain(ub, ws, emp, 'x', payload); EXCEPTION WHEN raise_exception THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL foreign owner persisted'; END IF;

  -- 5) RLS: user B sees nothing and cannot write; user A reads own
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.brand_brains WHERE empresa_id = emp; IF n <> 0 THEN RAISE EXCEPTION 'FAIL B reads brains'; END IF;
  SELECT count(*) INTO n FROM public.brand_offerings WHERE brand_brain_id IN (v1, v2); IF n <> 0 THEN RAISE EXCEPTION 'FAIL B reads children'; END IF;
  ok := false;
  BEGIN INSERT INTO public.brand_offerings(brand_brain_id, name, type, source_type, confidence, explicit_or_inferred) VALUES (v2,'hack','product','website',0.5,'inferred');
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL B inserted'; END IF;
  UPDATE public.brand_brains SET company_name = 'hack' WHERE id = v2; -- no privilege → error caught below
  RAISE EXCEPTION 'FAIL B updated';
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO n FROM public.brand_brains WHERE empresa_id = emp;
    RESET ROLE;
    RAISE EXCEPTION 'BRAND_BRAIN_TEST_OK owner_sees=%', n;
END $$;
