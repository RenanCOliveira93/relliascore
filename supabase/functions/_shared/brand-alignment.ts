// Brand Alignment 1.0 (03C). Independent from Content Score 2.0 — never averaged with it.
// The model gives structured per-dimension assessments; the backend validates references against the Brand Context
// snapshot and computes the final score with fixed weights (redistributed only across available dimensions).
import { contextIds, type Basis, type BrandContextSnapshot } from "./brand-context.ts";

export const BRAND_ALIGNMENT_VERSION = "1.0";
export type BADimension = "positioning" | "offering" | "audience_problem" | "differentiation" | "claim_evidence" | "voice";
export const BA_WEIGHTS: Record<BADimension, number> = {
  positioning: 0.25, offering: 0.20, audience_problem: 0.20, differentiation: 0.15, claim_evidence: 0.10, voice: 0.10,
};
export const BA_ORDER = Object.keys(BA_WEIGHTS) as BADimension[];
export const POSITIONING_STATUS = ["aligned", "partially_aligned", "weak", "conflicting"] as const;
export const CLAIM_CLASS = ["supported_by_brand_profile", "partially_supported", "not_found_in_brand_profile", "conflicts_with_brand_profile", "not_applicable"] as const;
export const ENTITY_STATUS = ["consistent", "ambiguous", "not_found", "conflict"] as const;
export const GAP_TYPES = ["inconsistency", "missing_opportunity", "unknown_to_brand_profile"] as const;
export const SEVERITIES = ["high", "medium", "low", "info"] as const;

export interface BADimensionResult { available: boolean; score: number | null; weight: number; reason: string; evidence: string[]; brand_refs: string[]; confidence: number; status?: string }
export interface BAFinding {
  type: string; severity: typeof SEVERITIES[number]; dimension: BADimension; statement: string;
  brand_reference: string | null; content_evidence: string | null; brand_evidence: string | null;
  confidence: number; recommendation: string | null; basis: Basis | null; classification?: string;
}
export interface BAStrength { statement: string; dimension: BADimension; brand_reference: string | null; content_evidence: string }
export interface BAGap { statement: string; gap_type: typeof GAP_TYPES[number]; dimension: BADimension; brand_reference: string | null; recommendation: string | null }
export interface BAEntityFinding { mention: string; status: typeof ENTITY_STATUS[number]; brand_reference: string | null; note: string }
export interface BARecommendation { text: string; dimension: BADimension; brand_reference: string | null }

export interface BrandAlignmentResult {
  brand_alignment_version: string;
  brand_alignment_score: number | null;
  brand_alignment_partial: boolean;
  brand_alignment_weights_applied: Partial<Record<BADimension, number>>;
  brand_alignment_dimensions: Record<BADimension, BADimensionResult>;
  brand_alignment_findings: BAFinding[];
  brand_strengths: BAStrength[];
  brand_gaps: BAGap[];
  brand_entity_consistency: BAEntityFinding[];
  brand_recommendations: BARecommendation[];
  brand_optimized_version: string | null;
  discarded_references: number;
}

// ---------- Deterministic availability from the snapshot (absence in Brand Brain is never a zero) ----------
export function availabilityFromContext(s: BrandContextSnapshot): Record<BADimension, { available: boolean; reason: string }> {
  const ok = (v: boolean, missing: string) => ({ available: v, reason: v ? "" : missing });
  return {
    positioning: ok(!!(s.preferred_positioning || s.primary_category || s.value_proposition), "Posicionamento ainda não está definido no Brand Profile. Esta dimensão não entrou no cálculo."),
    offering: ok(s.offerings.length > 0, "Nenhum produto ou serviço registrado no Brand Profile. Esta dimensão não entrou no cálculo."),
    audience_problem: ok(s.audiences.length + s.problems.length > 0, "Públicos e problemas ainda não estão definidos no Brand Profile. Esta dimensão não entrou no cálculo."),
    differentiation: ok(s.differentiators.length > 0, "Diferenciais ainda não estão definidos no Brand Profile. Esta dimensão não entrou no cálculo."),
    claim_evidence: ok(s.claims.length + s.evidence.length > 0, "Claims e evidências ainda não estão cadastradas no Brand Profile. Esta dimensão não entrou no cálculo."),
    voice: ok(!!s.voice?.sufficient, s.voice ? "Brand Voice tem pouca evidência no Brand Profile. Esta dimensão não entrou no cálculo." : "Brand Voice ainda não está definida no Brand Profile. Esta dimensão não entrou no cálculo."),
  };
}

