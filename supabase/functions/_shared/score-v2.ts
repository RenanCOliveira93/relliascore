// RELLIA Content Score 2.0
// The overall score is computed HERE (backend), never by the LLM.
// content_score = semantic_relevance*0.30 + entity_clarity*0.20 + evidence_authority*0.20
//               + citation_readiness*0.15 + technical_geo*0.15
// The Content Score measures content readiness. It is NOT a probability of being recommended/cited by any AI engine.
import type { TechnicalSignals } from "./signals.ts";
import { parseActionPlan, type ParseResult, type ParsedActionItem } from "./model-parse.ts";

export const SCORE_VERSION = "2.0" as const;
export type ScoreVersion = typeof SCORE_VERSION | "legacy";

export const DIMENSION_KEYS = ["semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness", "technical_geo"] as const;
export type DimensionKey = typeof DIMENSION_KEYS[number];

export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  semantic_relevance: 0.30,
  entity_clarity: 0.20,
  evidence_authority: 0.20,
  citation_readiness: 0.15,
  technical_geo: 0.15,
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  semantic_relevance: "Relevância Semântica",
  entity_clarity: "Clareza & Entidade",
  evidence_authority: "Evidência & Autoridade",
  citation_readiness: "Prontidão para Citação",
  technical_geo: "Technical GEO",
};

export type DimensionSource = "deterministic" | "llm" | "hybrid";

export interface ScoreDimension {
  available: boolean;
  /** 0–100 with 2 decimals; null when unavailable */
  score: number | null;
  weight: number;
  source: DimensionSource;
  reason: string;
  evidence: string[];
  /** 0–1 */
  confidence: number;
}
export type ScoreDimensions = Record<DimensionKey, ScoreDimension>;

export interface ContentScoreResult {
  content_score: number;
  partial: boolean;
  weights_applied: Partial<Record<DimensionKey, number>>;
}

// ---------- helpers ----------
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const conf = (v: unknown): number => (isNum(v) ? r2(clamp(v, 0, 1)) : 0.5);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null);
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);

/** Validates a dimension score. Missing/invalid values are NEVER coerced to a default. */
export function validDimensionScore(v: unknown): number | null {
  if (!isNum(v) || v < 0 || v > 100) return null;
  return v;
}

/** Weighted formula. Throws on missing/invalid essential dimensions. technical_geo may be unavailable (text input): weights are renormalized and the result is flagged partial. */
export function computeContentScore(dims: Partial<Record<DimensionKey, number | null>>): ParseResult<ContentScoreResult> {
  const essential: DimensionKey[] = ["semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness"];
  for (const k of essential) if (validDimensionScore(dims[k]) === null) return { ok: false, reason: `invalid_dimension_${k}` };
  const tg = dims.technical_geo;
  if (tg !== null && tg !== undefined && validDimensionScore(tg) === null) return { ok: false, reason: "invalid_dimension_technical_geo" };
  const used = DIMENSION_KEYS.filter((k) => validDimensionScore(dims[k]) !== null);
  const totalW = used.reduce((s, k) => s + DIMENSION_WEIGHTS[k], 0);
  const weights_applied: Partial<Record<DimensionKey, number>> = {};
  let sum = 0;
  for (const k of used) {
    const w = DIMENSION_WEIGHTS[k] / totalW;
    weights_applied[k] = Math.round(w * 10000) / 10000;
    sum += (dims[k] as number) * w;
  }
  return { ok: true, value: { content_score: Math.round(clamp(sum, 0, 100) * 1000) / 1000, partial: used.length < DIMENSION_KEYS.length, weights_applied } };
}

// ---------- Technical GEO (deterministic) ----------
export interface TechnicalCheck { id: string; label: string; points: number; max: number }

