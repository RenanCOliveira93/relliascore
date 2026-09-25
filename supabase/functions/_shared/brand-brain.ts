// Brand Brain v1 — pure normalization of model output into structured, provenance-tagged knowledge.
// No I/O here (testable). Rules: never invent (items citing unavailable sources are dropped), confidence is
// an attribute of the extracted datum (0–1), conservative dedupe (exact normalized key only), declared vs observed kept apart.

export const BRAND_BRAIN_MODEL_VERSION = "brand_brain_v1";

export type BrandSourceType = "website" | "linkedin" | "instagram" | "user_description" | "user_edit" | "existing_brand_analysis";
export type BrandSourceStatusValue = "fetched" | "blocked" | "login_required" | "unavailable" | "invalid" | "not_provided";
export type ExplicitOrInferred = "explicit" | "inferred";

export interface BrandSourceStatus { source: "website" | "linkedin" | "instagram" | "user_description"; status: BrandSourceStatusValue; url?: string; reason?: string; content_truncated?: boolean }
export interface BrandSource { source_type: BrandSourceType; source_url: string | null; evidence: string | null; confidence: number; explicit_or_inferred: ExplicitOrInferred; observed_at: string }
export interface Provenanced extends BrandSource { sources: BrandSource[] }

export interface BrandOffering extends Provenanced { name: string; type: "product" | "service" | "platform" | "solution" | "other"; description: string | null; category: string | null; target_audience: string | null; problems_solved: string[]; value_proposition: string | null }
export interface BrandAudience extends Provenanced { name: string; description: string | null; audience_type: "company" | "professional" | "consumer" | "creator" | "institution" | "other"; needs: string[]; problems: string[]; industries: string[]; roles: string[] }
export interface BrandProblem extends Provenanced { name: string; description: string | null; affected_audience: string[]; related_offerings: string[] }
export interface BrandDifferentiator extends Provenanced { statement: string; category: "technology" | "methodology" | "expertise" | "performance" | "experience" | "integration" | "service" | "positioning" | "other" }
export interface BrandClaim extends Provenanced { statement: string; claim_type: "performance" | "market" | "customer" | "technology" | "capability" | "experience" | "certification" | "statistic" | "positioning" | "other"; verification_status: "evidenced" | "partially_evidenced" | "unevidenced" | "unknown"; evidence_refs: string[] }
export interface BrandEvidence extends Provenanced { evidence_type: "case_study" | "customer" | "testimonial" | "statistic" | "certification" | "award" | "research" | "partnership" | "publication" | "result" | "other"; title: string; description: string | null; value: string | null }
export interface BrandEntity extends Provenanced { name: string; entity_type: "organization" | "person" | "product" | "service" | "technology" | "location" | "market" | "concept" | "customer" | "partner" | "other"; relationship: string | null; description: string | null }
export interface BrandPositioning extends Provenanced { kind: "declared" | "observed"; statement: string | null; primary_category: string | null; alternative_categories: string[]; value_proposition: string | null; differentiators: string[]; target_market: string | null }
export interface BrandVoice extends Provenanced { tone_traits: string[]; communication_style: string | null; vocabulary_preferred: string[]; vocabulary_avoided: string[]; complexity_level: string | null; formality: string | null; emotional_style: string | null; recurring_phrases: string[] }
export interface ColorRef { hex: string; name: string | null }
export interface BrandVisualIdentity extends Provenanced { primary_colors: ColorRef[]; secondary_colors: ColorRef[]; accent_colors: ColorRef[]; detected_fonts: string[]; logo_url: string | null; visual_style: string | null; imagery_style: string | null; consistency_notes: string | null }

export interface FieldProvenance { source_type: BrandSourceType; evidence: string | null; confidence: number; explicit_or_inferred: ExplicitOrInferred }
export const PROFILE_FIELDS = ["company_name", "short_description", "long_description", "primary_category", "business_model", "value_proposition", "mission", "target_summary", "tone_summary", "visual_summary"] as const;
export type ProfileField = typeof PROFILE_FIELDS[number];