/** Weighted formula with redistribution among available dimensions. Returns null score when none is available. */
export function computeBrandAlignment(dims: Record<BADimension, { available: boolean; score: number | null }>) {
  const avail = BA_ORDER.filter((k) => dims[k].available && typeof dims[k].score === "number");
  const total = avail.reduce((a, k) => a + BA_WEIGHTS[k], 0);
  const weights: Partial<Record<BADimension, number>> = {};
  if (!avail.length || total <= 0) return { score: null, partial: true, weights };
  let sum = 0;
  for (const k of avail) { const w = Math.round((BA_WEIGHTS[k] / total) * 10000) / 10000; weights[k] = w; sum += (dims[k].score as number) * (BA_WEIGHTS[k] / total); }
  return { score: Math.round(Math.max(0, Math.min(100, sum))), partial: avail.length < BA_ORDER.length, weights };
}

// ---------- Model schema ----------
const DIM_SCHEMA = {
  type: "object",
  properties: {
    applicable: { type: "boolean", description: "false quando o tema do conteúdo não permite avaliar esta dimensão" },
    score: { type: "number", description: "0–100" },
    status: { type: "string", description: "Para positioning: aligned|partially_aligned|weak|conflicting" },
    reason: { type: "string" },
    content_evidence: { type: "array", items: { type: "string" }, description: "Trechos literais do conteúdo" },
    brand_refs: { type: "array", items: { type: "string" }, description: "IDs exatos do contexto de marca" },
    confidence: { type: "number" },
  },
  required: ["applicable", "score", "reason", "content_evidence", "brand_refs", "confidence"],
};
const ref = { type: "string", description: "ID exato do contexto de marca ou vazio" };
const dimEnum = { type: "string", enum: BA_ORDER };
export const BRAND_TOOL_SCHEMA = {
  type: "object",
  properties: {
    dimensions: { type: "object", properties: Object.fromEntries(BA_ORDER.map((k) => [k, DIM_SCHEMA])), required: BA_ORDER },
    claim_checks: { type: "array", items: { type: "object", properties: {
      content_claim: { type: "string" }, classification: { type: "string", enum: CLAIM_CLASS }, brand_ref: ref,
      conflict_evidence: { type: "string", description: "Texto do Brand Profile que contradiz explicitamente. Obrigatório para conflicts_with_brand_profile." },
      recommendation: { type: "string" }, confidence: { type: "number" } }, required: ["content_claim", "classification", "confidence"] } },
    findings: { type: "array", items: { type: "object", properties: {
      type: { type: "string" }, severity: { type: "string", enum: SEVERITIES }, dimension: dimEnum, statement: { type: "string" },
      brand_ref: ref, content_evidence: { type: "string" }, recommendation: { type: "string" }, confidence: { type: "number" } },
      required: ["type", "severity", "dimension", "statement", "confidence"] } },
    entity_checks: { type: "array", items: { type: "object", properties: {
      mention: { type: "string" }, status: { type: "string", enum: ENTITY_STATUS }, brand_ref: ref, note: { type: "string" } }, required: ["mention", "status", "note"] } },
    strengths: { type: "array", items: { type: "object", properties: {
      statement: { type: "string" }, dimension: dimEnum, brand_ref: ref, content_evidence: { type: "string" } }, required: ["statement", "dimension", "content_evidence"] } },
    gaps: { type: "array", items: { type: "object", properties: {
      statement: { type: "string" }, gap_type: { type: "string", enum: GAP_TYPES }, dimension: dimEnum, brand_ref: ref, recommendation: { type: "string" } },
      required: ["statement", "gap_type", "dimension"] } },
    recommendations: { type: "array", items: { type: "object", properties: { text: { type: "string" }, dimension: dimEnum, brand_ref: ref }, required: ["text", "dimension"] } },
    optimized_version: { type: "string", description: "Versão otimizada brand-aware, texto puro sem markdown, sem fatos novos" },
  },
  required: ["dimensions", "claim_checks", "findings", "entity_checks", "strengths", "gaps", "recommendations", "optimized_version"],
};