export function computeTechnicalGeo(s: TechnicalSignals): { score: number; checks: TechnicalCheck[] } {
  const checks: TechnicalCheck[] = [];
  const add = (id: string, label: string, points: number, max: number) => checks.push({ id, label, points: r2(points), max });
  const indexable = s.http_status >= 200 && s.http_status < 300 && !s.robots_noindex;
  add("indexable", "HTTP 2xx e sem noindex", indexable ? 15 : 0, 15);
  add("title", "Title presente (≤65 caracteres)", !s.has_title ? 0 : s.title_length <= 65 ? 10 : 6, 10);
  add("meta_description", "Meta description presente", s.has_meta_description ? 10 : 0, 10);
  add("h1", "Exatamente um H1", s.h1_count === 1 ? 10 : s.h1_count > 1 ? 5 : 0, 10);
  add("subheadings", "Ao menos 2 subtítulos H2", s.h2_count >= 2 ? 5 : s.h2_count === 1 ? 2.5 : 0, 5);
  add("canonical", "Canonical coerente", !s.has_canonical ? 0 : s.canonical_matches_url === false ? 2 : 8, 8);
  add("lang", "Atributo lang", s.has_lang ? 5 : 0, 5);
  add("structured_data", "JSON-LD válido", !s.has_structured_data ? 0 : s.json_ld_invalid_count > 0 ? 6 : 12, 12);
  add("alt_text", "Cobertura de alt text", s.alt_text_coverage === null ? 5 : 5 * s.alt_text_coverage, 5);
  add("open_graph", "OpenGraph", s.has_open_graph ? 5 : 0, 5);
  add("author", "Autor identificado", s.has_author ? 5 : 0, 5);
  add("dates", "Data de publicação/atualização", s.has_published_date || s.has_modified_date ? 5 : 0, 5);
  add("content_length", "Conteúdo não raso (≥300 palavras)", s.thin_content ? 0 : 5, 5);
  const score = r2(checks.reduce((a, c) => a + c.points, 0));
  return { score: clamp(score, 0, 100), checks };
}

// ---------- Entity clarity ----------
export const ENTITY_CLARITY_KEYS = ["primary_entity", "entity_name_clear", "category_clear", "offering_clear", "audience_clear", "problem_clear", "value_proposition_clear", "differentiators_clear"] as const;
type EntityClarityKey = typeof ENTITY_CLARITY_KEYS[number];
const ENTITY_WEIGHTS: Record<EntityClarityKey, number> = {
  primary_entity: 10, entity_name_clear: 10, category_clear: 12.5, offering_clear: 17.5,
  audience_clear: 12.5, problem_clear: 12.5, value_proposition_clear: 15, differentiators_clear: 10,
};
export type ClarityStatus = "clear" | "partial" | "absent";
export interface ClarityItem { status: ClarityStatus; value?: string; evidence?: string; confidence: number }
export type EntityClarity = Record<EntityClarityKey, ClarityItem>;
const STATUS_POINTS: Record<ClarityStatus, number> = { clear: 100, partial: 50, absent: 0 };

function parseClarityItem(v: unknown): ClarityItem | null {
  const o = obj(v);
  if (!o || !["clear", "partial", "absent"].includes(o.status as string)) return null;
  const status = o.status as ClarityStatus;
  const evidence = str(o.evidence);
  // "clear" without literal evidence is downgraded to "partial" (no invented information).
  return { status: status === "clear" && !evidence ? "partial" : status, value: str(o.value), evidence, confidence: conf(o.confidence) };
}

// ---------- Evidence readiness ----------
export const EVIDENCE_KEYS = ["statistics", "external_references", "cases", "customers", "certifications", "studies", "author", "published_date", "modified_date"] as const;
type EvidenceKey = typeof EVIDENCE_KEYS[number];
export interface EvidenceItem { present: boolean; evidence?: string; confidence: number; source: DimensionSource }
export interface EvidenceReadiness {
  items: Record<EvidenceKey, EvidenceItem>;
  factual_claims: number;
  supported_claims: number;
  unsupported_claims: number;
  score: number;
  conflicts: string[];
}
const EVIDENCE_WEIGHTS: Record<EvidenceKey | "claim_support", number> = {
  statistics: 15, external_references: 15, cases: 10, customers: 10, certifications: 5, studies: 10,
  author: 10, published_date: 5, modified_date: 5, claim_support: 15,
};

