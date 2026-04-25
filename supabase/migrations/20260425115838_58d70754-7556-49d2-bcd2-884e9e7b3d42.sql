UPDATE public.user_subscriptions
SET plan = 'premium',
    analyses_limit = -1,
    analyses_used = 0,
    period_start = date_trunc('month', now()),
    updated_at = now()
WHERE user_id = '593220a0-938e-4c37-ac7b-29372acb45c7';

INSERT INTO public.user_subscriptions (user_id, plan, analyses_limit, analyses_used)
SELECT '593220a0-938e-4c37-ac7b-29372acb45c7', 'premium', -1, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions WHERE user_id = '593220a0-938e-4c37-ac7b-29372acb45c7'
);