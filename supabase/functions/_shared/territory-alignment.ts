// Territory Alignment 1.0 (04B) — third, independent axis. Never averaged with Content Score or Brand Alignment.
// The model returns structured per-dimension assessments; the backend validates references against the territory
// snapshot, requires literal content evidence for presence claims, and computes the score with fixed weights
// (redistributed only across available dimensions). It does NOT measure presence in AI answers.
import { guardOptimized } from "./brand-alignment.ts";
import { territoryContextIds, territoryRefText, type TerritorySnapshot } from "./territory-context.ts";

export const TERRITORY_ALIGNMENT_VERSION = "1.0";
export type TADimension = "core_relevance" | "strategic_intent" | "topic_coverage" | "brand_territory_connection" | "evidence_support" | "semantic_focus";
export const TA_WEIGHTS: Record<TADimension, number> = {
  core_relevance: 0.30, strategic_intent: 0.20, topic_coverage: 0.15, brand_territory_connection: 0.15, evidence_support: 0.10, semantic_focus: 0.10,
};
export const TA_ORDER = Object.keys(TA_WEIGHTS) as TADimension[];
export const TA_FINDING_TYPES = ["strong_alignment", "weak_connection", "missing_opportunity", "semantic_drift", "excluded_concept_conflict", "unsupported_claim", "territory_conflict", "info"] as const;
export const TA_GAP_TYPES = ["missing_topic_opportunity", "weak_brand_connection", "missing_evidence", "semantic_drift", "positioning_gap", "unclear_association", "outdated_relation", "other"] as const;
export const TA_CLAIM_CLASS = ["supported_by_territory_evidence", "partially_supported", "not_found_in_territory", "conflicts_with_territory_evidence", "not_applicable"] as const;
export const TA_SEVERITIES = ["high", "medium", "low", "info"] as const;
type Sev = typeof TA_SEVERITIES[number];

export interface TADimensionResult { available: boolean; score: number | null; weight: number; reason: string; evidence: string[]; territory_reference: string[]; confidence: number }
export interface TATopicCoverage { topics_present: string[]; relevant_topics_missing: string[]; topics_not_applicable: string[] }
export interface TAFinding { type: typeof TA_FINDING_TYPES[number]; severity: Sev; dimension: TADimension; statement: string; content_evidence: string | null; territory_reference: string | null; territory_evidence: string | null; confidence: number; recommendation: string | null; classification?: string }
export interface TAStrength { statement: string; dimension: TADimension; territory_reference: string | null; content_evidence: string }
export interface TAGap { statement: string; gap_type: typeof TA_GAP_TYPES[number]; dimension: TADimension; territory_reference: string | null; recommendation: string | null }
export interface TANextAction { text: string; dimension: TADimension; territory_reference: string | null; priority: "high" | "medium" | "low" }

export interface TerritoryAlignmentResult {
  territory_alignment_version: string;
  territory_alignment_score: number | null;
  territory_alignment_partial: boolean;
  territory_alignment_weights_applied: Partial<Record<TADimension, number>>;
  territory_alignment_dimensions: Record<TADimension, TADimensionResult>;
  territory_topic_coverage: TATopicCoverage;
  territory_findings: TAFinding[];
  territory_strengths: TAStrength[];
  territory_gaps: TAGap[];
  territory_next_actions: TANextAction[];
  territory_optimized_version: string | null;
  discarded_references: number;
}

// ---------- availability (absence in the territory definition is never a zero) ----------
export function territoryAvailability(s: TerritorySnapshot): Record<TADimension, { available: boolean; reason: string }> {
  const ok = (v: boolean, missing: string) => ({ available: v, reason: v ? "" : missing });
  const evid = s.relations.some((r) => r.kind === "claim" || r.kind === "evidence");
  return {
    core_relevance: ok(true, ""),
    strategic_intent: ok(!!(s.strategic_intent || s.desired_association), "O território ainda não tem intenção estratégica nem associação desejada. Esta dimensão não entrou no cálculo."),
    topic_coverage: ok(s.included_topics.length + s.related_concepts.length > 0, "O território ainda não tem tópicos incluídos nem conceitos relacionados. Esta dimensão não entrou no cálculo."),
    brand_territory_connection: ok(true, ""),
    evidence_support: ok(evid, "Nenhum claim ou evidência está ligado a este território. Esta dimensão não entrou no cálculo (não vale zero)."),
    semantic_focus: ok(true, ""),
  };
}