export interface BrandBrainCore {
  model_version: string;
  primary_domain: string | null;
  company_name: string | null; short_description: string | null; long_description: string | null; primary_category: string | null;
  business_model: string | null; value_proposition: string | null; mission: string | null; target_summary: string | null; tone_summary: string | null; visual_summary: string | null;
  positioning: string | null;
  secondary_categories: string[]; geographic_markets: string[]; languages: string[];
  positioning_conflicts: { declared: string | null; observed: string | null; aspect: string; note: string }[];
  field_provenance: Partial<Record<ProfileField, FieldProvenance>>;
  sources_status: BrandSourceStatus[];
  suggested_pages: string[];
  extraction_confidence: number | null;
}

export interface BrandBrainChildren {
  brand_offerings: BrandOffering[]; brand_audiences: BrandAudience[]; brand_problems: BrandProblem[];
  brand_differentiators: BrandDifferentiator[]; brand_claims: BrandClaim[]; brand_evidence: BrandEvidence[];
  brand_entities: BrandEntity[]; brand_positioning: BrandPositioning[]; brand_voice: BrandVoice[]; brand_visual_identity: BrandVisualIdentity[];
}
export interface BrandBrainPayload { brain: BrandBrainCore; children: BrandBrainChildren; dropped: number }

export interface NormalizeContext {
  sources: BrandSourceStatus[];
  primaryDomain: string | null;
  observedAt?: string;
}

// ---------- primitives ----------
type Raw = Record<string, unknown>;
const MAX_ITEMS = 25;
const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 600): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strList = (v: unknown, max = 15, len = 200): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, len)).filter((x): x is string => !!x))].slice(0, max) : [];
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
export const validConfidence = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? +v.toFixed(2) : null);

export const normKey = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const OBSERVED_SOURCES: BrandSourceType[] = ["website", "linkedin", "instagram"];

/** Sources the model may cite: fetched URLs + the user's own description. Anything else = invention → dropped. */
export function allowedSources(sources: BrandSourceStatus[]): Map<BrandSourceType, string | null> {
  const m = new Map<BrandSourceType, string | null>();
  for (const s of sources) {
    if (s.status !== "fetched") continue;
    m.set(s.source, s.source === "user_description" ? null : s.url ?? null);
  }
  return m;
}

/** Validates the provenance block of a single item. Returns null when the item must be dropped. */
export function provenance(raw: Raw, allowed: Map<BrandSourceType, string | null>, observedAt: string): Provenanced | null {
  const source_type = raw.source_type as BrandSourceType;
  if (!allowed.has(source_type)) return null; // cites a source we never read → no invention
  let confidence = validConfidence(raw.confidence);
  if (confidence === null) return null;
  const evidence = str(raw.evidence, 300);
  let eoi = oneOf<ExplicitOrInferred>(raw.explicit_or_inferred, ["explicit", "inferred"], "inferred");
  if (eoi === "explicit" && !evidence) { eoi = "inferred"; confidence = Math.min(confidence, 0.5); }
  if (!evidence) confidence = Math.min(confidence, 0.6);
  const src: BrandSource = { source_type, source_url: allowed.get(source_type) ?? null, evidence, confidence, explicit_or_inferred: eoi, observed_at: observedAt };
  return { ...src, sources: [src] };
}