// ---------- Citation readiness ----------
export const CITATION_KEYS = ["self_contained_facts", "clear_definitions", "direct_answers", "contextualized_numbers", "descriptive_headings", "claim_evidence_connection", "extractable_passages"] as const;
type CitationKey = typeof CITATION_KEYS[number];
export interface CitationFactor { score: number; evidence?: string; confidence: number; source: DimensionSource }
export interface CitationReadiness { factors: Record<CitationKey, CitationFactor>; score: number }

// ---------- Entities & claims ----------
export const ENTITY_TYPES = ["organization", "person", "product", "service", "technology", "location", "market", "concept", "other"] as const;
export interface EntitySignal { name: string; type: typeof ENTITY_TYPES[number]; evidence?: string; confidence: number; explicit_or_inferred: "explicit" | "inferred" }
export const SUPPORT_STATUS = ["supported", "partially_supported", "unsupported", "unknown"] as const;
export const SUPPORT_TYPES = ["statistic", "reference", "case", "testimonial", "certification", "study", "author", "none", "other"] as const;
export interface ContentClaim { summary: string; evidence?: string; support_status: typeof SUPPORT_STATUS[number]; support_type: typeof SUPPORT_TYPES[number]; confidence: number }

export function parseEntitySignals(v: unknown): EntitySignal[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e): EntitySignal[] => {
    const o = obj(e); const name = str(o?.name);
    if (!o || !name) return [];
    const type = (ENTITY_TYPES as readonly string[]).includes(o.type as string) ? o.type as EntitySignal["type"] : "other";
    const evidence = str(o.evidence);
    // "explicit" requires literal evidence.
    const eoi = o.explicit_or_inferred === "explicit" && evidence ? "explicit" : "inferred";
    return [{ name: name.slice(0, 200), type, evidence, confidence: conf(o.confidence), explicit_or_inferred: eoi }];
  }).slice(0, 30);
}

export function parseContentClaims(v: unknown): ContentClaim[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c): ContentClaim[] => {
    const o = obj(c); const summary = str(o?.summary);
    if (!o || !summary) return [];
    let status = (SUPPORT_STATUS as readonly string[]).includes(o.support_status as string) ? o.support_status as ContentClaim["support_status"] : "unknown";
    const type = (SUPPORT_TYPES as readonly string[]).includes(o.support_type as string) ? o.support_type as ContentClaim["support_type"] : "other";
    const evidence = str(o.evidence);
    // "supported" requires in-content evidence.
    if ((status === "supported" || status === "partially_supported") && !evidence) status = "unknown";
    return [{ summary: summary.slice(0, 500), evidence, support_status: status, support_type: type, confidence: conf(o.confidence) }];
  }).slice(0, 30);
}

// ---------- Semantic dimension from LLM ----------
interface LlmDimension { score: number; reason: string; evidence: string[]; confidence: number }
function parseLlmDimension(v: unknown): LlmDimension | null {
  const o = obj(v);
  if (!o) return null;
  const score = validDimensionScore(o.score);
  const reason = str(o.reason);
  if (score === null || !reason) return null;
  return { score, reason: reason.slice(0, 600), evidence: strArr(o.evidence).slice(0, 8), confidence: conf(o.confidence) };
}

/** Fields the LLM is NOT allowed to decide. They are dropped if present. */
export const FORBIDDEN_LLM_FIELDS = ["score", "content_score", "sub_scores", "technical_geo", "recommendation_probability", "ranking"] as const;