export const BRAND_SYSTEM_RULES = `Você avalia o ALINHAMENTO DE MARCA de um conteúdo contra o contexto estruturado da marca fornecido (Brand Profile).
Regras obrigatórias:
- Avalie o posicionamento contra o posicionamento PREFERENCIAL; o observado serve só de contexto. Diferença não é necessariamente erro estratégico.
- Ausência de algo no Brand Profile NÃO significa que é falso: use not_found_in_brand_profile / unknown_to_brand_profile, nunca "falso".
- conflicts_with_brand_profile e entity "conflict" exigem texto concreto do Brand Profile que contradiga explicitamente (preencha conflict_evidence / brand_ref).
- Referencie somente IDs presentes no contexto (entre colchetes). Nunca invente itens da marca.
- Não penalize o conteúdo por não mencionar todos os diferenciais, públicos ou produtos: avalie só o que é relevante ao tema.
- Conteúdo educacional pode estar alinhado implicitamente ao público.
- Voz: não julgue por palavras isoladas nem penalize pequenas variações naturais.
- Strengths só com trecho literal do conteúdo em content_evidence. Não invente elogios.
- Recomendações nunca pedem para adicionar informação falsa. Quando um número/claim não está no Brand Profile, recomende confirmar a evidência ou ajustar a afirmação.
- Versão otimizada: use apenas fatos presentes no conteúdo original ou no contexto de marca. NÃO invente números, clientes, cases, funcionalidades, certificações, diferenciais ou resultados.
- Você NÃO calcula score final; o backend calcula o Brand Alignment.`;

// ---------- Validation ----------
const num01 = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const num100 = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, v)) : null);
const s = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const inEnum = <T extends readonly string[]>(v: unknown, e: T): v is T[number] => typeof v === "string" && (e as readonly string[]).includes(v);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 } as const;

export function basisIndex(ctx: BrandContextSnapshot): Map<string, { basis: Basis; text: string }> {
  const m = new Map<string, { basis: Basis; text: string }>();
  ctx.offerings.forEach((o) => m.set(o.id, { basis: o.basis, text: o.name }));
  ctx.audiences.forEach((o) => m.set(o.id, { basis: o.basis, text: o.name }));
  ctx.problems.forEach((o) => m.set(o.id, { basis: o.basis, text: o.name }));
  ctx.differentiators.forEach((o) => m.set(o.id, { basis: o.basis, text: o.statement }));
  ctx.claims.forEach((o) => m.set(o.id, { basis: o.basis, text: o.statement }));
  ctx.evidence.forEach((o) => m.set(o.id, { basis: o.basis, text: `${o.title}${o.value ? `: ${o.value}` : ""}` }));
  ctx.entities.forEach((o) => m.set(o.id, { basis: o.basis, text: o.name }));
  if (ctx.voice) m.set(ctx.voice.id, { basis: ctx.voice.basis, text: "Brand Voice" });
  for (const f of [ctx.preferred_positioning, ctx.observed_positioning, ctx.primary_category, ctx.value_proposition]) if (f) m.set(f.ref, { basis: f.basis, text: f.value });
  return m;
}

