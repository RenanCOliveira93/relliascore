
-- 1. Create plan enum
CREATE TYPE public.app_plan AS ENUM ('free', 'pro', 'premium');

-- 2. Create user_subscriptions table (account-level, NOT workspace-level)
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan app_plan NOT NULL DEFAULT 'free',
  analyses_used integer NOT NULL DEFAULT 0,
  analyses_limit integer NOT NULL DEFAULT 5,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Function to auto-create subscription on new user
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, analyses_limit)
  VALUES (NEW.id, 'free', 5);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_subscription
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_subscription();

-- 4. Create subscription for existing users
INSERT INTO public.user_subscriptions (user_id, plan, analyses_limit)
SELECT id, 'free', 5 FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions);

-- 5. Function to increment usage (called from edge functions or client)
CREATE OR REPLACE FUNCTION public.increment_analysis_usage(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
BEGIN
  SELECT * INTO v_sub FROM public.user_subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  
  -- Reset counter if new month
  IF v_sub.period_start < date_trunc('month', now()) THEN
    UPDATE public.user_subscriptions
    SET analyses_used = 1, period_start = date_trunc('month', now()), updated_at = now()
    WHERE user_id = p_user_id;
    RETURN true;
  END IF;
  
  -- Check limit (-1 means unlimited)
  IF v_sub.analyses_limit != -1 AND v_sub.analyses_used >= v_sub.analyses_limit THEN
    RETURN false;
  END IF;
  
  UPDATE public.user_subscriptions
  SET analyses_used = analyses_used + 1, updated_at = now()
  WHERE user_id = p_user_id;
  RETURN true;
END;
$$;
