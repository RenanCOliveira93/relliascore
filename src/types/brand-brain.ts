// Brand Brain v1 types (mirror of supabase/functions/_shared/brand-brain.ts and the brand_* tables).
// Confidence is always the confidence of the EXTRACTED datum (0–1), never a commercial rating of the brand.

export type BrandSourceType = "website" | "linkedin" | "instagram" | "user_description" | "user_edit" | "existing_brand_analysis";
export type BrandSourceStatusValue = "fetched" | "blocked" | "login_required" | "unavailable" | "invalid" | "not_provided";
export type ExplicitOrInferred = "explicit" | "inferred";
export type BrandBrainStatus = "draft" | "extracted" | "reviewed";
export type ItemOrigin = "extraction" | "user_edit";

export interface BrandSourceStatus { source: "website" | "linkedin" | "instagram" | "user_description"; status: BrandSourceStatusValue; url?: string; reason?: string; content_truncated?: boolean }
export interface BrandSource { source_type: BrandSourceType; source_url: string | null; evidence: string | null; confidence: number; explicit_or_inferred: ExplicitOrInferred; observed_at: string }

interface Item extends BrandSource { id: string; brand_brain_id: string; sources: BrandSource[]; origin: ItemOrigin; carried_from_id: string | null; supersedes_id: string | null; human_status: "none" | "confirmed" | "rejected"; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string }

export interface BrandOffering extends Item { name: string; type: "product" | "service" | "platform" | "solution" | "other"; description: string | null; category: string | null; target_audience: string | null; problems_solved: string[]; value_proposition: string | null }
export interface BrandAudience extends Item { name: string; description: string | null; audience_type: "company" | "professional" | "consumer" | "creator" | "institution" | "other"; needs: string[]; problems: string[]; industries: string[]; roles: string[] }
export interface BrandProblem extends Item { name: string; description: string | null; affected_audience: string[]; related_offerings: string[] }
export interface BrandDifferentiator extends Item { statement: string; category: "technology" | "methodology" | "expertise" | "performance" | "experience" | "integration" | "service" | "positioning" | "other" }
export interface BrandClaim extends Item { statement: string; claim_type: "performance" | "market" | "customer" | "technology" | "capability" | "experience" | "certification" | "statistic" | "positioning" | "other"; verification_status: "evidenced" | "partially_evidenced" | "unevidenced" | "unknown"; evidence_refs: string[] }
export interface BrandEvidence extends Item { evidence_type: "case_study" | "customer" | "testimonial" | "statistic" | "certification" | "award" | "research" | "partnership" | "publication" | "result" | "other"; title: string; description: string | null; value: string | null }
export interface BrandEntity extends Item { name: string; entity_type: "organization" | "person" | "product" | "service" | "technology" | "location" | "market" | "concept" | "customer" | "partner" | "other"; relationship: string | null; description: string | null }
export interface BrandPositioning extends Item { kind: "declared" | "observed"; statement: string | null; primary_category: string | null; alternative_categories: string[]; value_proposition: string | null; differentiators: string[]; target_market: string | null }
export interface BrandVoice extends Item { tone_traits: string[]; communication_style: string | null; vocabulary_preferred: string[]; vocabulary_avoided: string[]; complexity_level: string | null; formality: string | null; emotional_style: string | null; recurring_phrases: string[] }
export interface ColorRef { hex: string; name: string | null }
export interface BrandVisualIdentity extends Item { primary_colors: ColorRef[]; secondary_colors: ColorRef[]; accent_colors: ColorRef[]; detected_fonts: string[]; logo_url: string | null; visual_style: string | null; imagery_style: string | null; consistency_notes: string | null }

export interface FieldProvenance { source_type: BrandSourceType; evidence: string | null; confidence: number; explicit_or_inferred: ExplicitOrInferred }
export interface PositioningDifference { aspect: string; declared: string | null; observed: string | null; note: string }