/** Conservative dedupe: merges only identical normalized keys; keeps every corroborating source. */
export function dedupe<T extends Provenanced>(items: T[], keyOf: (i: T) => string): T[] {
  const out = new Map<string, T>();
  for (const it of items) {
    const k = keyOf(it);
    const prev = out.get(k);
    if (!prev) { out.set(k, it); continue; }
    const best = it.confidence > prev.confidence ? it : prev;
    const sources = [...prev.sources];
    for (const s of it.sources) if (!sources.some((x) => x.source_type === s.source_type && x.evidence === s.evidence)) sources.push(s);
    const corroborated = new Set(sources.map((s) => s.source_type)).size > 1;
    out.set(k, {
      ...best,
      explicit_or_inferred: prev.explicit_or_inferred === "explicit" || it.explicit_or_inferred === "explicit" ? "explicit" : "inferred",
      // Independent confirmation raises extraction confidence slightly, never above 0.95.
      confidence: corroborated ? Math.min(0.95, +(Math.max(prev.confidence, it.confidence) + 0.05).toFixed(2)) : best.confidence,
      sources,
    });
  }
  return [...out.values()].slice(0, MAX_ITEMS);
}

function list<T extends Provenanced>(v: unknown, allowed: Map<BrandSourceType, string | null>, at: string, build: (r: Raw) => Omit<T, keyof Provenanced> | null, key: (i: T) => string, counter: { n: number }): T[] {
  const arr = Array.isArray(v) ? v : [];
  const items: T[] = [];
  for (const r of arr) {
    if (!isObj(r)) { counter.n++; continue; }
    const body = build(r);
    const p = body ? provenance(r, allowed, at) : null;
    if (!body || !p) { counter.n++; continue; }
    items.push({ ...body, ...p } as T);
  }
  return dedupe(items, key);
}

const HEX = /^#[0-9a-f]{6}$/i;
const colors = (v: unknown): ColorRef[] =>
  (Array.isArray(v) ? v : []).filter(isObj).map((c) => ({ hex: String(c.hex ?? "").trim(), name: str(c.name, 60) }))
    .filter((c) => HEX.test(c.hex)).slice(0, 8);