/** Fixed weights, redistributed over available dimensions. null score when none is available. */
export function computeTerritoryAlignment(dims: Record<TADimension, { available: boolean; score: number | null }>) {
  const avail = TA_ORDER.filter((k) => dims[k].available && typeof dims[k].score === "number");
  const total = avail.reduce((a, k) => a + TA_WEIGHTS[k], 0);
  const weights: Partial<Record<TADimension, number>> = {};
  if (!avail.length || total <= 0) return { score: null, partial: true, weights };
  let sum = 0;
  for (const k of avail) { weights[k] = Math.round((TA_WEIGHTS[k] / total) * 10000) / 10000; sum += (dims[k].score as number) * (TA_WEIGHTS[k] / total); }
  return { score: Math.round(Math.max(0, Math.min(100, sum))), partial: avail.length < TA_ORDER.length, weights };
}

// ---------- model schema & rules ----------
const DIM = {
  type: "object",
  properties: {
    applicable: { type: "boolean", description: "false quando o conteúdo não permite avaliar esta dimensão (ex.: nenhuma afirmação que exija evidência)" },
    score: { type: "number", description: "0–100" }, reason: { type: "string" },
    content_evidence: { type: "array", items: { type: "string" }, description: "Trechos LITERAIS do conteúdo" },
    territory_refs: { type: "array", items: { type: "string" }, description: "IDs exatos do contexto do território" },
    confidence: { type: "number" },
  },
  required: ["applicable", "score", "reason", "content_evidence", "territory_refs", "confidence"],
};
const ref = { type: "string", description: "ID exato do contexto do território ou vazio" };
const dimEnum = { type: "string", enum: TA_ORDER };
export const TERRITORY_TOOL_SCHEMA = {
  type: "object",
  properties: {
    dimensions: { type: "object", properties: Object.fromEntries(TA_ORDER.map((k) => [k, DIM])), required: TA_ORDER },
    topic_coverage: { type: "object", properties: {
      topics_present: { type: "array", items: { type: "string" } }, relevant_topics_missing: { type: "array", items: { type: "string" } }, topics_not_applicable: { type: "array", items: { type: "string" } },
    }, required: ["topics_present", "relevant_topics_missing", "topics_not_applicable"] },
    claim_checks: { type: "array", items: { type: "object", properties: {
      content_claim: { type: "string" }, classification: { type: "string", enum: TA_CLAIM_CLASS }, territory_ref: ref,
      conflict_evidence: { type: "string", description: "Texto da evidência ligada que contradiz explicitamente. Obrigatório para conflito." },
      recommendation: { type: "string" }, confidence: { type: "number" } }, required: ["content_claim", "classification", "confidence"] } },
    findings: { type: "array", items: { type: "object", properties: {
      type: { type: "string", enum: TA_FINDING_TYPES }, severity: { type: "string", enum: TA_SEVERITIES }, dimension: dimEnum, statement: { type: "string" },
      content_evidence: { type: "string" }, territory_ref: ref, recommendation: { type: "string" }, confidence: { type: "number" } },
      required: ["type", "severity", "dimension", "statement", "confidence"] } },
    strengths: { type: "array", items: { type: "object", properties: { statement: { type: "string" }, dimension: dimEnum, territory_ref: ref, content_evidence: { type: "string" } }, required: ["statement", "dimension", "content_evidence"] } },
    gaps: { type: "array", items: { type: "object", properties: { statement: { type: "string" }, gap_type: { type: "string", enum: TA_GAP_TYPES }, dimension: dimEnum, territory_ref: ref, recommendation: { type: "string" } }, required: ["statement", "gap_type", "dimension"] } },
    next_actions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, dimension: dimEnum, territory_ref: ref, priority: { type: "string", enum: ["high", "medium", "low"] } }, required: ["text", "dimension", "priority"] } },
    optimized_version: { type: "string", description: "Versão otimizada considerando conteúdo, marca e território; texto puro sem markdown; sem fatos novos" },
  },
  required: ["dimensions", "topic_coverage", "claim_checks", "findings", "strengths", "gaps", "next_actions", "optimized_version"],
};

