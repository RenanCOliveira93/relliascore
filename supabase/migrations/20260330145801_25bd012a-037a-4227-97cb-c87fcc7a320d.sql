
-- 1. Create workspaces table
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own workspaces" ON public.workspaces
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspaces" ON public.workspaces
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspaces" ON public.workspaces
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspaces" ON public.workspaces
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Add workspace_id to brand_analyses
ALTER TABLE public.brand_analyses ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

-- 3. Function to auto-create default workspace on new user
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.workspaces (user_id, name)
  VALUES (NEW.id, 'Meu Espaço');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_workspace
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_workspace();

-- 4. Create default workspace for existing users
INSERT INTO public.workspaces (user_id, name)
SELECT id, 'Meu Espaço' FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.workspaces);

-- 5. Assign existing brand_analyses to their user's default workspace
UPDATE public.brand_analyses ba
SET workspace_id = (
  SELECT w.id FROM public.workspaces w
  WHERE w.user_id = ba.user_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE ba.workspace_id IS NULL;