export interface V2Assessment {
  summary: string;
  strengths: string[];
  improvements: string[];
  compatibility_diagnostic: { conteudo_atual: string; conteudo_ideal: string; gap_analysis: string[]; compatibility_percentage: number };
  keywords_analysis: { found: string[]; missing: string[]; suggested: string[] };
  ideal_example: string;
  action_plan: ParsedActionItem[];
  semantic_relevance: LlmDimension;
  entity_clarity: EntityClarity;
  evidence_raw: Record<EvidenceKey, EvidenceItem>;
  citation_raw: Record<CitationKey, CitationFactor>;
  citation_reason: string;
  entity_signals: EntitySignal[];
  content_claims: ContentClaim[];
  ignored_fields: string[];
}

/** Validates the LLM semantic assessment (v2). Never fabricates values: invalid essential pieces fail. */
export function validateV2Assessment(raw: Record<string, unknown>, knownSignalIds: string[] = []): ParseResult<V2Assessment> {
  const ignored_fields = FORBIDDEN_LLM_FIELDS.filter((k) => k in raw);
  const summary = str(raw.summary);
  if (!summary) return { ok: false, reason: "missing_summary" };
  const semantic = parseLlmDimension(raw.semantic_relevance);
  if (!semantic) return { ok: false, reason: "invalid_semantic_relevance" };

  const ec = obj(raw.entity_clarity);
  if (!ec) return { ok: false, reason: "invalid_entity_clarity" };
  const entity_clarity = {} as EntityClarity;
  for (const k of ENTITY_CLARITY_KEYS) {
    const item = parseClarityItem(ec[k]);
    if (!item) return { ok: false, reason: `invalid_entity_clarity_${k}` };
    entity_clarity[k] = item;
  }

  const er = obj(raw.evidence_readiness);
  if (!er) return { ok: false, reason: "invalid_evidence_readiness" };
  const evidence_raw = {} as Record<EvidenceKey, EvidenceItem>;
  for (const k of EVIDENCE_KEYS) {
    const o = obj(er[k]);
    if (!o || typeof o.present !== "boolean") return { ok: false, reason: `invalid_evidence_${k}` };
    const evidence = str(o.evidence);
    evidence_raw[k] = { present: o.present && !!evidence, evidence, confidence: conf(o.confidence), source: "llm" };
  }

  const cr = obj(raw.citation_readiness);
  if (!cr) return { ok: false, reason: "invalid_citation_readiness" };
  const citation_raw = {} as Record<CitationKey, CitationFactor>;
  for (const k of CITATION_KEYS) {
    const o = obj(cr[k]);
    const s = validDimensionScore(o?.score);
    if (!o || s === null) return { ok: false, reason: `invalid_citation_${k}` };
    citation_raw[k] = { score: s, evidence: str(o.evidence), confidence: conf(o.confidence), source: "llm" };
  }

  const cd = obj(raw.compatibility_diagnostic);
  if (!cd || typeof cd.conteudo_atual !== "string" || typeof cd.conteudo_ideal !== "string" || !isNum(cd.compatibility_percentage)) {
    return { ok: false, reason: "invalid_compatibility" };
  }
  const kw = obj(raw.keywords_analysis) ?? {};

  return {
    ok: true,
    value: {
      summary,
      strengths: strArr(raw.strengths),
      improvements: strArr(raw.improvements),
      compatibility_diagnostic: {
        conteudo_atual: cd.conteudo_atual, conteudo_ideal: cd.conteudo_ideal, gap_analysis: strArr(cd.gap_analysis),
        compatibility_percentage: Math.round(clamp(cd.compatibility_percentage, 0, 100)),
      },
      keywords_analysis: { found: strArr(kw.found), missing: strArr(kw.missing), suggested: strArr(kw.suggested) },
      ideal_example: typeof raw.ideal_example === "string" ? raw.ideal_example : "",
      action_plan: parseActionPlan(raw.action_plan, knownSignalIds),
      semantic_relevance: semantic,
      entity_clarity,
      evidence_raw,
      citation_raw,
      citation_reason: str(cr.reason) ?? "Avaliação dos fatores de prontidão para citação.",
      entity_signals: parseEntitySignals(raw.entity_signals),
      content_claims: parseContentClaims(raw.content_claims),
      ignored_fields: [...ignored_fields],
    },
  };
}