export const TERRITORY_SYSTEM_RULES = `Você avalia quanto um conteúdo CONTRIBUI para um TERRITÓRIO ESTRATÉGICO da marca (um tema/problema pelo qual a marca quer ser reconhecida).
Isto NÃO mede presença em respostas de IA, ranking nem chance de citação.
Dimensões:
- core_relevance: o conteúdo trata de fato do conceito central? Use significado e contexto, NUNCA contagem de palavras (mencionar "varejo" dez vezes falando de decoração não é relevância).
- strategic_intent: o conteúdo reforça a intenção estratégica e a associação desejada? Ser sobre o tema não basta.
- topic_coverage: avalie só os subtópicos relevantes a ESTE conteúdo e intenção. Não exija cobertura de todos e não trate como densidade de keyword. Separe topics_present, relevant_topics_missing e topics_not_applicable (IDs).
- brand_territory_connection: o conteúdo associa de forma compreensível a MARCA ao território? Um ótimo artigo sobre o tema que quase não liga a marca tem conexão baixa.
- evidence_support: só quando o conteúdo faz afirmações que pedem evidência; senão applicable=false. Compare afirmações quantitativas com as evidências ligadas. Não encontrado ≠ falso. Conflito exige texto concreto da evidência ligada (conflict_evidence + territory_ref).
- semantic_focus: foco e coerência. Tópicos excluídos NÃO são palavras proibidas: mencionar para contextualizar é normal; penalize apenas quando o conteúdo reposiciona o território nesses conceitos.
Regras:
- Referencie apenas IDs entre colchetes do contexto. Nunca invente itens, claims ou evidências.
- Toda afirmação de presença no conteúdo precisa de trecho LITERAL em content_evidence. Strengths sem trecho literal não valem.
- Itens marcados como de versão anterior do Brand Profile têm menor confiança; não os trate como errados.
- next_actions: 3 a 5 ações específicas para aumentar a contribuição ao território, sem pedir para inventar fatos.
- Versão otimizada: texto natural e correto, usando voz/posicionamento da marca, intenção estratégica, associação desejada e subtópicos relevantes. Não force palavras para subir score. Use só fatos do conteúdo original, do contexto da marca ou do território. NÃO invente números, clientes, cases ou resultados.
- Você NÃO calcula o score final; o backend calcula.`;