// ---------- main ----------
export function normalizeBrandBrain(raw: unknown, ctx: NormalizeContext): BrandBrainPayload {
  const at = ctx.observedAt ?? new Date().toISOString();
  const allowed = allowedSources(ctx.sources);
  const r = isObj(raw) ? raw : {};
  const dropped = { n: 0 };
  const byName = (i: { name: string }) => normKey(i.name);

  const brand_offerings = list<BrandOffering>(r.offerings, allowed, at, (x) => {
    const name = str(x.name, 160); if (!name) return null;
    return { name, type: oneOf(x.type, ["product", "service", "platform", "solution", "other"] as const, "other"), description: str(x.description), category: str(x.category, 160), target_audience: str(x.target_audience, 300), problems_solved: strList(x.problems_solved), value_proposition: str(x.value_proposition) };
  }, (i) => `${i.type}:${normKey(i.name)}`, dropped);

  const brand_audiences = list<BrandAudience>(r.audiences, allowed, at, (x) => {
    const name = str(x.name, 160); if (!name) return null;
    return { name, description: str(x.description), audience_type: oneOf(x.audience_type, ["company", "professional", "consumer", "creator", "institution", "other"] as const, "other"), needs: strList(x.needs), problems: strList(x.problems), industries: strList(x.industries), roles: strList(x.roles) };
  }, byName, dropped);

  const brand_problems = list<BrandProblem>(r.problems, allowed, at, (x) => {
    const name = str(x.name, 160); if (!name) return null;
    return { name, description: str(x.description), affected_audience: strList(x.affected_audience), related_offerings: strList(x.related_offerings) };
  }, byName, dropped);

  // A plain characteristic ("usamos IA") is not a differentiator unless the brand communicates it as one.
  const brand_differentiators = list<BrandDifferentiator>(r.differentiators, allowed, at, (x) => {
    const statement = str(x.statement, 300); if (!statement || x.communicated_as_differentiator !== true) return null;
    return { statement, category: oneOf(x.category, ["technology", "methodology", "expertise", "performance", "experience", "integration", "service", "positioning", "other"] as const, "other") };
  }, (i) => normKey(i.statement), dropped);

  const brand_evidence = list<BrandEvidence>(r.evidence, allowed, at, (x) => {
    const title = str(x.title, 200); if (!title) return null;
    return { evidence_type: oneOf(x.evidence_type, ["case_study", "customer", "testimonial", "statistic", "certification", "award", "research", "partnership", "publication", "result", "other"] as const, "other"), title, description: str(x.description), value: str(x.value, 120) };
  }, (i) => `${i.evidence_type}:${normKey(i.title)}`, dropped);

  const evidenceTitles = new Set(brand_evidence.map((e) => normKey(e.title)));
  const brand_claims = list<BrandClaim>(r.claims, allowed, at, (x) => {
    const statement = str(x.statement, 400); if (!statement) return null;
    // Only link to evidence items that actually exist in this extraction.
    const evidence_refs = strList(x.evidence_refs, 5).filter((t) => evidenceTitles.has(normKey(t)));
    let verification_status = oneOf(x.verification_status, ["evidenced", "partially_evidenced", "unevidenced", "unknown"] as const, "unknown");
    if (verification_status === "evidenced" && evidence_refs.length === 0 && !str(x.evidence)) verification_status = "unknown";
    return { statement, claim_type: oneOf(x.claim_type, ["performance", "market", "customer", "technology", "capability", "experience", "certification", "statistic", "positioning", "other"] as const, "other"), verification_status, evidence_refs };
  }, (i) => normKey(i.statement), dropped);

  const brand_entities = list<BrandEntity>(r.entities, allowed, at, (x) => {
    const name = str(x.name, 160); if (!name) return null;
    return { name, entity_type: oneOf(x.entity_type, ["organization", "person", "product", "service", "technology", "location", "market", "concept", "customer", "partner", "other"] as const, "other"), relationship: str(x.relationship, 120), description: str(x.description, 300) };
  }, (i) => `${i.entity_type}:${normKey(i.name)}`, dropped);

  // Declared = what the user states; observed = what public sources show. Kind is derived from the source, not trusted.
  const positioningRaw = Array.isArray(r.positioning) ? r.positioning : [];
  const brand_positioning = list<BrandPositioning>(positioningRaw, allowed, at, (x) => {
    const statement = str(x.statement, 400), primary_category = str(x.primary_category, 160);
    if (!statement && !primary_category) return null;
    const kind: "declared" | "observed" = x.source_type === "user_description" ? "declared" : "observed";
    return { kind, statement, primary_category, alternative_categories: strList(x.alternative_categories), value_proposition: str(x.value_proposition), differentiators: strList(x.differentiators), target_market: str(x.target_market, 300) };
  }, (i) => `${i.kind}:${i.source_type}:${normKey(i.statement ?? i.primary_category ?? "")}`, dropped);

  const voiceRaw = isObj(r.voice) ? r.voice : null;
  const brand_voice: BrandVoice[] = [];
  if (voiceRaw) {
    const p = provenance(voiceRaw, allowed, at);
    const tone_traits = strList(voiceRaw.tone_traits, 10, 60);
    if (p && (tone_traits.length || str(voiceRaw.communication_style))) {
      // Few or no quoted phrases → rules would be over-generalized; cap confidence.
      const phrases = strList(voiceRaw.recurring_phrases, 10, 160);
      const c = phrases.length < 2 ? Math.min(p.confidence, 0.5) : p.confidence;
      brand_voice.push({ ...p, confidence: c, sources: p.sources.map((s) => ({ ...s, confidence: c })), tone_traits, communication_style: str(voiceRaw.communication_style, 300), vocabulary_preferred: strList(voiceRaw.vocabulary_preferred, 15, 60), vocabulary_avoided: strList(voiceRaw.vocabulary_avoided, 15, 60), complexity_level: str(voiceRaw.complexity_level, 60), formality: str(voiceRaw.formality, 60), emotional_style: str(voiceRaw.emotional_style, 120), recurring_phrases: phrases });
    } else dropped.n++;
  }

  const visRaw = isObj(r.visual_identity) ? r.visual_identity : null;
  const brand_visual_identity: BrandVisualIdentity[] = [];
  if (visRaw) {
    const p = provenance(visRaw, allowed, at);
    const logo = str(visRaw.logo_url, 500);
    const safeLogo = logo && /^https:\/\//i.test(logo) && ctx.primaryDomain && hostOf(logo)?.endsWith(ctx.primaryDomain) ? logo : null;
    const item = p ? { ...p, primary_colors: colors(visRaw.primary_colors), secondary_colors: colors(visRaw.secondary_colors), accent_colors: colors(visRaw.accent_colors), detected_fonts: strList(visRaw.detected_fonts, 6, 60), logo_url: safeLogo, visual_style: str(visRaw.visual_style, 300), imagery_style: str(visRaw.imagery_style, 300), consistency_notes: str(visRaw.consistency_notes, 400) } : null;
    if (item && (item.primary_colors.length || item.visual_style || item.detected_fonts.length)) brand_visual_identity.push(item);
    else dropped.n++;
  }

  // Profile fields: each accepted only with valid provenance.
  const prof = isObj(r.profile) ? r.profile : {};
  const core: Partial<Record<ProfileField, string | null>> = {};
  const field_provenance: Partial<Record<ProfileField, FieldProvenance>> = {};
  for (const f of PROFILE_FIELDS) {
    const fr = prof[f];
    core[f] = null;
    if (!isObj(fr)) continue;
    const value = str(fr.value, f === "long_description" ? 2000 : 600);
    const p = value ? provenance(fr, allowed, at) : null;
    if (!value || !p) { if (fr.value !== null && fr.value !== undefined) dropped.n++; continue; }
    core[f] = value;
    field_provenance[f] = { source_type: p.source_type, evidence: p.evidence, confidence: p.confidence, explicit_or_inferred: p.explicit_or_inferred };
  }

  const declared = brand_positioning.find((p) => p.kind === "declared") ?? null;
  const observed = brand_positioning.find((p) => p.kind === "observed") ?? null;

  const brain: BrandBrainCore = {
    model_version: BRAND_BRAIN_MODEL_VERSION,
    primary_domain: ctx.primaryDomain,
    ...(core as Record<ProfileField, string | null>),
    positioning: observed?.statement ?? declared?.statement ?? null,
    secondary_categories: strList(r.secondary_categories, 8, 120),
    geographic_markets: strList(r.geographic_markets, 10, 80),
    languages: strList(r.languages, 6, 40),
    positioning_conflicts: positioningDifferences(declared, observed),
    field_provenance,
    sources_status: ctx.sources,
    suggested_pages: strList(r.suggested_pages, 10, 300).filter((u) => ctx.primaryDomain && hostOf(u)?.endsWith(ctx.primaryDomain)),
    extraction_confidence: null,
  };
  const children: BrandBrainChildren = { brand_offerings, brand_audiences, brand_problems, brand_differentiators, brand_claims, brand_evidence, brand_entities, brand_positioning, brand_voice, brand_visual_identity };
  brain.extraction_confidence = extractionConfidence(children, field_provenance, ctx.sources);
  return { brain, children, dropped: dropped.n };
}

