DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.increment_analysis_usage(uuid)',
    'public.refund_analysis_usage(uuid)',
    'public.check_rate_limit(text,text,integer,integer)',
    'public.validate_api_key(text)',
    'public.record_webhook_delivery(uuid,boolean,text)',
    'public.handle_new_user()',
    'public.handle_new_subscription()',
    'public.handle_new_workspace()',
    'public.set_updated_at()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;