// ---------- validation ----------
const num01 = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5);
const num100 = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, v)) : null);
const str = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const inEnum = <T extends readonly string[]>(v: unknown, e: T): v is T[number] => typeof v === "string" && (e as readonly string[]).includes(v);
// deno-lint-ignore no-explicit-any
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const SEV_ORDER: Record<Sev, number> = { high: 0, medium: 1, low: 2, info: 3 };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[“”"'‘’…]/g, "").replace(/\s+/g, " ").trim();

/** A quote counts as literal when (normalized) it appears in the content; long quotes may match on their first 80 chars. */
export function isLiteral(quote: string, contentNorm: string): boolean {
  const q = norm(quote.replace(/^\.{3}|\.{3}$/g, ""));
  if (q.length < 4) return false;
  return contentNorm.includes(q) || (q.length > 80 && contentNorm.includes(q.slice(0, 80)));
}

// deno-lint-ignore no-explicit-any
export function validateTerritoryAssessment(raw: any, ctx: TerritorySnapshot, content: string, extraAllowedSource = ""): TerritoryAlignmentResult {
  const ids = territoryContextIds(ctx);
  const text = territoryRefText(ctx);
  const outdated = new Set(ctx.relations.filter((r) => r.source_version_outdated).map((r) => r.id));
  const excludedIds = new Set(ctx.excluded_topics.map((t) => t.id));
  const topicIds = new Set([...ctx.included_topics, ...ctx.related_concepts].map((t) => t.id));
  const cNorm = norm(content);
  let discarded = 0;
  const refOf = (v: unknown): string | null => { const r = str(v, 80); if (!r) return null; if (ids.has(r)) return r; discarded++; return null; };
  const literal = (v: unknown, max = 300): string | null => { const q = str(v, max); return q && isLiteral(q, cNorm) ? q : null; };
  const avail = territoryAvailability(ctx);

  const dims = {} as Record<TADimension, TADimensionResult>;
  for (const k of TA_ORDER) {
    const d = raw?.dimensions?.[k] ?? {};
    const av = avail[k];
    const refs = arr(d.territory_refs).map(refOf).filter((x): x is string => !!x);
    const score = num100(d.score);
    const applicable = d.applicable !== false;
    const available = av.available && applicable && score !== null;
    let conf = num01(d.confidence);
    if (refs.length && refs.every((r) => outdated.has(r))) conf = Math.round(conf * 0.8 * 100) / 100; // outdated source → lower confidence
    dims[k] = {
      available, score: available ? Math.round(score as number) : null, weight: TA_WEIGHTS[k],
      reason: !av.available ? av.reason : !applicable ? (str(d.reason) ?? "Não aplicável a este conteúdo. Esta dimensão não entrou no cálculo.") : (str(d.reason) ?? ""),
      evidence: arr(d.content_evidence).map((x) => literal(x)).filter((x): x is string => !!x).slice(0, 4),
      territory_reference: refs, confidence: conf,
    };
  }

  const tc = raw?.topic_coverage ?? {};
  const topicList = (v: unknown) => [...new Set(arr(v).map(refOf).filter((x): x is string => !!x && topicIds.has(x)))];
  const present = topicList(tc.topics_present);
  const missing = topicList(tc.relevant_topics_missing).filter((x) => !present.includes(x));
  const na = topicList(tc.topics_not_applicable).filter((x) => !present.includes(x) && !missing.includes(x));

  const findings: TAFinding[] = [];
  for (const c of arr(raw?.claim_checks)) {
    const stmt = str(c.content_claim); if (!stmt || !inEnum(c.classification, TA_CLAIM_CLASS)) continue;
    const tr = refOf(c.territory_ref);
    let cls: typeof TA_CLAIM_CLASS[number] = c.classification;
    const conflictEv = str(c.conflict_evidence);
    if (cls === "conflicts_with_territory_evidence" && (!tr || !conflictEv)) cls = "not_found_in_territory"; // conflict requires concrete evidence
    if ((cls === "supported_by_territory_evidence" || cls === "partially_supported") && !tr) cls = "not_found_in_territory";
    if (cls === "not_applicable") continue;
    findings.push({
      type: cls === "conflicts_with_territory_evidence" ? "territory_conflict" : cls === "not_found_in_territory" ? "unsupported_claim" : "strong_alignment",
      classification: cls, severity: cls === "conflicts_with_territory_evidence" ? "high" : cls === "not_found_in_territory" ? "low" : "info",
      dimension: "evidence_support", statement: stmt, content_evidence: literal(stmt), territory_reference: tr,
      territory_evidence: cls === "conflicts_with_territory_evidence" ? conflictEv : tr ? text.get(tr) ?? null : null,
      confidence: num01(c.confidence), recommendation: str(c.recommendation),
    });
  }
  for (const f of arr(raw?.findings)) {
    const stmt = str(f.statement); if (!stmt || !inEnum(f.dimension, TA_ORDER)) continue;
    let type = inEnum(f.type, TA_FINDING_TYPES) ? f.type : "info";
    const tr = refOf(f.territory_ref);
    const ev = literal(f.content_evidence);
    // Excluded-concept conflict needs the excluded topic reference AND literal content; otherwise it is only context.
    if (type === "excluded_concept_conflict" && (!tr || !excludedIds.has(tr) || !ev)) type = "info";
    if (type === "territory_conflict" && (!tr || !ev)) type = "info";
    if (type === "strong_alignment" && !ev) continue;
    const sev: Sev = type === "info" ? "info" : inEnum(f.severity, TA_SEVERITIES) ? f.severity : "info";
    findings.push({ type, severity: sev, dimension: f.dimension, statement: stmt, content_evidence: ev, territory_reference: tr, territory_evidence: tr ? text.get(tr) ?? null : null, confidence: num01(f.confidence), recommendation: str(f.recommendation) });
  }
  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);

  const strengths: TAStrength[] = arr(raw?.strengths).flatMap((x) => {
    const st = str(x.statement); const ev = literal(x.content_evidence);
    if (!st || !ev || !inEnum(x.dimension, TA_ORDER)) return []; // no literal evidence → not a strength
    return [{ statement: st, dimension: x.dimension, territory_reference: refOf(x.territory_ref), content_evidence: ev }];
  }).slice(0, 6);

  const gaps: TAGap[] = arr(raw?.gaps).flatMap((g) => {
    const st = str(g.statement); if (!st || !inEnum(g.gap_type, TA_GAP_TYPES) || !inEnum(g.dimension, TA_ORDER)) return [];
    return [{ statement: st, gap_type: g.gap_type, dimension: g.dimension, territory_reference: refOf(g.territory_ref), recommendation: str(g.recommendation) }];
  }).slice(0, 8);
  if (outdated.size && !gaps.some((g) => g.gap_type === "outdated_relation")) {
    gaps.push({ statement: `${outdated.size} conexão(ões) deste território foram definidas numa versão anterior do Brand Profile.`, gap_type: "outdated_relation", dimension: "evidence_support", territory_reference: null, recommendation: "Revise as conexões do território." });
  }

  const actions: TANextAction[] = arr(raw?.next_actions).flatMap((r) => {
    const t = str(r.text); if (!t || !inEnum(r.dimension, TA_ORDER)) return [];
    return [{ text: t, dimension: r.dimension, territory_reference: refOf(r.territory_ref), priority: inEnum(r.priority, ["high", "medium", "low"] as const) ? r.priority : "medium" }];
  }).slice(0, 5);

  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const allowed = `${content}\n${extraAllowedSource}\n${JSON.stringify({ ...ctx, selection: undefined, readiness: undefined, relations: ctx.relations.map((r) => ({ l: r.label, d: r.detail })), last_reviewed_brand_brain_version: undefined, active_brand_brain_version: undefined })}`.replace(uuid, "");
  const opt = guardOptimized(str(raw?.optimized_version, 20000), allowed);
  const calc = computeTerritoryAlignment(dims);
  return {
    territory_alignment_version: TERRITORY_ALIGNMENT_VERSION,
    territory_alignment_score: calc.score, territory_alignment_partial: calc.partial, territory_alignment_weights_applied: calc.weights,
    territory_alignment_dimensions: dims,
    territory_topic_coverage: { topics_present: present, relevant_topics_missing: missing, topics_not_applicable: na },
    territory_findings: findings.slice(0, 20), territory_strengths: strengths, territory_gaps: gaps, territory_next_actions: actions,
    territory_optimized_version: opt.text, discarded_references: discarded,
  };
}