// ---------- Scoring of each dimension ----------
const ENTITY_SCHEMA_TYPES = ["Organization", "Corporation", "LocalBusiness", "Person", "Product", "Service", "Brand", "ProfessionalService"];

export function scoreEntityClarity(ec: EntityClarity, s: TechnicalSignals | null): { dim: ScoreDimension } {
  const llmScore = ENTITY_CLARITY_KEYS.reduce((a, k) => a + STATUS_POINTS[ec[k].status] * ENTITY_WEIGHTS[k], 0) / 100;
  const evidence = ENTITY_CLARITY_KEYS.filter((k) => ec[k].evidence).map((k) => `${k}: ${ec[k].evidence}`).slice(0, 8);
  const avgConf = ENTITY_CLARITY_KEYS.reduce((a, k) => a + ec[k].confidence, 0) / ENTITY_CLARITY_KEYS.length;
  if (!s) {
    return { dim: { available: true, score: r2(llmScore), weight: DIMENSION_WEIGHTS.entity_clarity, source: "llm", reason: "Clareza da entidade avaliada semanticamente a partir do texto.", evidence, confidence: r2(avgConf) } };
  }
  const hasEntitySchema = s.schema_types.some((t) => ENTITY_SCHEMA_TYPES.includes(t));
  const det = ([s.has_title, s.has_meta_description, hasEntitySchema].filter(Boolean).length / 3) * 100;
  const score = r2(llmScore * 0.85 + det * 0.15);
  return {
    dim: {
      available: true, score, weight: DIMENSION_WEIGHTS.entity_clarity, source: "hybrid",
      reason: `Clareza semântica da entidade (85%) combinada com sinais verificáveis de identificação (15%): title ${s.has_title ? "sim" : "não"}, meta description ${s.has_meta_description ? "sim" : "não"}, schema de entidade ${hasEntitySchema ? "sim" : "não"}.`,
      evidence, confidence: r2(avgConf * 0.85 + 0.15),
    },
  };
}

export function scoreEvidenceReadiness(raw: Record<EvidenceKey, EvidenceItem>, claims: ContentClaim[], s: TechnicalSignals | null): { readiness: EvidenceReadiness; dim: ScoreDimension } {
  const items = { ...raw };
  const conflicts: string[] = [];
  // Deterministic facts win over LLM statements.
  if (s) {
    const facts: [EvidenceKey, boolean][] = [["author", s.has_author], ["published_date", s.has_published_date], ["modified_date", s.has_modified_date]];
    for (const [k, fact] of facts) {
      if (items[k].present !== fact) conflicts.push(`${k}: llm=${items[k].present} signal=${fact}`);
      items[k] = { present: fact, evidence: fact ? (items[k].evidence ?? "detectado nos metadados da página") : undefined, confidence: 1, source: "deterministic" };
    }
  }
  const factual = claims.filter((c) => c.support_status !== "unknown");
  const supported = claims.filter((c) => c.support_status === "supported").length;
  const partial = claims.filter((c) => c.support_status === "partially_supported").length;
  const unsupported = claims.filter((c) => c.support_status === "unsupported").length;

  let totalW = 0, sum = 0;
  for (const k of EVIDENCE_KEYS) { totalW += EVIDENCE_WEIGHTS[k]; sum += items[k].present ? EVIDENCE_WEIGHTS[k] : 0; }
  if (factual.length > 0) { totalW += EVIDENCE_WEIGHTS.claim_support; sum += EVIDENCE_WEIGHTS.claim_support * ((supported + partial * 0.5) / factual.length); }
  const score = r2(clamp((sum / totalW) * 100, 0, 100));
  const present = EVIDENCE_KEYS.filter((k) => items[k].present);
  const readiness: EvidenceReadiness = { items, factual_claims: factual.length, supported_claims: supported, unsupported_claims: unsupported, score, conflicts };
  const confs = EVIDENCE_KEYS.map((k) => items[k].confidence);
  return {
    readiness,
    dim: {
      available: true, score, weight: DIMENSION_WEIGHTS.evidence_authority, source: s ? "hybrid" : "llm",
      reason: `Mede prontidão de evidência dentro do conteúdo (não autoridade externa de domínio). Presentes: ${present.length ? present.join(", ") : "nenhuma"}.${factual.length ? ` Afirmações com suporte: ${supported}/${factual.length}.` : ""}`,
      evidence: present.map((k) => `${k}: ${items[k].evidence ?? ""}`).slice(0, 8),
      confidence: r2(confs.reduce((a, b) => a + b, 0) / confs.length),
    },
  };
}

