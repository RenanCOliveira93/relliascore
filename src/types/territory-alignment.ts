// Territory Alignment 1.0 types (mirror of supabase/functions/_shared/territory-alignment.ts and territory-context.ts).
export type TADimension = "core_relevance" | "strategic_intent" | "topic_coverage" | "brand_territory_connection" | "evidence_support" | "semantic_focus";
export type TASeverity = "high" | "medium" | "low" | "info";

export interface TADimensionResult { available: boolean; score: number | null; weight: number; reason: string; evidence: string[]; territory_reference: string[]; confidence: number }
export interface TATopicCoverage { topics_present: string[]; relevant_topics_missing: string[]; topics_not_applicable: string[] }
export interface TAFinding { type: string; severity: TASeverity; dimension: TADimension; statement: string; content_evidence: string | null; territory_reference: string | null; territory_evidence: string | null; confidence: number; recommendation: string | null; classification?: string }
export interface TAStrength { statement: string; dimension: TADimension; territory_reference: string | null; content_evidence: string }
export interface TAGap { statement: string; gap_type: string; dimension: TADimension; territory_reference: string | null; recommendation: string | null }
export interface TANextAction { text: string; dimension: TADimension; territory_reference: string | null; priority: "high" | "medium" | "low" }

export interface TopicRef { id: string; text: string }
export interface TerritorySnapshot {
  territory_context_version: string; territory_id: string; empresa_id: string; company_name: string | null;
  territory_name: string; territory_type: string; priority: "primary" | "secondary" | "exploratory";
  strategic_intent: string | null; desired_association: string | null; core_concept: string | null; description: string | null; target_audience_summary: string | null;
  included_topics: TopicRef[]; excluded_topics: TopicRef[]; related_concepts: TopicRef[];
  relations: { id: string; relation_id: string; kind: string; label: string; detail: string | null; brand_brain_version: number; source_version_outdated: boolean }[];
  readiness: { connected: number; total: number; label: string };
  territory_updated_at: string; last_reviewed_brand_brain_version: number | null; active_brand_brain_version: number | null;
  selection: { truncated: boolean; excluded: { id: string; kind: string; reason: string }[]; used_chars: number; budget_chars: number };
}

export interface TerritoryAwareFields {
  territory_status?: "none" | "ok" | "failed";
  territory_id?: string | null;
  territory_snapshot?: TerritorySnapshot;
  territory_alignment_version?: string;
  territory_alignment_score?: number | null;
  territory_alignment_partial?: boolean;
  territory_alignment_weights_applied?: Partial<Record<TADimension, number>>;
  territory_alignment_dimensions?: Record<TADimension, TADimensionResult>;
  territory_topic_coverage?: TATopicCoverage;
  territory_findings?: TAFinding[];
  territory_strengths?: TAStrength[];
  territory_gaps?: TAGap[];
  territory_next_actions?: TANextAction[];
  territory_optimized_version?: string | null;
}