/** Columns for public.analises (history snapshot). Topic coverage is kept inside the dimensions JSON. */
// deno-lint-ignore no-explicit-any
export function territoryAnaliseColumns(r: Record<string, any>): Record<string, unknown> {
  if (!r?.territory_alignment_version || !r?.territory_snapshot) return {};
  return {
    territory_id: r.territory_snapshot.territory_id, territory_snapshot: r.territory_snapshot,
    territory_alignment_version: r.territory_alignment_version, territory_alignment_score: r.territory_alignment_score,
    territory_alignment_partial: r.territory_alignment_partial,
    territory_alignment_dimensions: { ...r.territory_alignment_dimensions, _topic_coverage: r.territory_topic_coverage ?? null },
    territory_alignment_weights_applied: r.territory_alignment_weights_applied, territory_findings: r.territory_findings,
    territory_strengths: r.territory_strengths, territory_gaps: r.territory_gaps, territory_next_actions: r.territory_next_actions,
    territory_optimized_version: r.territory_optimized_version,
  };
}

/** Webhook subset — never the full snapshot. */
// deno-lint-ignore no-explicit-any
export function territoryWebhookFields(r: Record<string, any>): Record<string, unknown> {
  if (!r?.territory_alignment_version || !r?.territory_snapshot) return {};
  return {
    territory_id: r.territory_snapshot.territory_id, territory_name: r.territory_snapshot.territory_name,
    territory_alignment_score: r.territory_alignment_score, territory_alignment_partial: r.territory_alignment_partial,
    territory_alignment_version: r.territory_alignment_version,
  };
}