function hostOf(u: string): string | null { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }

/** Differences are recorded for later analysis — never labelled as errors. */
export function positioningDifferences(declared: BrandPositioning | null, observed: BrandPositioning | null): BrandBrainCore["positioning_conflicts"] {
  if (!declared || !observed) return [];
  const out: BrandBrainCore["positioning_conflicts"] = [];
  if (declared.primary_category && observed.primary_category && normKey(declared.primary_category) !== normKey(observed.primary_category)) {
    out.push({ aspect: "primary_category", declared: declared.primary_category, observed: observed.primary_category, note: "Diferença entre categoria declarada e observada, a analisar." });
  }
  if (declared.statement && observed.statement && normKey(declared.statement) !== normKey(observed.statement)) {
    out.push({ aspect: "statement", declared: declared.statement, observed: observed.statement, note: "Posicionamento declarado difere do observado nas fontes públicas." });
  }
  return out;
}

/** Technical, internal aggregate of extraction quality. NOT a brand score. */
export function extractionConfidence(children: BrandBrainChildren, fp: Partial<Record<ProfileField, FieldProvenance>>, sources: BrandSourceStatus[]): number | null {
  const confs: number[] = [...Object.values(fp).map((p) => p!.confidence)];
  for (const arr of Object.values(children)) for (const i of arr as Provenanced[]) confs.push(i.confidence);
  if (!confs.length) return null;
  const mean = confs.reduce((a, b) => a + b, 0) / confs.length;
  const provided = sources.filter((s) => s.status !== "not_provided");
  const observedFetched = provided.filter((s) => s.status === "fetched" && OBSERVED_SOURCES.includes(s.source)).length;
  const observedProvided = provided.filter((s) => OBSERVED_SOURCES.includes(s.source)).length;
  const coverage = observedProvided ? 0.6 + 0.4 * (observedFetched / observedProvided) : 0.6; // description only → capped
  return +Math.min(1, Math.max(0, mean * coverage)).toFixed(2);
}

