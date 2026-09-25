import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildBrandContext, contextIds, renderBrandContext, type BrandBrainData } from "./brand-context.ts";
import {
  BA_WEIGHTS, availabilityFromContext, brandAnaliseColumns, brandWebhookFields, computeBrandAlignment, guardOptimized, validateBrandAssessment,
} from "./brand-alignment.ts";
import { buildAnaliseRow } from "./persist.ts";
import { buildV2Scores } from "./score-v2.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = (n: number, extra: Record<string, unknown> = {}) => ({
  id: id(n), origin: "extraction", human_status: "none", source_type: "website", explicit_or_inferred: "explicit", confidence: 0.8,
  sources: [{ source_type: "website" }], supersedes_id: null, ...extra,
}) as any;

function brain(over: Partial<BrandBrainData> = {}): BrandBrainData {
  return {
    brain: { id: id(900), version: 3, empresa_id: id(800), company_name: "Nexus Sight", primary_category: "Visão computacional", positioning: "Visão computacional para lojas", value_proposition: "Reduz perdas no varejo", field_provenance: {} },
    overrides: [{ field: "positioning", status: "user_edit", value: "Plataforma de inteligência de varejo" }],
    offerings: [base(1, { name: "Nexus Loss", type: "product", description: "Prevenção de perdas com câmeras" }), base(2, { name: "Nexus Queue", type: "product", description: "Gestão de filas" })],
    audiences: [base(10, { name: "Redes varejistas", description: "Supermercados" })],
    problems: [base(20, { name: "Perdas no varejo", description: "Furtos e quebras" })],
    differentiators: [base(30, { statement: "Modelos treinados em lojas brasileiras", category: "technology" }), base(31, { statement: "Diferencial rejeitado", category: "other", human_status: "rejected" })],
    claims: [base(40, { statement: "Reduz perdas em 30%", claim_type: "statistic", verification_status: "evidenced" })],
    evidence: [base(50, { title: "Case Rede X", evidence_type: "case_study", value: "30% menos perdas" })],
    entities: [base(60, { name: "Nexus Sight", entity_type: "organization" })],
    positioning_items: [base(70, { kind: "observed", statement: "Visão computacional" })],
    voice: [base(80, { tone_traits: ["técnico", "direto"], formality: "média", complexity_level: "média", communication_style: "consultivo", vocabulary_preferred: [], vocabulary_avoided: [] })],
    claim_evidence: [{ claim_id: id(40), evidence_id: id(50), relationship_type: "supports" }],
    problem_offerings: [{ problem_id: id(20), offering_id: id(1), relationship_type: "solves" }],
    ...over,
  };
}
const INTENT = "como reduzir perdas no varejo";
const CONTENT = "A Nexus Sight ajuda redes varejistas a reduzir perdas com câmeras. Reduz perdas em 30% segundo o case Rede X.";

Deno.test("brand context: human edit positioning is preferred, observed kept as context", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  assertEquals(c.preferred_positioning?.value, "Plataforma de inteligência de varejo");
  assertEquals(c.preferred_positioning?.basis, "human_defined");
  assertEquals(c.observed_positioning?.value, "Visão computacional");
  assertEquals(c.brand_brain_version, 3);
});

Deno.test("brand context: rejected items excluded and recorded", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  assert(!c.differentiators.some((d) => d.id === id(31)));
  assert(c.selection.excluded.some((x) => x.id === id(31) && x.reason === "rejected"));
});

Deno.test("brand context: user_edit supersedes the extracted row", () => {
  const b = brain({ offerings: [base(1, { name: "Nexus Loss", type: "product" }), base(3, { name: "Nexus Loss Pro", type: "product", origin: "user_edit", supersedes_id: id(1) })] });
  const c = buildBrandContext(b, INTENT, CONTENT);
  assert(c.offerings.some((o) => o.id === id(3) && o.basis === "human_defined"));
  assert(!c.offerings.some((o) => o.id === id(1)));
  assert(c.selection.excluded.some((x) => x.id === id(1) && x.reason === "superseded"));
});

Deno.test("brand context: problem ↔ offering by ID", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  assertEquals(c.problems[0].offering_ids, [id(1)]);
  assertEquals(c.claims[0].evidence_ids, [id(50)]);
});

