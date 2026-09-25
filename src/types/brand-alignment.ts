// Brand Alignment 1.0 types (mirror of supabase/functions/_shared/brand-alignment.ts and brand-context.ts).
export type BADimension = "positioning" | "offering" | "audience_problem" | "differentiation" | "claim_evidence" | "voice";
export type Basis = "human_defined" | "declared" | "observed" | "inferred";
export type Severity = "high" | "medium" | "low" | "info";

export interface BADimensionResult { available: boolean; score: number | null; weight: number; reason: string; evidence: string[]; brand_refs: string[]; confidence: number; status?: "aligned" | "partially_aligned" | "weak" | "conflicting" }
export interface BAFinding { type: string; severity: Severity; dimension: BADimension; statement: string; brand_reference: string | null; content_evidence: string | null; brand_evidence: string | null; confidence: number; recommendation: string | null; basis: Basis | null; classification?: string }
export interface BAStrength { statement: string; dimension: BADimension; brand_reference: string | null; content_evidence: string }
export interface BAGap { statement: string; gap_type: "inconsistency" | "missing_opportunity" | "unknown_to_brand_profile"; dimension: BADimension; brand_reference: string | null; recommendation: string | null }
export interface BAEntityFinding { mention: string; status: "consistent" | "ambiguous" | "not_found" | "conflict"; brand_reference: string | null; note: string }
export interface BARecommendation { text: string; dimension: BADimension; brand_reference: string | null }

export interface CtxField { value: string; basis: Basis; ref: string }
export interface BrandContextSnapshot {
  brand_context_version: string; brand_brain_id: string; brand_brain_version: number; empresa_id: string; company_name: string | null;
  primary_category: CtxField | null; preferred_positioning: CtxField | null; observed_positioning: CtxField | null; value_proposition: CtxField | null;
  offerings: { id: string; name: string }[]; audiences: { id: string; name: string }[]; problems: { id: string; name: string; offering_ids: string[] }[];
  differentiators: { id: string; statement: string }[]; claims: { id: string; statement: string }[]; evidence: { id: string; title: string }[];
  entities: { id: string; name: string }[]; voice: { id: string; sufficient: boolean } | null;
  selection: { included: { kind: string; id: string; relevance: number }[]; excluded: { kind: string; id: string; reason: string }[]; truncated: boolean; budget_chars: number; used_chars: number };
}

export interface BrandAwareFields {
  brand_aware?: boolean;
  brand_context_status?: "none" | "no_brand_brain" | "ok" | "failed";
  empresa_id?: string | null;
  brand_context_snapshot?: BrandContextSnapshot;
  brand_alignment_version?: string;
  brand_alignment_score?: number | null;
  brand_alignment_partial?: boolean;
  brand_alignment_weights_applied?: Partial<Record<BADimension, number>>;
  brand_alignment_dimensions?: Record<BADimension, BADimensionResult>;
  brand_alignment_findings?: BAFinding[];
  brand_strengths?: BAStrength[];
  brand_gaps?: BAGap[];
  brand_entity_consistency?: BAEntityFinding[];
  brand_recommendations?: BARecommendation[];
  brand_optimized_version?: string | null;
}
