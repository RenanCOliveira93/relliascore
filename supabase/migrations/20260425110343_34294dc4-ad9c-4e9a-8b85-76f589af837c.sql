-- 1) WORKSPACES: novos toggles e threshold
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS score_alert_threshold integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS monitoramento_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analise_marca_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS analise_competitiva_ativa boolean NOT NULL DEFAULT false;

-- 2) LEADS: colunas que faltavam
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS sub_scores jsonb,
  ADD COLUMN IF NOT EXISTS convertido boolean NOT NULL DEFAULT false;

-- 3) EMPRESAS
CREATE TABLE IF NOT EXISTS public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  url text NOT NULL,
  search_query text NOT NULL,
  monitoramento_ativo boolean NOT NULL DEFAULT true,
  analise_marca_ativa boolean NOT NULL DEFAULT false,
  linkedin_url text,
  instagram_url text,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_empresas_workspace ON public.empresas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_empresas_url ON public.empresas(url);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own empresas" ON public.empresas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own empresas" ON public.empresas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own empresas" ON public.empresas
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own empresas" ON public.empresas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4) CONCORRENTES
CREATE TABLE IF NOT EXISTS public.concorrentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  url text NOT NULL,
  search_query text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_concorrentes_workspace ON public.concorrentes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_concorrentes_empresa ON public.concorrentes(empresa_id);
ALTER TABLE public.concorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own concorrentes" ON public.concorrentes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own concorrentes" ON public.concorrentes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own concorrentes" ON public.concorrentes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own concorrentes" ON public.concorrentes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5) ANALISES
CREATE TABLE IF NOT EXISTS public.analises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('conteudo','marca')),
  score integer,
  summary text,
  sub_scores jsonb,
  keywords_analysis jsonb,
  action_plan jsonb,
  dados_marca jsonb,
  origem text NOT NULL DEFAULT 'webhook_ui',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analises_workspace ON public.analises(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analises_empresa ON public.analises(empresa_id);
CREATE INDEX IF NOT EXISTS idx_analises_created ON public.analises(created_at DESC);
ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own analises" ON public.analises
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own analises" ON public.analises
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own analises" ON public.analises
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6) PLANO_DE_ACAO
CREATE TABLE IF NOT EXISTS public.plano_de_acao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  analise_id uuid REFERENCES public.analises(id) ON DELETE SET NULL,
  priority text NOT NULL CHECK (priority IN ('alta','media','baixa')),
  action text NOT NULL,
  impact text,
  category text CHECK (category IN ('conteudo','tecnico','autoridade','estrutura')),
  concluida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plano_workspace ON public.plano_de_acao(workspace_id);
CREATE INDEX IF NOT EXISTS idx_plano_empresa ON public.plano_de_acao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plano_analise ON public.plano_de_acao(analise_id);
ALTER TABLE public.plano_de_acao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plano" ON public.plano_de_acao
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plano" ON public.plano_de_acao
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own plano" ON public.plano_de_acao
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plano" ON public.plano_de_acao
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7) ANALISES_COMPETITIVAS
CREATE TABLE IF NOT EXISTS public.analises_competitivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  concorrente_id uuid NOT NULL REFERENCES public.concorrentes(id) ON DELETE CASCADE,
  score integer,
  sub_scores jsonb,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_workspace ON public.analises_competitivas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comp_empresa ON public.analises_competitivas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_comp_concorrente ON public.analises_competitivas(concorrente_id);
ALTER TABLE public.analises_competitivas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own analises_competitivas" ON public.analises_competitivas
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own analises_competitivas" ON public.analises_competitivas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own analises_competitivas" ON public.analises_competitivas
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8) NOTIFICACOES
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  dados jsonb,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_workspace ON public.notificacoes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notif_lida ON public.notificacoes(workspace_id, lida);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notificacoes" ON public.notificacoes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- INSERT só por service role (sem policy = bloqueado para anon/authenticated; service role bypassa RLS)

-- 9) Trigger de updated_at em empresas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_updated_at ON public.empresas;
CREATE TRIGGER trg_empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10) Realtime para notificacoes
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;