export function scoreCitationReadiness(raw: Record<CitationKey, CitationFactor>, reason: string, s: TechnicalSignals | null): { readiness: CitationReadiness; dim: ScoreDimension } {
  const factors = { ...raw };
  if (s) {
    // Deterministic cap: no subheadings at all → descriptive headings cannot be high.
    const headings = s.h2_count + s.h3_count;
    if (headings === 0 && factors.descriptive_headings.score > 20) {
      factors.descriptive_headings = { ...factors.descriptive_headings, score: 20, source: "hybrid" };
    }
  }
  const score = r2(CITATION_KEYS.reduce((a, k) => a + factors[k].score, 0) / CITATION_KEYS.length);
  const confs = CITATION_KEYS.map((k) => factors[k].confidence);
  return {
    readiness: { factors, score },
    dim: {
      available: true, score, weight: DIMENSION_WEIGHTS.citation_readiness, source: s ? "hybrid" : "llm",
      reason: `${reason} Indica facilidade de uso como fonte; não garante citação por nenhuma IA.`,
      evidence: CITATION_KEYS.filter((k) => factors[k].evidence).map((k) => `${k}: ${factors[k].evidence}`).slice(0, 8),
      confidence: r2(confs.reduce((a, b) => a + b, 0) / confs.length),
    },
  };
}

export interface V2Output {
  score_version: typeof SCORE_VERSION;
  content_score: number;
  content_score_partial: boolean;
  weights_applied: Partial<Record<DimensionKey, number>>;
  score_dimensions: ScoreDimensions;
  entity_clarity: EntityClarity;
  evidence_readiness: EvidenceReadiness;
  citation_readiness: CitationReadiness;
  entity_signals: EntitySignal[];
  content_claims: ContentClaim[];
  technical_geo_checks: TechnicalCheck[] | null;
  /** Legacy adapters (UI/PDF/API compatibility). */
  score: number;
  sub_scores: Record<"relevancia_tematica" | "qualidade_conteudo" | "autoridade_percebida" | "otimizacao_llm" | "clareza_proposta_valor", number>;
}

