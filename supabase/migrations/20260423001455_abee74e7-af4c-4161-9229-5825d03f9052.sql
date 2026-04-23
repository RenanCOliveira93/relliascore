
-- API Keys table
CREATE TABLE public.workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_api_keys_workspace ON public.workspace_api_keys(workspace_id);
CREATE INDEX idx_workspace_api_keys_hash ON public.workspace_api_keys(key_hash);

ALTER TABLE public.workspace_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own api keys"
  ON public.workspace_api_keys FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON public.workspace_api_keys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON public.workspace_api_keys FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON public.workspace_api_keys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Webhooks table
CREATE TABLE public.workspace_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['analysis.completed','brand_analysis.completed']::TEXT[],
  secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workspace_webhooks_workspace ON public.workspace_webhooks(workspace_id);

ALTER TABLE public.workspace_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own webhooks"
  ON public.workspace_webhooks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own webhooks"
  ON public.workspace_webhooks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON public.workspace_webhooks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own webhooks"
  ON public.workspace_webhooks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Function: validate api key (called from edge function with service role)
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE(workspace_id UUID, user_id UUID, key_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.workspace_api_keys
  SET last_used_at = now()
  WHERE key_hash = p_key_hash AND is_active = true
  RETURNING workspace_api_keys.workspace_id, workspace_api_keys.user_id, workspace_api_keys.id;
END;
$$;

-- Function: record webhook delivery
CREATE OR REPLACE FUNCTION public.record_webhook_delivery(
  p_webhook_id UUID,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_success THEN
    UPDATE public.workspace_webhooks
    SET success_count = success_count + 1,
        last_triggered_at = now(),
        last_error = NULL
    WHERE id = p_webhook_id;
  ELSE
    UPDATE public.workspace_webhooks
    SET failure_count = failure_count + 1,
        last_triggered_at = now(),
        last_error = p_error
    WHERE id = p_webhook_id;
  END IF;
END;
$$;
