DO $$
DECLARE t text; ins text; upd text;
BEGIN
  FOR t, ins, upd IN SELECT * FROM (VALUES
    ('empresas','Users insert own empresas','Users update own empresas'),
    ('concorrentes','Users insert own concorrentes','Users update own concorrentes'),
    ('analises','Users insert own analises',NULL),
    ('analises_competitivas','Users insert own analises_competitivas',NULL),
    ('plano_de_acao','Users insert own plano','Users update own plano'),
    ('brand_analyses','Users can insert own brand analyses',NULL),
    ('workspace_api_keys','Users can insert own api keys','Users can update own api keys'),
    ('workspace_webhooks','Users can insert own webhooks','Users can update own webhooks')
  ) v(t,i,u) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', ins, t);
    EXECUTE format($p$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (workspace_id IS NULL OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid())))$p$, ins, t);
    IF upd IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', upd, t);
      EXECUTE format($p$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND (workspace_id IS NULL OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.user_id = auth.uid())))$p$, upd, t);
    END IF;
  END LOOP;
END $$;