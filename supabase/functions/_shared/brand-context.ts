// Brand Context (03C): compact, relevant, traceable slice of the ACTIVE Brand Brain used by a brand-aware analysis.
// Pure builder + a loader that re-verifies user → workspace → empresa → active Brand Brain on the server.
// The snapshot is persisted with the analysis so history never depends on the current Brand Brain.
import { activeItems, knowledgeStatus, normKey, precedenceRank, type RankedItem } from "./brand-precedence.ts";

export const BRAND_CONTEXT_VERSION = "1.0";
export type Basis = "human_defined" | "declared" | "observed" | "inferred";
export type ContextKind = "offering" | "audience" | "problem" | "differentiator" | "claim" | "evidence" | "entity" | "positioning" | "voice";
export type ExclusionReason = "rejected" | "superseded" | "low_relevance" | "kind_limit" | "budget";

type Row = RankedItem & Record<string, any>;
export interface BrandBrainData {
  brain: Record<string, any>;
  overrides: { field: string; status: string; value: unknown }[];
  offerings: Row[]; audiences: Row[]; problems: Row[]; differentiators: Row[]; claims: Row[]; evidence: Row[];
  entities: Row[]; positioning_items: Row[]; voice: Row[];
  claim_evidence: { claim_id: string; evidence_id: string; relationship_type: string }[];
  problem_offerings: { problem_id: string; offering_id: string; relationship_type: string }[];
}

export interface CtxOffering { id: string; name: string; type: string; description: string | null; basis: Basis }
export interface CtxAudience { id: string; name: string; description: string | null; basis: Basis }
export interface CtxProblem { id: string; name: string; description: string | null; offering_ids: string[]; basis: Basis }
export interface CtxDifferentiator { id: string; statement: string; category: string; basis: Basis }
export interface CtxClaim { id: string; statement: string; claim_type: string; verification_status: string; evidence_ids: string[]; basis: Basis }
export interface CtxEvidence { id: string; title: string; evidence_type: string; value: string | null; description: string | null; basis: Basis }
export interface CtxEntity { id: string; name: string; entity_type: string; relationship: string | null; basis: Basis }
export interface CtxVoice { id: string; tone_traits: string[]; formality: string | null; complexity_level: string | null; communication_style: string | null; vocabulary_preferred: string[]; vocabulary_avoided: string[]; basis: Basis; sufficient: boolean }
export interface CtxField { value: string; basis: Basis; ref: string }

export interface BrandContextSnapshot {
  brand_context_version: string;
  brand_brain_id: string; brand_brain_version: number; empresa_id: string;
  company_name: string | null;
  primary_category: CtxField | null;
  preferred_positioning: CtxField | null;
  observed_positioning: CtxField | null;
  value_proposition: CtxField | null;
  offerings: CtxOffering[]; audiences: CtxAudience[]; problems: CtxProblem[]; differentiators: CtxDifferentiator[];
  claims: CtxClaim[]; evidence: CtxEvidence[]; entities: CtxEntity[]; voice: CtxVoice | null;
  selection: {
    included: { kind: ContextKind; id: string; relevance: number }[];
    excluded: { kind: ContextKind; id: string; reason: ExclusionReason }[];
    truncated: boolean; budget_chars: number; used_chars: number;
  };
}

export const KIND_LIMITS: Record<Exclude<ContextKind, "positioning" | "voice">, number> = {
  offering: 5, audience: 4, problem: 5, differentiator: 5, claim: 6, evidence: 6, entity: 8,
};
export const CONTEXT_BUDGET_CHARS = 6000;

export function basisOf(i: RankedItem): Basis {
  const s = knowledgeStatus(i);
  if (s === "user_edit" || s === "human_confirmed") return "human_defined";
  if (s === "declared") return "declared";
  if (s === "inferred") return "inferred";
  return "observed";
}