// ---------- source status ----------
export function sourceStatusFromFetch(
  source: "website" | "linkedin" | "instagram",
  url: unknown,
  f: { ok: true; finalUrl: string; wordCount: number } | { ok: false; status: string; reason: string } | null,
): BrandSourceStatus {
  if (typeof url !== "string" || !url.trim()) return { source, status: "not_provided" };
  if (!f) return { source, status: "invalid", url, reason: "URL inválida." };
  if (f.ok) {
    if (/\/(login|signin|authwall|accounts\/login)/i.test(f.finalUrl) || f.wordCount < 15) {
      return { source, status: "login_required", url: f.finalUrl, reason: "Conteúdo insuficiente (pode exigir login ou JavaScript)." };
    }
    return { source, status: "fetched", url: f.finalUrl };
  }
  if (f.status === "invalid_url") {
    return { source, status: /privad|interna|não permitid/i.test(f.reason) ? "blocked" : "invalid", url, reason: f.reason };
  }
  if (/HTTP (401|403|999)/.test(f.reason)) return { source, status: "login_required", url, reason: f.reason };
  return { source, status: "unavailable", url, reason: f.reason };
}

// ---------- model schema (tool parameters) ----------
const PROV = {
  source_type: { type: "string", enum: ["website", "linkedin", "instagram", "user_description"] },
  evidence: { type: "string", description: "Trecho curto literal ou fato observado. Vazio se não houver." },
  confidence: { type: "number", description: "Confiança da EXTRAÇÃO deste dado, 0 a 1." },
  explicit_or_inferred: { type: "string", enum: ["explicit", "inferred"] },
};
const PROV_REQ = ["source_type", "confidence", "explicit_or_inferred"];
const item = (props: Record<string, unknown>, req: string[]) => ({ type: "object", properties: { ...props, ...PROV }, required: [...req, ...PROV_REQ] });
const sArr = { type: "array", items: { type: "string" } };
const field = { type: "object", properties: { value: { type: ["string", "null"] }, ...PROV }, required: ["value", ...PROV_REQ] };
const colorArr = { type: "array", items: { type: "object", properties: { hex: { type: "string" }, name: { type: "string" } }, required: ["hex"] } };

