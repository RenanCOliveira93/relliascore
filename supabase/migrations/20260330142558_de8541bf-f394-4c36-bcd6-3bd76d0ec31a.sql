
CREATE TABLE public.brand_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'business',
  website text,
  linkedin text,
  instagram text,
  description text NOT NULL,
  result jsonb NOT NULL
);

ALTER TABLE public.brand_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own brand analyses"
  ON public.brand_analyses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brand analyses"
  ON public.brand_analyses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own brand analyses"
  ON public.brand_analyses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
