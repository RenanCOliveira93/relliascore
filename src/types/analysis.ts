export type AnalysisMode = "influencer" | "business";
export type InputType = "webpage" | "text";

export interface SubScores {
  relevancia_tematica: number;
  qualidade_conteudo: number;
  autoridade_percebida: number;
  otimizacao_llm: number;
  clareza_proposta_valor: number;
}

export interface CompatibilityDiagnostic {
  conteudo_atual: string;
  conteudo_ideal: string;
  gap_analysis: string[];
  compatibility_percentage: number;
}

export interface ActionPlanItem {
  priority: "alta" | "media" | "baixa";
  action: string;
  impact: string;
  category: "conteudo" | "tecnico" | "autoridade" | "estrutura";
  reason?: string;
  evidence?: string;
  /** 0–1 */
  confidence?: number;
  basis?: "signal" | "content" | "inference";
  signal_ref?: string;
}

export type AnalysisStatus = "success" | "crawl_failed" | "invalid_url" | "timeout" | "unsupported_content" | "analysis_failed";

export interface TechnicalIssue { id: string; severity: "alta" | "media" | "baixa"; message: string }

/** Deterministic facts computed server-side (never produced by the LLM). */
export interface TechnicalSignals {
  http_status: number;
  redirected: boolean;
  has_title: boolean;
  title_length: number;
  has_meta_description: boolean;
  meta_description_length: number;
  has_canonical: boolean;
  canonical_matches_url: boolean | null;
  robots_noindex: boolean;
  has_lang: boolean;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  word_count: number;
  thin_content: boolean;
  internal_links_count: number;
  external_links_count: number;
  images_count: number;
  images_missing_alt: number;
  alt_text_coverage: number | null;
  has_structured_data: boolean;
  json_ld_invalid_count: number;
  schema_types: string[];
  has_open_graph: boolean;
  has_author: boolean;
  has_published_date: boolean;
  has_modified_date: boolean;
  issues: TechnicalIssue[];
}

export interface SourceMeta {
  input_type: InputType;
  requested_url?: string;
  final_url?: string;
  http_status?: number;
  content_truncated: boolean;
  original_chars: number;
  sent_chars: number;
}

export interface AnalysisFailure {
  status: Exclude<AnalysisStatus, "success">;
  error: string;
  request_id?: string;
}

export interface KeywordsAnalysis {
  found: string[];
  missing: string[];
  suggested: string[];
}

export interface AnalysisResult {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  sub_scores: SubScores;
  compatibility_diagnostic: CompatibilityDiagnostic;
  action_plan: ActionPlanItem[];
  keywords_analysis: KeywordsAnalysis;
  ideal_example?: string;
  status?: "success";
  schema_version?: string;
  analysis_id?: string;
  request_id?: string;
  technical_signals?: TechnicalSignals | null;
  llm_assessment?: Record<string, unknown>;
  source_meta?: SourceMeta;
}
