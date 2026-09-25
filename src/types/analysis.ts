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
  affected_dimension?: DimensionKey;
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

export interface AnalysisResult extends ContentScoreV2Fields {
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

// ---------- RELLIA Content Score 2.0 ----------
/** Absent score_version on stored/returned analyses means "legacy" (never recalculated, not comparable with 2.0). */
export type ScoreVersion = "2.0" | "legacy";
export type DimensionKey = "semantic_relevance" | "entity_clarity" | "evidence_authority" | "citation_readiness" | "technical_geo";
export type DimensionSource = "deterministic" | "llm" | "hybrid";

export interface ScoreDimension {
  available: boolean;
  score: number | null;
  weight: number;
  source: DimensionSource;
  reason: string;
  evidence: string[];
  confidence: number;
}
export type ScoreDimensions = Record<DimensionKey, ScoreDimension>;

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  semantic_relevance: "Relevância Semântica",
  entity_clarity: "Clareza & Entidade",
  evidence_authority: "Evidência & Autoridade",
  citation_readiness: "Prontidão para Citação",
  technical_geo: "Technical GEO",
};

export type EntityType = "organization" | "person" | "product" | "service" | "technology" | "location" | "market" | "concept" | "other";
export interface EntitySignal { name: string; type: EntityType; evidence?: string; confidence: number; explicit_or_inferred: "explicit" | "inferred" }

export interface ContentClaim {
  summary: string;
  evidence?: string;
  support_status: "supported" | "partially_supported" | "unsupported" | "unknown";
  support_type: "statistic" | "reference" | "case" | "testimonial" | "certification" | "study" | "author" | "none" | "other";
  confidence: number;
}

export interface EvidenceItem { present: boolean; evidence?: string; confidence: number; source: DimensionSource }
export type EvidenceKey = "statistics" | "external_references" | "cases" | "customers" | "certifications" | "studies" | "author" | "published_date" | "modified_date";
export interface EvidenceReadiness {
  items: Record<EvidenceKey, EvidenceItem>;
  factual_claims: number;
  supported_claims: number;
  unsupported_claims: number;
  score: number;
  conflicts: string[];
}

export type CitationKey = "self_contained_facts" | "clear_definitions" | "direct_answers" | "contextualized_numbers" | "descriptive_headings" | "claim_evidence_connection" | "extractable_passages";
export interface CitationFactor { score: number; evidence?: string; confidence: number; source: DimensionSource }
export interface CitationReadiness { factors: Record<CitationKey, CitationFactor>; score: number }

export type ClarityStatus = "clear" | "partial" | "absent";
export interface ClarityItem { status: ClarityStatus; value?: string; evidence?: string; confidence: number }
export type EntityClarityKey = "primary_entity" | "entity_name_clear" | "category_clear" | "offering_clear" | "audience_clear" | "problem_clear" | "value_proposition_clear" | "differentiators_clear";
export type EntityClarity = Record<EntityClarityKey, ClarityItem>;

export interface ContentScoreV2Fields {
  score_version?: "2.0";
  content_score?: number;
  content_score_partial?: boolean;
  weights_applied?: Partial<Record<DimensionKey, number>>;
  score_dimensions?: ScoreDimensions;
  entity_clarity?: EntityClarity;
  evidence_readiness?: EvidenceReadiness;
  citation_readiness?: CitationReadiness;
  entity_signals?: EntitySignal[];
  content_claims?: ContentClaim[];
  dimensions_used?: DimensionKey[];
  technical_geo?: TechnicalGeoAudit | null;
}

// ---------- Technical GEO 2.0 (ruleset v1) ----------
export type RuleStatus = "pass" | "warning" | "fail" | "not_applicable" | "unavailable";
export type RuleSeverity = "info" | "low" | "medium" | "high" | "critical";
export interface TechnicalGeoRule {
  id: string; version: string; category: string; label: string; description: string;
  max_points: number; status: RuleStatus; score: number | null; evidence: string; recommendation: string | null; severity: RuleSeverity;
}
export interface TechnicalGeoAudit {
  technical_geo_version: string;
  page_type: { page_type: string; confidence: number; source: string };
  score: number;
  coverage: number;
  rules: TechnicalGeoRule[];
  critical_issues: { rule_id: string; label: string; evidence: string; recommendation: string | null }[];
  quick_wins: { rule_id: string; label: string; evidence: string; recommendation: string | null; severity: RuleSeverity }[];
  structured_data_recommendations: { schema_type: string; reason: string; applicable: boolean; priority: "high" | "medium" | "low" }[];
  ai_crawler_access: { status: string; crawlers: { token: string; operator: string; category: string; verdict: string; matched_rule: string | null }[]; note: string } | null;
}

export const scoreVersionOf = (r: { score_version?: string | null } | null | undefined): ScoreVersion =>
  r?.score_version === "2.0" ? "2.0" : "legacy";