/** One row of brand_brains = one version. Exactly one active version per empresa. */
export interface BrandBrainVersion {
  id: string; workspace_id: string; empresa_id: string; user_id: string;
  version: number; status: BrandBrainStatus; is_active: boolean; model_version: string; request_id: string | null;
  company_name: string | null; primary_domain: string | null; short_description: string | null; long_description: string | null;
  primary_category: string | null; secondary_categories: string[]; business_model: string | null;
  geographic_markets: string[]; languages: string[]; positioning: string | null; value_proposition: string | null;
  mission: string | null; target_summary: string | null; tone_summary: string | null; visual_summary: string | null;
  positioning_conflicts: PositioningDifference[]; field_provenance: Record<string, FieldProvenance>;
  sources_status: BrandSourceStatus[]; suggested_pages: string[];
  extraction_confidence: number | null; last_analyzed_at: string; created_at: string; updated_at: string;
}

export interface BrandBrain extends BrandBrainVersion {
  offerings: BrandOffering[]; audiences: BrandAudience[]; problems: BrandProblem[]; differentiators: BrandDifferentiator[];
  claims: BrandClaim[]; evidence: BrandEvidence[]; entities: BrandEntity[]; positioning_items: BrandPositioning[];
  voice: BrandVoice | null; visual_identity: BrandVisualIdentity | null;
}

/** Summary returned by analyze-brand alongside the legacy report. */
export interface BrandBrainResult {
  persisted: boolean; reason?: "no_empresa" | "no_structured_knowledge" | "persist_failed";
  brand_brain_id?: string; version?: number; empresa_id?: string; extraction_confidence?: number | null;
  sources_status: BrandSourceStatus[]; dropped_items: number;
}

// ---------- 03B Brand Profile ----------
export type HumanStatus = "none" | "confirmed" | "rejected";
/** How a piece of knowledge is presented. user_edit/human_confirmed are human; confirmation is NOT external evidence. */
export type BrandKnowledgeStatus = "observed" | "declared" | "inferred" | "user_edit" | "human_confirmed" | "rejected";

export interface HumanConfirmation { status: Exclude<HumanStatus, "none">; reviewed_by: string; reviewed_at: string }

export type OverrideField = "company_name" | "short_description" | "long_description" | "primary_category" | "business_model" | "value_proposition" | "mission" | "target_summary" | "tone_summary" | "visual_summary" | "positioning" | "secondary_categories" | "geographic_markets" | "languages";
export interface BrandFieldOverride {
  id: string; brand_brain_id: string; field: OverrideField; status: "user_edit" | "confirmed";
  value: string | string[] | null; observed_value: string | string[] | null; user_id: string; created_at: string; updated_at: string;
}

export interface ClaimEvidenceRelationship {
  id: string; brand_brain_id: string; claim_id: string; evidence_id: string;
  relationship_type: "supports" | "partially_supports" | "contradicts" | "related"; origin: ItemOrigin; created_by: string | null; created_at: string;
}

export interface BrandAuditEvent {
  id: string; workspace_id: string; empresa_id: string; brand_brain_id: string | null; user_id: string;
  action: string; target_table: string | null; target_id: string | null; field: string | null;
  old_value: unknown; new_value: unknown; request_id: string | null; created_at: string;
}

export interface BrandBrainCompleteness { filled: number; total: number; label: string; areas: { key: string; label: string; filled: boolean }[] }

/** Everything the Brand Profile screen shows for one version (active or historical, read-only). */
export interface BrandProfileView {
  brain: BrandBrainVersion; readOnly: boolean;
  overrides: BrandFieldOverride[]; links: ClaimEvidenceRelationship[];
  offerings: BrandOffering[]; audiences: BrandAudience[]; problems: BrandProblem[]; differentiators: BrandDifferentiator[];
  claims: BrandClaim[]; evidence: BrandEvidence[]; entities: BrandEntity[]; positioning_items: BrandPositioning[];
  voice: BrandVoice[]; visual_identity: BrandVisualIdentity[];
}