const STOP = new Set(["para", "com", "uma", "que", "dos", "das", "por", "mais", "como", "sua", "seu", "nos", "the", "and", "for", "with", "you", "your", "are"]);
export const tokenSet = (s: string) => new Set(normKey(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
/** Deterministic relevance: share of the item's tokens found in the analysed intent/content. */
export function relevance(itemText: string, target: Set<string>): number {
  const t = tokenSet(itemText);
  if (!t.size) return 0;
  let hit = 0; t.forEach((w) => { if (target.has(w)) hit++; });
  return Math.round((hit / t.size) * 1000) / 1000;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function preferredField(d: BrandBrainData, field: string): CtxField | null {
  const o = d.overrides.find((x) => x.field === field);
  if (o?.status === "user_edit" && str(o.value)) return { value: str(o.value)!, basis: "human_defined", ref: `field:${field}` };
  const observed = str(d.brain[field]);
  if (!observed) return null;
  const prov = d.brain.field_provenance?.[field];
  const basis: Basis = o?.status === "confirmed" ? "human_defined" : prov?.source_type === "user_description" ? "declared" : prov?.explicit_or_inferred === "inferred" ? "inferred" : "observed";
  return { value: observed, basis, ref: `field:${field}` };
}

interface Candidate { kind: ContextKind; id: string; text: string; rank: number; rel: number; build: () => unknown; chars: number }

/**
 * Builds the snapshot. `intent` = search query; `content` = analysed text (only used for relevance, never stored).
 * Rejected / superseded items are recorded as excluded, never sent. Lower relevance or budget exclusions are explicit.
 */
export function buildBrandContext(d: BrandBrainData, intent: string, content: string, budget = CONTEXT_BUDGET_CHARS): BrandContextSnapshot {
  const target = tokenSet(`${intent} ${content.slice(0, 20000)}`);
  const excluded: BrandContextSnapshot["selection"]["excluded"] = [];
  const included: BrandContextSnapshot["selection"]["included"] = [];

  const active = <T extends Row>(kind: ContextKind, rows: T[]): T[] => {
    const act = activeItems(rows);
    const actIds = new Set(act.map((r) => r.id));
    for (const r of rows) if (!actIds.has(r.id)) excluded.push({ kind, id: r.id, reason: r.human_status === "rejected" ? "rejected" : "superseded" });
    return act;
  };

  // Positioning: human-defined field override > active declared positioning item > brain field > observed item.
  const pos = active("positioning", d.positioning_items);
  const declaredItem = pos.find((p) => p.kind === "declared" && str(p.statement));
  const observedItem = pos.find((p) => p.kind === "observed" && str(p.statement));
  const posField = preferredField(d, "positioning");
  let preferred: CtxField | null = null;
  if (posField?.basis === "human_defined") preferred = posField;
  else if (declaredItem) preferred = { value: declaredItem.statement, basis: basisOf(declaredItem), ref: declaredItem.id };
  else if (posField) preferred = posField;
  else if (observedItem) preferred = { value: observedItem.statement, basis: basisOf(observedItem), ref: observedItem.id };
  const observed = observedItem && (!preferred || preferred.ref !== observedItem.id) ? { value: observedItem.statement as string, basis: basisOf(observedItem), ref: observedItem.id as string } : null;
  for (const p of pos) included.push({ kind: "positioning", id: p.id, relevance: 1 });

  const offerings = active("offering", d.offerings);
  const audiences = active("audience", d.audiences);
  const problems = active("problem", d.problems);
  const diffs = active("differentiator", d.differentiators);
  const claims = active("claim", d.claims);
  const evidence = active("evidence", d.evidence);
  const entities = active("entity", d.entities);
  const voiceRows = active("voice", d.voice);

  const offeringIds = new Set(offerings.map((o) => o.id));
  const offeringsFor = (pid: string) => d.problem_offerings.filter((l) => l.problem_id === pid && offeringIds.has(l.offering_id)).map((l) => l.offering_id);
  const evidenceIds = new Set(evidence.map((e) => e.id));
  const evidenceFor = (cid: string) => d.claim_evidence.filter((l) => l.claim_id === cid && evidenceIds.has(l.evidence_id) && l.relationship_type !== "contradicts").map((l) => l.evidence_id);

  const mk = <T extends Row>(kind: Exclude<ContextKind, "positioning" | "voice">, rows: T[], text: (r: T) => string, build: (r: T) => unknown): Candidate[] =>
    rows.map((r) => { const t = text(r); const rel = relevance(t, target); return { kind, id: r.id, text: t, rank: precedenceRank(r), rel, build: () => build(r), chars: t.length + 60 }; });

  const groups: Candidate[][] = [
    mk("offering", offerings, (o) => `${o.name} ${o.description ?? ""} ${o.category ?? ""}`, (o) => ({ id: o.id, name: o.name, type: o.type, description: str(o.description), basis: basisOf(o) } satisfies CtxOffering)),
    mk("audience", audiences, (a) => `${a.name} ${a.description ?? ""}`, (a) => ({ id: a.id, name: a.name, description: str(a.description), basis: basisOf(a) } satisfies CtxAudience)),
    mk("problem", problems, (p) => `${p.name} ${p.description ?? ""}`, (p) => ({ id: p.id, name: p.name, description: str(p.description), offering_ids: offeringsFor(p.id), basis: basisOf(p) } satisfies CtxProblem)),
    mk("differentiator", diffs, (x) => x.statement, (x) => ({ id: x.id, statement: x.statement, category: x.category, basis: basisOf(x) } satisfies CtxDifferentiator)),
    mk("claim", claims, (c) => c.statement, (c) => ({ id: c.id, statement: c.statement, claim_type: c.claim_type, verification_status: c.verification_status, evidence_ids: evidenceFor(c.id), basis: basisOf(c) } satisfies CtxClaim)),
    mk("evidence", evidence, (e) => `${e.title} ${e.value ?? ""} ${e.description ?? ""}`, (e) => ({ id: e.id, title: e.title, evidence_type: e.evidence_type, value: str(e.value), description: str(e.description), basis: basisOf(e) } satisfies CtxEvidence)),
    mk("entity", entities, (e) => `${e.name} ${e.relationship ?? ""}`, (e) => ({ id: e.id, name: e.name, entity_type: e.entity_type, relationship: str(e.relationship), basis: basisOf(e) } satisfies CtxEntity)),
  ];

  // Per kind: relevant items first (then human precedence). Up to 2 top-precedence items are always kept as core context.
  const chosen: Candidate[] = [];
  for (const g of groups) {
    if (!g.length) continue;
    const kind = g[0].kind as keyof typeof KIND_LIMITS;
    const byPrec = [...g].sort((a, b) => a.rank - b.rank);
    const core = new Set(byPrec.slice(0, 2).map((c) => c.id));
    const sorted = [...g].sort((a, b) => b.rel - a.rel || a.rank - b.rank);
    let n = 0;
    for (const c of sorted) {
      if (c.rel === 0 && !core.has(c.id)) { excluded.push({ kind: c.kind, id: c.id, reason: "low_relevance" }); continue; }
      if (n >= KIND_LIMITS[kind]) { excluded.push({ kind: c.kind, id: c.id, reason: "kind_limit" }); continue; }
      chosen.push(c); n++;
    }
  }
  // Claims pull their linked evidence (if evidence was cut only by relevance) so claim↔evidence stays coherent.
  const chosenIds = new Set(chosen.map((c) => c.id));
  const allEvidence = groups[5];
  for (const c of chosen.filter((x) => x.kind === "claim")) {
    for (const eid of evidenceFor(c.id)) {
      if (chosenIds.has(eid)) continue;
      const ev = allEvidence.find((e) => e.id === eid);
      if (!ev) continue;
      const idx = excluded.findIndex((x) => x.id === eid && x.reason === "low_relevance");
      if (idx >= 0) excluded.splice(idx, 1);
      chosen.push(ev); chosenIds.add(eid);
    }
  }

  // Budget in priority order: positioning/category/VP (fixed) → offerings → audiences → problems → differentiators → claims → evidence → entities → voice.
  const order: ContextKind[] = ["offering", "audience", "problem", "differentiator", "claim", "evidence", "entity"];
  const fixed = [preferred?.value, observed?.value, str(d.brain.value_proposition), str(d.brain.primary_category), str(d.brain.company_name)].filter(Boolean).join(" ").length;
  let used = fixed;
  let truncated = false;
  const kept: Candidate[] = [];
  for (const k of order) {
    for (const c of chosen.filter((x) => x.kind === k).sort((a, b) => b.rel - a.rel || a.rank - b.rank)) {
      if (used + c.chars > budget) { excluded.push({ kind: c.kind, id: c.id, reason: "budget" }); truncated = true; continue; }
      used += c.chars; kept.push(c); included.push({ kind: c.kind, id: c.id, relevance: c.rel });
    }
  }
  const pick = <T>(k: ContextKind) => kept.filter((c) => c.kind === k).map((c) => c.build() as T);

  let voice: CtxVoice | null = null;
  const v = voiceRows[0];
  if (v) {
    const signals = (v.tone_traits?.length ?? 0) + (v.formality ? 1 : 0) + (v.complexity_level ? 1 : 0) + (v.communication_style ? 1 : 0);
    const vText = JSON.stringify([v.tone_traits, v.formality, v.complexity_level, v.communication_style, v.vocabulary_preferred, v.vocabulary_avoided]).length;
    if (used + vText > budget) { excluded.push({ kind: "voice", id: v.id, reason: "budget" }); truncated = true; }
    else {
      used += vText;
      voice = {
        id: v.id, tone_traits: v.tone_traits ?? [], formality: str(v.formality), complexity_level: str(v.complexity_level), communication_style: str(v.communication_style),
        vocabulary_preferred: (v.vocabulary_preferred ?? []).slice(0, 12), vocabulary_avoided: (v.vocabulary_avoided ?? []).slice(0, 12), basis: basisOf(v),
        sufficient: signals >= 2 && v.confidence >= 0.4,
      };
      included.push({ kind: "voice", id: v.id, relevance: 1 });
    }
  }

  const ownPrimaryCategory = preferredField(d, "primary_category");
  const companyField = preferredField(d, "company_name");
  return {
    brand_context_version: BRAND_CONTEXT_VERSION,
    brand_brain_id: d.brain.id, brand_brain_version: d.brain.version, empresa_id: d.brain.empresa_id,
    company_name: companyField?.value ?? null,
    primary_category: ownPrimaryCategory,
    preferred_positioning: preferred,
    observed_positioning: observed,
    value_proposition: preferredField(d, "value_proposition"),
    offerings: pick<CtxOffering>("offering"), audiences: pick<CtxAudience>("audience"), problems: pick<CtxProblem>("problem"),
    differentiators: pick<CtxDifferentiator>("differentiator"), claims: pick<CtxClaim>("claim"), evidence: pick<CtxEvidence>("evidence"),
    entities: pick<CtxEntity>("entity"), voice,
    selection: { included, excluded, truncated, budget_chars: budget, used_chars: used },
  };
}

/** All knowledge IDs the model is allowed to reference (anything else is discarded). */
export function contextIds(s: BrandContextSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const list of [s.offerings, s.audiences, s.problems, s.differentiators, s.claims, s.evidence, s.entities]) for (const i of list) ids.add(i.id);
  if (s.voice) ids.add(s.voice.id);
  for (const f of [s.preferred_positioning, s.observed_positioning, s.primary_category, s.value_proposition]) if (f) ids.add(f.ref);
  return ids;
}

/** Compact prompt block. Every line carries its ID so the model can only reference real knowledge. */
export function renderBrandContext(s: BrandContextSnapshot): string {
  const L: string[] = [];
  L.push(`Empresa: ${s.company_name ?? "(sem nome registrado)"} — Brand Brain v${s.brand_brain_version}`);
  const f = (label: string, x: CtxField | null) => { if (x) L.push(`${label} [${x.ref}] (${x.basis}): ${x.value}`); };
  f("Posicionamento PREFERENCIAL", s.preferred_positioning);
  f("Posicionamento observado (apenas contexto)", s.observed_positioning);
  f("Categoria principal", s.primary_category);
  f("Proposta de valor", s.value_proposition);
  const sec = <T>(title: string, list: T[], line: (x: T) => string) => { if (list.length) { L.push(`\n${title}:`); list.forEach((x) => L.push(`- ${line(x)}`)); } };
  sec("Produtos/serviços", s.offerings, (o) => `[${o.id}] ${o.name} (${o.type}, ${o.basis})${o.description ? ` — ${o.description}` : ""}`);
  sec("Públicos", s.audiences, (a) => `[${a.id}] ${a.name} (${a.basis})${a.description ? ` — ${a.description}` : ""}`);
  sec("Problemas", s.problems, (p) => `[${p.id}] ${p.name} (${p.basis})${p.offering_ids.length ? ` — resolvido por: ${p.offering_ids.join(", ")}` : ""}`);
  sec("Diferenciais", s.differentiators, (x) => `[${x.id}] ${x.statement} (${x.category}, ${x.basis})`);
  sec("Claims da marca", s.claims, (c) => `[${c.id}] ${c.statement} (${c.verification_status}, ${c.basis})${c.evidence_ids.length ? ` — evidências: ${c.evidence_ids.join(", ")}` : ""}`);
  sec("Evidências", s.evidence, (e) => `[${e.id}] ${e.title} (${e.evidence_type})${e.value ? `: ${e.value}` : ""}`);
  sec("Entidades", s.entities, (e) => `[${e.id}] ${e.name} (${e.entity_type}${e.relationship ? `, ${e.relationship}` : ""})`);
  if (s.voice) L.push(`\nVoz da marca [${s.voice.id}] (${s.voice.basis}${s.voice.sufficient ? "" : ", POUCA EVIDÊNCIA"}): tom ${s.voice.tone_traits.join(", ") || "-"}; formalidade ${s.voice.formality ?? "-"}; complexidade ${s.voice.complexity_level ?? "-"}; estilo ${s.voice.communication_style ?? "-"}; preferir: ${s.voice.vocabulary_preferred.join(", ") || "-"}; evitar: ${s.voice.vocabulary_avoided.join(", ") || "-"}`);
  if (s.selection.truncated) L.push(`\n(Parte do Brand Profile ficou fora deste contexto por limite de tamanho; não conclua que algo não existe na marca só por não estar listado.)`);
  return L.join("\n");
}

// ---------- Loader (server) ----------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type LoadResult =
  | { status: "forbidden" }
  | { status: "no_brand_brain"; empresa_id: string }
  | { status: "ok"; empresa_id: string; data: BrandBrainData };

/** user → workspace → empresa → ACTIVE Brand Brain. Browser-sent brain id/version are never trusted. */
// deno-lint-ignore no-explicit-any
export async function loadActiveBrandBrain(admin: any, userId: string, workspaceId: string, empresaId: unknown): Promise<LoadResult> {
  if (typeof empresaId !== "string" || !UUID_RE.test(empresaId)) return { status: "forbidden" };
  const { data: emp } = await admin.from("empresas").select("id, workspace_id, user_id, workspaces!inner(user_id)")
    .eq("id", empresaId).eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  if (!emp || emp.workspaces?.user_id !== userId) return { status: "forbidden" };
  const { data: brain } = await admin.from("brand_brains").select("*").eq("empresa_id", empresaId).eq("is_active", true)
    .eq("user_id", userId).eq("workspace_id", workspaceId).maybeSingle();
  if (!brain) return { status: "no_brand_brain", empresa_id: empresaId };
  const by = (t: string) => admin.from(t).select("*").eq("brand_brain_id", brain.id).then((r: any) => r.data ?? []);
  const [overrides, offerings, audiences, problems, differentiators, claims, evidence, entities, positioning_items, voice, claim_evidence, problem_offerings] = await Promise.all([
    by("brand_field_overrides"), by("brand_offerings"), by("brand_audiences"), by("brand_problems"), by("brand_differentiators"), by("brand_claims"),
    by("brand_evidence"), by("brand_entities"), by("brand_positioning"), by("brand_voice"), by("brand_claim_evidence"), by("brand_problem_offerings"),
  ]);
  return { status: "ok", empresa_id: empresaId, data: { brain, overrides, offerings, audiences, problems, differentiators, claims, evidence, entities, positioning_items, voice, claim_evidence, problem_offerings } };
}
