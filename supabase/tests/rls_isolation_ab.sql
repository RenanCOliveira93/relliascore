-- Multi-tenant isolation A x B. Run as a single statement; it always ends with RAISE EXCEPTION so nothing persists.
-- Expected: A_own=allowed; A_into_B=42501 (RLS); A_as_B=42501 (RLS). Replace the UUIDs with two real users/workspaces.
DO $$
DECLARE r text := '';
  a_user uuid := '593220a0-938e-4c37-ac7b-29372acb45c7'; a_ws uuid := 'd3e5c9a8-9977-4a8a-ba94-49559650b6ef';
  b_user uuid := '0268d491-a319-4ac3-8363-99b93137ca12'; b_ws uuid := '9ac93a2a-c619-40c7-a206-ec60950fbab5';
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a_user, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO public.empresas (workspace_id, user_id, nome, url, search_query) VALUES (a_ws, a_user, 't', 'https://t.test', 'q'); r := r || 'A_own=allowed; ';
  EXCEPTION WHEN OTHERS THEN r := r || 'A_own=' || SQLSTATE || '; '; END;
  BEGIN INSERT INTO public.empresas (workspace_id, user_id, nome, url, search_query) VALUES (b_ws, a_user, 't', 'https://t.test', 'q'); r := r || 'A_into_B=ALLOWED(FAIL); ';
  EXCEPTION WHEN insufficient_privilege THEN r := r || 'A_into_B=42501; '; WHEN OTHERS THEN r := r || 'A_into_B=UNEXPECTED ' || SQLSTATE || '; '; END;
  BEGIN INSERT INTO public.analises (workspace_id, user_id, tipo, origem, score_version) VALUES (b_ws, b_user, 'conteudo', 'app', '2.0'); r := r || 'A_as_B=ALLOWED(FAIL); ';
  EXCEPTION WHEN insufficient_privilege THEN r := r || 'A_as_B=42501; '; WHEN OTHERS THEN r := r || 'A_as_B=UNEXPECTED ' || SQLSTATE || '; '; END;
  RAISE EXCEPTION 'RESULT: %', r;
END $$;