export function buildV2Scores(a: V2Assessment, s: TechnicalSignals | null): ParseResult<V2Output> {
  const semantic: ScoreDimension = {
    available: true, score: r2(a.semantic_relevance.score), weight: DIMENSION_WEIGHTS.semantic_relevance, source: "llm",
    reason: a.semantic_relevance.reason, evidence: a.semantic_relevance.evidence, confidence: a.semantic_relevance.confidence,
  };
  const entity = scoreEntityClarity(a.entity_clarity, s).dim;
  const ev = scoreEvidenceReadiness(a.evidence_raw, a.content_claims, s);
  const cit = scoreCitationReadiness(a.citation_raw, a.citation_reason, s);
  let technical: ScoreDimension;
  let checks: TechnicalCheck[] | null = null;
  if (s) {
    const tg = computeTechnicalGeo(s);
    checks = tg.checks;
    technical = {
      available: true, score: tg.score, weight: DIMENSION_WEIGHTS.technical_geo, source: "deterministic",
      reason: `Calculado a partir de ${tg.checks.length} verificações técnicas observadas na página.`,
      evidence: tg.checks.map((c) => `${c.label}: ${c.points}/${c.max}`), confidence: 1,
    };
  } else {
    technical = {
      available: false, score: null, weight: DIMENSION_WEIGHTS.technical_geo, source: "deterministic",
      reason: "Indisponível para texto pré-publicação (não há página para medir).", evidence: [], confidence: 0,
    };
  }
  const dims: ScoreDimensions = { semantic_relevance: semantic, entity_clarity: entity, evidence_authority: ev.dim, citation_readiness: cit.dim, technical_geo: technical };
  const computed = computeContentScore(Object.fromEntries(DIMENSION_KEYS.map((k) => [k, dims[k].score])) as Record<DimensionKey, number | null>);
  if (!computed.ok) return computed;
  const round = (v: number | null) => (v === null ? 0 : Math.round(v));
  return {
    ok: true,
    value: {
      score_version: SCORE_VERSION,
      content_score: computed.value.content_score,
      content_score_partial: computed.value.partial,
      weights_applied: computed.value.weights_applied,
      score_dimensions: dims,
      entity_clarity: a.entity_clarity,
      evidence_readiness: ev.readiness,
      citation_readiness: cit.readiness,
      entity_signals: a.entity_signals,
      content_claims: a.content_claims,
      technical_geo_checks: checks,
      score: Math.round(computed.value.content_score),
      // Adapter: legacy keys filled from v2 dimensions (technical unavailable → citation readiness).
      sub_scores: {
        relevancia_tematica: round(semantic.score),
        clareza_proposta_valor: round(entity.score),
        autoridade_percebida: round(ev.dim.score),
        qualidade_conteudo: round(cit.dim.score),
        otimizacao_llm: technical.score === null ? round(cit.dim.score) : round(technical.score),
      },
    },
  };
}

/** Row fields for public.analises (additive). Legacy rows keep score_version NULL. */
export function v2AnaliseColumns(data: Record<string, unknown>): Record<string, unknown> {
  if (data.score_version !== SCORE_VERSION) return {};
  const dims = obj(data.score_dimensions) ?? {};
  const d = (k: DimensionKey) => { const x = obj(dims[k]); return x && isNum(x.score) ? x.score : null; };
  return {
    score_version: SCORE_VERSION,
    content_score: isNum(data.content_score) ? data.content_score : null,
    content_score_partial: data.content_score_partial === true,
    dim_semantic_relevance: d("semantic_relevance"),
    dim_entity_clarity: d("entity_clarity"),
    dim_evidence_authority: d("evidence_authority"),
    dim_citation_readiness: d("citation_readiness"),
    dim_technical_geo: d("technical_geo"),
    score_dimensions: data.score_dimensions ?? null,
    entity_clarity: data.entity_clarity ?? null,
    entity_signals: data.entity_signals ?? null,
    content_claims: data.content_claims ?? null,
    evidence_readiness: data.evidence_readiness ?? null,
    citation_readiness: data.citation_readiness ?? null,
    technical_signals: data.technical_signals ?? null,
  };
}

/** Interprets any stored/returned analysis version. Missing version = legacy (never recalculated). */
export function scoreVersionOf(data: { score_version?: unknown } | null | undefined): ScoreVersion {
  return data?.score_version === SCORE_VERSION ? SCORE_VERSION : "legacy";
}