/** Removes sentences that introduce numbers absent from both the original content and the brand context. */
export function guardOptimized(text: string | null, allowedSource: string): { text: string | null; removed: string[] } {
  if (!text) return { text: null, removed: [] };
  const clean = text.replace(/[*#_~`>]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const allowed = new Set((allowedSource.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", ".")));
  const removed: string[] = [];
  const out = clean.split(/(?<=[.!?])\s+/).filter((sent) => {
    const nums = (sent.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
    const bad = nums.some((n) => !allowed.has(n));
    if (bad) removed.push(sent);
    return !bad;
  }).join(" ").trim();
  return { text: out || null, removed };
}

export function validateBrandAssessment(raw: any, ctx: BrandContextSnapshot, originalContent: string): BrandAlignmentResult {
  const ids = contextIds(ctx);
  const idx = basisIndex(ctx);
  let discarded = 0;
  const refOf = (v: unknown): string | null => { const r = s(v, 80); if (!r) return null; if (ids.has(r)) return r; discarded++; return null; };
  const availability = availabilityFromContext(ctx);

  const dims = {} as Record<BADimension, BADimensionResult>;
  for (const k of BA_ORDER) {
    const d = raw?.dimensions?.[k] ?? {};
    const av = availability[k];
    const refs = arr(d.brand_refs).map(refOf).filter((x): x is string => !!x);
    const score = num100(d.score);
    const applicable = d.applicable !== false;
    const available = av.available && applicable && score !== null;
    let status = k === "positioning" && inEnum(d.status, POSITIONING_STATUS) ? d.status : undefined;
    // "conflicting" requires a concrete brand reference.
    if (status === "conflicting" && !refs.length) status = "weak";
    dims[k] = {
      available, score: available ? Math.round(score as number) : null, weight: BA_WEIGHTS[k],
      reason: !av.available ? av.reason : !applicable ? (s(d.reason) ?? "Não aplicável ao tema deste conteúdo. Esta dimensão não entrou no cálculo.") : (s(d.reason) ?? ""),
      evidence: arr(d.content_evidence).map((x) => s(x, 300)).filter((x): x is string => !!x).slice(0, 4),
      brand_refs: refs, confidence: num01(d.confidence), ...(status ? { status } : {}),
    };
  }

  const findings: BAFinding[] = [];
  for (const c of arr(raw?.claim_checks)) {
    const stmt = s(c.content_claim); if (!stmt || !inEnum(c.classification, CLAIM_CLASS)) continue;
    const br = refOf(c.brand_ref);
    let cls: typeof CLAIM_CLASS[number] = c.classification;
    const conflictEv = s(c.conflict_evidence);
    if (cls === "conflicts_with_brand_profile" && (!br || !conflictEv)) cls = "not_found_in_brand_profile"; // conflict requires concrete evidence
    if ((cls === "supported_by_brand_profile" || cls === "partially_supported") && !br) cls = "not_found_in_brand_profile";
    if (cls === "not_applicable") continue;
    const basis = br ? idx.get(br)!.basis : null;
    findings.push({
      type: "claim_check", classification: cls, dimension: "claim_evidence", statement: stmt,
      severity: cls === "conflicts_with_brand_profile" ? (basis === "human_defined" ? "high" : "medium") : cls === "not_found_in_brand_profile" ? "low" : "info",
      brand_reference: br, content_evidence: stmt, brand_evidence: cls === "conflicts_with_brand_profile" ? conflictEv : br ? idx.get(br)!.text : null,
      confidence: num01(c.confidence), recommendation: s(c.recommendation), basis,
    });
  }
  for (const f of arr(raw?.findings)) {
    const stmt = s(f.statement); if (!stmt || !inEnum(f.dimension, BA_ORDER)) continue;
    const br = refOf(f.brand_ref);
    const basis = br ? idx.get(br)!.basis : null;
    let sev = inEnum(f.severity, SEVERITIES) ? f.severity : "info";
    if (basis === "human_defined" && sev === "low") sev = "medium"; // human-defined knowledge weighs more in explanations
    findings.push({ type: s(f.type, 60) ?? "observation", severity: sev, dimension: f.dimension, statement: stmt, brand_reference: br, content_evidence: s(f.content_evidence, 300), brand_evidence: br ? idx.get(br)!.text : null, confidence: num01(f.confidence), recommendation: s(f.recommendation), basis });
  }
  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.basis === "human_defined" ? -1 : 0) - (b.basis === "human_defined" ? -1 : 0));

  const entities: BAEntityFinding[] = arr(raw?.entity_checks).flatMap((e) => {
    const m = s(e.mention, 120); if (!m || !inEnum(e.status, ENTITY_STATUS)) return [];
    const br = refOf(e.brand_ref);
    const status = e.status === "conflict" && !br ? "ambiguous" : e.status;
    return [{ mention: m, status, brand_reference: br, note: s(e.note, 300) ?? "" }];
  }).slice(0, 12);

  const strengths: BAStrength[] = arr(raw?.strengths).flatMap((x) => {
    const st = s(x.statement); const ev = s(x.content_evidence, 300);
    if (!st || !ev || !inEnum(x.dimension, BA_ORDER)) return []; // no literal evidence → not a strength
    return [{ statement: st, dimension: x.dimension, brand_reference: refOf(x.brand_ref), content_evidence: ev }];
  }).slice(0, 6);

  const gaps: BAGap[] = arr(raw?.gaps).flatMap((g) => {
    const st = s(g.statement); if (!st || !inEnum(g.gap_type, GAP_TYPES) || !inEnum(g.dimension, BA_ORDER)) return [];
    return [{ statement: st, gap_type: g.gap_type, dimension: g.dimension, brand_reference: refOf(g.brand_ref), recommendation: s(g.recommendation) }];
  }).slice(0, 8);

  const recs: BARecommendation[] = arr(raw?.recommendations).flatMap((r) => {
    const t = s(r.text); if (!t || !inEnum(r.dimension, BA_ORDER)) return [];
    return [{ text: t, dimension: r.dimension, brand_reference: refOf(r.brand_ref) }];
  }).slice(0, 8);

  const allowed = `${originalContent}\n${JSON.stringify({ ...ctx, selection: undefined, brand_brain_version: undefined }).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")}`;
  const opt = guardOptimized(s(raw?.optimized_version, 20000), allowed);
  const calc = computeBrandAlignment(dims);
  return {
    brand_alignment_version: BRAND_ALIGNMENT_VERSION,
    brand_alignment_score: calc.score,
    brand_alignment_partial: calc.partial,
    brand_alignment_weights_applied: calc.weights,
    brand_alignment_dimensions: dims,
    brand_alignment_findings: findings.slice(0, 20),
    brand_strengths: strengths, brand_gaps: gaps, brand_entity_consistency: entities, brand_recommendations: recs,
    brand_optimized_version: opt.text,
    discarded_references: discarded,
  };
}

/** Columns for public.analises (history snapshot). */
export function brandAnaliseColumns(r: Record<string, any>): Record<string, unknown> {
  if (!r?.brand_alignment_version || !r?.brand_context_snapshot) return {};
  return {
    brand_brain_id: r.brand_context_snapshot.brand_brain_id, brand_brain_version: r.brand_context_snapshot.brand_brain_version,
    brand_context_snapshot: r.brand_context_snapshot, brand_alignment_version: r.brand_alignment_version,
    brand_alignment_score: r.brand_alignment_score, brand_alignment_partial: r.brand_alignment_partial,
    brand_alignment_dimensions: r.brand_alignment_dimensions, brand_alignment_weights_applied: r.brand_alignment_weights_applied,
    brand_alignment_findings: r.brand_alignment_findings, brand_strengths: r.brand_strengths, brand_gaps: r.brand_gaps,
    brand_entity_consistency: r.brand_entity_consistency, brand_recommendations: r.brand_recommendations,
    brand_optimized_version: r.brand_optimized_version,
  };
}

/** Webhook subset — never the full Brand Brain. */
export function brandWebhookFields(r: Record<string, any>, empresaId: string | null): Record<string, unknown> {
  if (!r?.brand_alignment_version) return {};
  return {
    empresa_id: empresaId, brand_brain_version: r.brand_context_snapshot?.brand_brain_version ?? null,
    brand_alignment_score: r.brand_alignment_score, brand_alignment_partial: r.brand_alignment_partial, brand_alignment_version: r.brand_alignment_version,
  };
}
