CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key text NOT NULL,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, endpoint, window_start)
);
GRANT ALL ON public.rate_limit_buckets TO service_role;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_idx ON public.rate_limit_buckets (window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_endpoint text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_buckets (bucket_key, endpoint, window_start, count)
  VALUES (p_key, p_endpoint, v_window, 1)
  ON CONFLICT (bucket_key, endpoint, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO v_count;

  IF random() < 0.01 THEN
    DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_analysis_usage(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.user_subscriptions
  SET analyses_used = GREATEST(analyses_used - 1, 0), updated_at = now()
  WHERE user_id = p_user_id AND period_start >= date_trunc('month', now());
$$;
REVOKE ALL ON FUNCTION public.refund_analysis_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_analysis_usage(uuid) TO service_role;