Deno.test("brand context: relevance selection and explicit exclusions", () => {
  const many = Array.from({ length: 12 }, (_, i) => base(100 + i, { name: `Produto irrelevante ${i} logística portuária`, type: "product" }));
  const c = buildBrandContext(brain({ offerings: [base(1, { name: "Nexus Loss", type: "product", description: "Prevenção de perdas no varejo" }), ...many] }), INTENT, CONTENT);
  assert(c.offerings.some((o) => o.id === id(1)));
  assert(c.offerings.length <= 5);
  assert(c.selection.excluded.some((x) => x.kind === "offering" && (x.reason === "low_relevance" || x.reason === "kind_limit")));
});

Deno.test("brand context: budget is enforced and flagged (no silent truncation)", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT, 200);
  assert(c.selection.truncated);
  assert(c.selection.excluded.some((x) => x.reason === "budget"));
  assert(renderBrandContext(c).includes("limite de tamanho"));
});

Deno.test("brand context: every rendered item carries an existing ID", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const ids = contextIds(c);
  for (const m of renderBrandContext(c).matchAll(/\[([^\]]+)\]/g)) assert(ids.has(m[1]), m[1]);
});

Deno.test("formula: exact weights, sum 1", () => {
  assertEquals(Object.values(BA_WEIGHTS).reduce((a, b) => a + b, 0).toFixed(6), "1.000000");
  const all = { positioning: { available: true, score: 80 }, offering: { available: true, score: 60 }, audience_problem: { available: true, score: 70 }, differentiation: { available: true, score: 50 }, claim_evidence: { available: true, score: 90 }, voice: { available: true, score: 40 } };
  const r = computeBrandAlignment(all);
  assertEquals(r.score, Math.round(80 * .25 + 60 * .2 + 70 * .2 + 50 * .15 + 90 * .1 + 40 * .1));
  assertEquals(r.partial, false);
});

Deno.test("formula: unavailable dimension redistributes weight (never zero)", () => {
  const dims = { positioning: { available: true, score: 80 }, offering: { available: true, score: 80 }, audience_problem: { available: true, score: 80 }, differentiation: { available: true, score: 80 }, claim_evidence: { available: true, score: 80 }, voice: { available: false, score: null } };
  const r = computeBrandAlignment(dims);
  assertEquals(r.score, 80);
  assertEquals(r.partial, true);
  assertEquals(r.weights.voice, undefined);
  assertEquals(r.weights.positioning, Math.round((0.25 / 0.9) * 10000) / 10000);
});

Deno.test("availability: missing voice is unavailable with explanation", () => {
  const c = buildBrandContext(brain({ voice: [] }), INTENT, CONTENT);
  const a = availabilityFromContext(c);
  assertEquals(a.voice.available, false);
  assert(a.voice.reason.includes("Brand Voice ainda não está definida"));
});

const goodRaw = (over: Record<string, unknown> = {}) => ({
  dimensions: Object.fromEntries(["positioning", "offering", "audience_problem", "differentiation", "claim_evidence", "voice"].map((k) => [k, { applicable: true, score: 70, reason: "ok", content_evidence: ["trecho"], brand_refs: [id(1)], confidence: 0.8, status: "partially_aligned" }])),
  claim_checks: [], findings: [], entity_checks: [], strengths: [], gaps: [], recommendations: [], optimized_version: "Texto.", ...over,
});

Deno.test("validation: invented brand IDs are discarded", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({ recommendations: [{ text: "x", dimension: "offering", brand_ref: "fake-id" }] }), c, CONTENT);
  assertEquals(r.brand_recommendations[0].brand_reference, null);
  assert(r.discarded_references >= 1);
});

Deno.test("claims: conflict without concrete brand evidence becomes not_found (not false)", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({ claim_checks: [{ content_claim: "Opera em 15 países", classification: "conflicts_with_brand_profile", confidence: 0.7 }] }), c, CONTENT);
  assertEquals(r.brand_alignment_findings[0].classification, "not_found_in_brand_profile");
  assertEquals(r.brand_alignment_findings[0].severity, "low");
});

Deno.test("claims: conflict with evidence is kept; supported requires a real ref", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({ claim_checks: [
    { content_claim: "Reduz perdas em 80%", classification: "conflicts_with_brand_profile", brand_ref: id(40), conflict_evidence: "Reduz perdas em 30%", confidence: 0.9 },
    { content_claim: "Líder global", classification: "supported_by_brand_profile", confidence: 0.9 },
  ] }), c, CONTENT);
  const conflict = r.brand_alignment_findings.find((f) => f.statement.includes("80%"))!;
  assertEquals(conflict.classification, "conflicts_with_brand_profile");
  assertEquals(r.brand_alignment_findings.find((f) => f.statement === "Líder global")!.classification, "not_found_in_brand_profile");
});