export const BRAND_BRAIN_SCHEMA = {
  type: "object",
  description: "Conhecimento estruturado da marca. Somente fatos das fontes fornecidas; lacunas ficam null/[]. Nunca preencha criativamente.",
  properties: {
    profile: { type: "object", properties: Object.fromEntries(PROFILE_FIELDS.map((f) => [f, field])) },
    secondary_categories: sArr, geographic_markets: sArr, languages: sArr, suggested_pages: sArr,
    offerings: { type: "array", items: item({ name: { type: "string" }, type: { type: "string", enum: ["product", "service", "platform", "solution", "other"] }, description: { type: "string" }, category: { type: "string" }, target_audience: { type: "string" }, problems_solved: sArr, value_proposition: { type: "string" } }, ["name", "type"]) },
    audiences: { type: "array", items: item({ name: { type: "string" }, description: { type: "string" }, audience_type: { type: "string", enum: ["company", "professional", "consumer", "creator", "institution", "other"] }, needs: sArr, problems: sArr, industries: sArr, roles: sArr }, ["name", "audience_type"]) },
    problems: { type: "array", items: item({ name: { type: "string" }, description: { type: "string" }, affected_audience: sArr, related_offerings: sArr }, ["name"]) },
    differentiators: { type: "array", items: item({ statement: { type: "string" }, category: { type: "string", enum: ["technology", "methodology", "expertise", "performance", "experience", "integration", "service", "positioning", "other"] }, communicated_as_differentiator: { type: "boolean", description: "true somente se a marca apresenta isso como diferencial; características comuns (ex.: 'usamos IA') = false." } }, ["statement", "category", "communicated_as_differentiator"]) },
    claims: { type: "array", items: item({ statement: { type: "string" }, claim_type: { type: "string", enum: ["performance", "market", "customer", "technology", "capability", "experience", "certification", "statistic", "positioning", "other"] }, verification_status: { type: "string", enum: ["evidenced", "partially_evidenced", "unevidenced", "unknown"] }, evidence_refs: { ...sArr, description: "Títulos exatos de itens em evidence que sustentam o claim." } }, ["statement", "claim_type", "verification_status"]) },
    evidence: { type: "array", items: item({ evidence_type: { type: "string", enum: ["case_study", "customer", "testimonial", "statistic", "certification", "award", "research", "partnership", "publication", "result", "other"] }, title: { type: "string" }, description: { type: "string" }, value: { type: "string" } }, ["evidence_type", "title"]) },
    entities: { type: "array", items: item({ name: { type: "string" }, entity_type: { type: "string", enum: ["organization", "person", "product", "service", "technology", "location", "market", "concept", "customer", "partner", "other"] }, relationship: { type: "string" }, description: { type: "string" } }, ["name", "entity_type"]) },
    positioning: { type: "array", description: "Um item por fonte: user_description = declarado; website/linkedin/instagram = observado. Não unifique divergências.", items: item({ statement: { type: "string" }, primary_category: { type: "string" }, alternative_categories: sArr, value_proposition: { type: "string" }, differentiators: sArr, target_market: { type: "string" } }, []) },
    voice: item({ tone_traits: sArr, communication_style: { type: "string" }, vocabulary_preferred: sArr, vocabulary_avoided: sArr, complexity_level: { type: "string" }, formality: { type: "string" }, emotional_style: { type: "string" }, recurring_phrases: sArr }, ["tone_traits"]),
    visual_identity: item({ primary_colors: colorArr, secondary_colors: colorArr, accent_colors: colorArr, detected_fonts: sArr, logo_url: { type: "string" }, visual_style: { type: "string" }, imagery_style: { type: "string" }, consistency_notes: { type: "string" } }, []),
  },
  required: ["profile", "offerings", "audiences", "problems", "differentiators", "claims", "evidence", "entities", "positioning"],
};

/** True when the payload holds enough structured knowledge to become a version. */
export const hasKnowledge = (p: BrandBrainPayload) =>
  Object.values(p.brain.field_provenance).length > 0 || Object.values(p.children).some((a) => (a as unknown[]).length > 0);