// ---------- LLM tool schema (no overall score, no technical GEO) ----------
const dimSchema = (desc: string) => ({
  type: "object", description: desc,
  properties: { score: { type: "number", description: "0 a 100" }, reason: { type: "string", description: "Justificativa curta e apresentável ao usuário (1-2 frases). Sem raciocínio interno." }, evidence: { type: "array", items: { type: "string" }, description: "Trechos literais do conteúdo" }, confidence: { type: "number", description: "0 a 1" } },
  required: ["score", "reason", "evidence", "confidence"],
});
const clarityItem = { type: "object", properties: { status: { type: "string", enum: ["clear", "partial", "absent"] }, value: { type: "string" }, evidence: { type: "string", description: "Trecho literal; vazio se ausente" }, confidence: { type: "number" } }, required: ["status", "confidence"] };
const evidenceItem = { type: "object", properties: { present: { type: "boolean" }, evidence: { type: "string", description: "Trecho literal; vazio se ausente" }, confidence: { type: "number" } }, required: ["present", "confidence"] };
const citationItem = { type: "object", properties: { score: { type: "number", description: "0 a 100" }, evidence: { type: "string" }, confidence: { type: "number" } }, required: ["score", "confidence"] };

export function buildV2ToolSchema(actionItemSchema: Record<string, unknown>) {
  return {
    type: "object",
    properties: {
      summary: { type: "string", description: "Resumo de 2-3 frases" },
      strengths: { type: "array", items: { type: "string" } },
      improvements: { type: "array", items: { type: "string" } },
      semantic_relevance: dimSchema("Alinhamento com a consulta/intenção, cobertura, profundidade, contexto, conceitos e resposta à necessidade."),
      entity_clarity: { type: "object", properties: Object.fromEntries(ENTITY_CLARITY_KEYS.map((k) => [k, clarityItem])), required: [...ENTITY_CLARITY_KEYS] },
      evidence_readiness: { type: "object", description: "Evidências presentes NO conteúdo. Não é autoridade externa.", properties: Object.fromEntries(EVIDENCE_KEYS.map((k) => [k, evidenceItem])), required: [...EVIDENCE_KEYS] },
      citation_readiness: { type: "object", properties: { reason: { type: "string" }, ...Object.fromEntries(CITATION_KEYS.map((k) => [k, citationItem])) }, required: ["reason", ...CITATION_KEYS] },
      entity_signals: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: [...ENTITY_TYPES] }, evidence: { type: "string" }, confidence: { type: "number" }, explicit_or_inferred: { type: "string", enum: ["explicit", "inferred"] } }, required: ["name", "type", "confidence", "explicit_or_inferred"] } },
      content_claims: { type: "array", items: { type: "object", properties: { summary: { type: "string" }, evidence: { type: "string", description: "Trecho do conteúdo que sustenta a afirmação" }, support_status: { type: "string", enum: [...SUPPORT_STATUS] }, support_type: { type: "string", enum: [...SUPPORT_TYPES] }, confidence: { type: "number" } }, required: ["summary", "support_status", "support_type", "confidence"] } },
      compatibility_diagnostic: {
        type: "object",
        properties: { conteudo_atual: { type: "string" }, conteudo_ideal: { type: "string" }, gap_analysis: { type: "array", items: { type: "string" } }, compatibility_percentage: { type: "number" } },
        required: ["conteudo_atual", "conteudo_ideal", "gap_analysis", "compatibility_percentage"],
      },
      action_plan: { type: "array", items: actionItemSchema },
      keywords_analysis: {
        type: "object",
        properties: { found: { type: "array", items: { type: "string" } }, missing: { type: "array", items: { type: "string" } }, suggested: { type: "array", items: { type: "string" } } },
        required: ["found", "missing", "suggested"],
      },
      ideal_example: { type: "string", description: "Exemplo completo de conteúdo otimizado, em texto puro sem markdown." },
    },
    required: ["summary", "strengths", "improvements", "semantic_relevance", "entity_clarity", "evidence_readiness", "citation_readiness", "entity_signals", "content_claims", "compatibility_diagnostic", "action_plan", "keywords_analysis", "ideal_example"],
    additionalProperties: false,
  };
}