Deno.test("positioning: 'conflicting' without reference downgrades to weak", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const raw = goodRaw(); (raw.dimensions as any).positioning = { applicable: true, score: 20, status: "conflicting", reason: "x", content_evidence: [], brand_refs: [], confidence: 0.6 };
  assertEquals(validateBrandAssessment(raw, c, CONTENT).brand_alignment_dimensions.positioning.status, "weak");
});

Deno.test("entity consistency: conflict needs a reference", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({ entity_checks: [{ mention: "Nexsus", status: "conflict", note: "nome" }, { mention: "Nexus Sight", status: "consistent", brand_ref: id(60), note: "" }] }), c, CONTENT);
  assertEquals(r.brand_entity_consistency[0].status, "ambiguous");
  assertEquals(r.brand_entity_consistency[1].status, "consistent");
});

Deno.test("strengths require literal content evidence; gaps keep type", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({
    strengths: [{ statement: "Elogio vazio", dimension: "voice", content_evidence: "" }, { statement: "Conecta problema ao offering", dimension: "offering", content_evidence: "reduzir perdas com câmeras", brand_ref: id(1) }],
    gaps: [{ statement: "Claim nova", gap_type: "unknown_to_brand_profile", dimension: "claim_evidence" }, { statement: "x", gap_type: "invalid", dimension: "voice" }],
  }), c, CONTENT);
  assertEquals(r.brand_strengths.length, 1);
  assertEquals(r.brand_gaps.length, 1);
  assertEquals(r.brand_gaps[0].gap_type, "unknown_to_brand_profile");
});

Deno.test("human-defined references raise explanatory importance", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const r = validateBrandAssessment(goodRaw({ findings: [{ type: "positioning_gap", severity: "low", dimension: "positioning", statement: "Posicionamento preferencial pouco presente", brand_ref: "field:positioning", confidence: 0.7 }] }), c, CONTENT);
  assertEquals(r.brand_alignment_findings[0].severity, "medium");
  assertEquals(r.brand_alignment_findings[0].basis, "human_defined");
});

Deno.test("optimized version: sentences with invented numbers are removed", () => {
  const g = guardOptimized("A Nexus reduz perdas em 30%. Atende 500 clientes em 15 países. Fale conosco.", CONTENT);
  assertEquals(g.text, "A Nexus reduz perdas em 30%. Fale conosco.");
  assertEquals(g.removed.length, 1);
});

Deno.test("dimension not applicable to the topic is excluded, not zeroed", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const raw = goodRaw(); (raw.dimensions as any).claim_evidence = { applicable: false, score: 0, reason: "Sem afirmações", content_evidence: [], brand_refs: [], confidence: 0.5 };
  const r = validateBrandAssessment(raw, c, CONTENT);
  assertEquals(r.brand_alignment_dimensions.claim_evidence.available, false);
  assertEquals(r.brand_alignment_score, 70);
  assertEquals(r.brand_alignment_partial, true);
});

Deno.test("persist: brand columns only for brand-aware results; snapshot stored", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const ba = validateBrandAssessment(goodRaw(), c, CONTENT);
  const res = { status: "success", score: 70, ...ba, brand_context_snapshot: c };
  const row = buildAnaliseRow(res, { userId: "u", workspaceId: "w", empresaId: id(800), origem: "app", inputType: "text", mode: "business", searchQuery: INTENT, websiteUrl: null })!;
  assertEquals(row.brand_brain_version, 3);
  assertEquals((row.brand_context_snapshot as any).preferred_positioning.value, "Plataforma de inteligência de varejo");
  assertEquals(brandAnaliseColumns({ status: "success", score: 1 }), {});
});

Deno.test("webhook: brand subset only, never the Brand Brain", () => {
  const c = buildBrandContext(brain(), INTENT, CONTENT);
  const ba = validateBrandAssessment(goodRaw(), c, CONTENT);
  const w = brandWebhookFields({ ...ba, brand_context_snapshot: c }, id(800));
  assertEquals(Object.keys(w).sort(), ["brand_alignment_partial", "brand_alignment_score", "brand_alignment_version", "brand_brain_version", "empresa_id"]);
  assertEquals(brandWebhookFields({ score: 1 }, null), {});
});

Deno.test("Content Score 2.0 does not depend on brand modules (no brand input in buildV2Scores)", () => {
  assertEquals(buildV2Scores.length <= 3, true);
});
