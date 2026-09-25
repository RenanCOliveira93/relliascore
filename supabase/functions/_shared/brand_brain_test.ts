import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dedupe, extractionConfidence, hasKnowledge, normalizeBrandBrain, sourceStatusFromFetch, type BrandSourceStatus } from "./brand-brain.ts";
import { hostMatches } from "./brand-brain-store.ts";

const AT = "2026-09-25T00:00:00.000Z";
const SITE: BrandSourceStatus = { source: "website", status: "fetched", url: "https://nexussight.com/" };
const DESC: BrandSourceStatus = { source: "user_description", status: "fetched" };
const LI_DOWN: BrandSourceStatus = { source: "linkedin", status: "login_required", url: "https://linkedin.com/company/x" };
const IG_DOWN: BrandSourceStatus = { source: "instagram", status: "unavailable", url: "https://instagram.com/x" };
const ctx = (sources: BrandSourceStatus[]) => ({ sources, primaryDomain: "nexussight.com", observedAt: AT });
const prov = (source_type: string, extra: Record<string, unknown> = {}) => ({ source_type, evidence: "trecho", confidence: 0.8, explicit_or_inferred: "explicit", ...extra });

Deno.test("brand brain: website-only extraction builds structured core + provenance", () => {
  const p = normalizeBrandBrain({ profile: { company_name: { value: "Nexus Sight", ...prov("website") } }, offerings: [{ name: "Sight Platform", type: "platform", ...prov("website") }] }, ctx([SITE]));
  assertEquals(p.brain.company_name, "Nexus Sight");
  assertEquals(p.brain.field_provenance.company_name?.source_type, "website");
  assertEquals(p.children.brand_offerings[0].source_url, "https://nexussight.com/");
  assertEquals(p.children.brand_offerings[0].observed_at, AT);
  assert(hasKnowledge(p));
});

Deno.test("brand brain: user description is a valid source (declared)", () => {
  const p = normalizeBrandBrain({ positioning: [{ statement: "Empresa de inteligência de varejo", ...prov("user_description") }] }, ctx([DESC]));
  assertEquals(p.children.brand_positioning[0].kind, "declared");
  assertEquals(p.children.brand_positioning[0].source_url, null);
});

Deno.test("brand brain: unavailable LinkedIn/Instagram cannot be cited (no invention)", () => {
  const p = normalizeBrandBrain({
    offerings: [{ name: "X", type: "product", ...prov("linkedin") }],
    entities: [{ name: "Retail", entity_type: "market", ...prov("instagram") }],
  }, ctx([SITE, LI_DOWN, IG_DOWN]));
  assertEquals(p.children.brand_offerings.length, 0);
  assertEquals(p.children.brand_entities.length, 0);
  assertEquals(p.dropped, 2);
  assert(!hasKnowledge(p));
});

Deno.test("brand brain: absent source → not_provided; statuses mapped", () => {
  assertEquals(sourceStatusFromFetch("linkedin", "", null).status, "not_provided");
  assertEquals(sourceStatusFromFetch("website", "https://a.com", { ok: true, finalUrl: "https://a.com/", wordCount: 300 }).status, "fetched");
  assertEquals(sourceStatusFromFetch("linkedin", "https://linkedin.com/x", { ok: true, finalUrl: "https://linkedin.com/authwall?x", wordCount: 300 }).status, "login_required");
  assertEquals(sourceStatusFromFetch("instagram", "https://i.com", { ok: true, finalUrl: "https://i.com/", wordCount: 3 }).status, "login_required");
  assertEquals(sourceStatusFromFetch("website", "http://10.0.0.1", { ok: false, status: "invalid_url", reason: "Este endereço não pode ser analisado (rede privada ou interna)." }).status, "blocked");
  assertEquals(sourceStatusFromFetch("website", "xx", { ok: false, status: "invalid_url", reason: "URL inválida." }).status, "invalid");
  assertEquals(sourceStatusFromFetch("linkedin", "https://l.com", { ok: false, status: "crawl_failed", reason: "A página respondeu com erro HTTP 999." }).status, "login_required");
  assertEquals(sourceStatusFromFetch("website", "https://a.com", { ok: false, status: "timeout", reason: "lento" }).status, "unavailable");
});

Deno.test("brand brain: declared vs observed kept apart and difference recorded (not an error)", () => {
  const p = normalizeBrandBrain({ positioning: [
    { statement: "Empresa de inteligência de varejo", primary_category: "Inteligência de varejo", ...prov("user_description") },
    { statement: "Plataforma de visão computacional para varejo", primary_category: "Visão computacional", ...prov("website"), explicit_or_inferred: "explicit" },
    // model tries to label a website item as declared → kind derived from source
    { kind: "declared", statement: "Outro", ...prov("website") },
  ] }, ctx([SITE, DESC]));
  const kinds = p.children.brand_positioning.map((x) => x.kind).sort();
  assertEquals(kinds, ["declared", "observed", "observed"]);
  assertEquals(p.brain.positioning_conflicts.map((c) => c.aspect), ["primary_category", "statement"]);
  assert(!/erro/i.test(p.brain.positioning_conflicts[0].note));
});

Deno.test("brand brain: offering, audience, problem enums and arrays", () => {
  const p = normalizeBrandBrain({
    offerings: [{ name: "Loss Prevention", type: "weird", problems_solved: ["Perdas", "", 3], ...prov("website") }],
    audiences: [{ name: "Varejistas", audience_type: "company", industries: ["Varejo"], ...prov("website") }],
    problems: [{ name: "Perdas no varejo", description: "Redução de perdas com análise visual", related_offerings: ["Loss Prevention"], ...prov("website") }],
  }, ctx([SITE]));
  assertEquals(p.children.brand_offerings[0].type, "other");
  assertEquals(p.children.brand_offerings[0].problems_solved, ["Perdas"]);
  assertEquals(p.children.brand_audiences[0].audience_type, "company");
  assertEquals(p.children.brand_problems[0].related_offerings, ["Loss Prevention"]);
});

Deno.test("brand brain: characteristic is not a differentiator unless communicated as one", () => {
  const p = normalizeBrandBrain({ differentiators: [
    { statement: "Utilizamos IA", category: "technology", communicated_as_differentiator: false, ...prov("website") },
    { statement: "Único com detecção em tempo real em 40 redes", category: "performance", communicated_as_differentiator: true, ...prov("website") },
  ] }, ctx([SITE]));
  assertEquals(p.children.brand_differentiators.map((d) => d.statement), ["Único com detecção em tempo real em 40 redes"]);
});

Deno.test("brand brain: claims link only to existing evidence; evidenced without support → unknown", () => {
  const p = normalizeBrandBrain({
    evidence: [{ evidence_type: "statistic", title: "Redução de 30% nas perdas", value: "30%", ...prov("website") }],
    claims: [
      { statement: "Reduz perdas em 30%", claim_type: "statistic", verification_status: "evidenced", evidence_refs: ["Redução de 30% nas perdas", "Inexistente"], ...prov("website") },
      { statement: "Líder de mercado", claim_type: "market", verification_status: "evidenced", evidence_refs: [], ...prov("website", { evidence: "" }) },
    ],
  }, ctx([SITE]));
  assertEquals(p.children.brand_claims[0].evidence_refs, ["Redução de 30% nas perdas"]);
  assertEquals(p.children.brand_claims[0].verification_status, "evidenced");
  assertEquals(p.children.brand_claims[1].verification_status, "unknown");
  assertEquals(p.children.brand_evidence[0].evidence_type, "statistic");
});

Deno.test("brand brain: entities typed", () => {
  const p = normalizeBrandBrain({ entities: [
    { name: "Computer Vision", entity_type: "technology", relationship: "usa", ...prov("website") },
    { name: "Retail", entity_type: "market", ...prov("website") },
  ] }, ctx([SITE]));
  assertEquals(p.children.brand_entities.map((e) => e.entity_type), ["technology", "market"]);
});

Deno.test("brand brain: voice with thin evidence has capped confidence", () => {
  const p = normalizeBrandBrain({ voice: { tone_traits: ["técnico", "direto"], recurring_phrases: ["uma frase"], ...prov("website", { confidence: 0.9 }) } }, ctx([SITE]));
  assertEquals(p.children.brand_voice[0].confidence, 0.5);
  const q = normalizeBrandBrain({ voice: { tone_traits: ["técnico"], recurring_phrases: ["a", "b", "c"], ...prov("website", { confidence: 0.9 }) } }, ctx([SITE]));
  assertEquals(q.children.brand_voice[0].confidence, 0.9);
});

Deno.test("brand brain: visual identity validates colors and logo domain", () => {
  const p = normalizeBrandBrain({ visual_identity: {
    primary_colors: [{ hex: "#1A2B3C", name: "Azul" }, { hex: "blue" }], detected_fonts: ["Inter"],
    logo_url: "https://evil.com/logo.png", visual_style: "minimalista", ...prov("website"),
  } }, ctx([SITE]));
  const v = p.children.brand_visual_identity[0];
  assertEquals(v.primary_colors, [{ hex: "#1A2B3C", name: "Azul" }]);
  assertEquals(v.logo_url, null);
  const q = normalizeBrandBrain({ visual_identity: { visual_style: "x", logo_url: "https://cdn.nexussight.com/l.png", ...prov("website") } }, ctx([SITE]));
  assertEquals(q.children.brand_visual_identity[0].logo_url, "https://cdn.nexussight.com/l.png");
});

Deno.test("brand brain: invalid confidence drops the item", () => {
  const p = normalizeBrandBrain({ offerings: [
    { name: "A", type: "product", ...prov("website", { confidence: 1.4 }) },
    { name: "B", type: "product", ...prov("website", { confidence: "0.8" }) },
    { name: "C", type: "product", ...prov("website", { confidence: -0.1 }) },
  ] }, ctx([SITE]));
  assertEquals(p.children.brand_offerings.length, 0);
  assertEquals(p.dropped, 3);
});

Deno.test("brand brain: explicit without evidence is downgraded to inferred with capped confidence", () => {
  const p = normalizeBrandBrain({ offerings: [{ name: "A", type: "product", ...prov("website", { evidence: "", confidence: 0.9 }) }] }, ctx([SITE]));
  assertEquals(p.children.brand_offerings[0].explicit_or_inferred, "inferred");
  assertEquals(p.children.brand_offerings[0].confidence, 0.5);
  const q = normalizeBrandBrain({ offerings: [{ name: "A", type: "product", ...prov("website", { explicit_or_inferred: "maybe" }) }] }, ctx([SITE]));
  assertEquals(q.children.brand_offerings[0].explicit_or_inferred, "inferred");
});

Deno.test("brand brain: conservative dedupe merges identical keys only", () => {
  const p = normalizeBrandBrain({ entities: [
    { name: "Visão Computacional", entity_type: "technology", ...prov("website") },
    { name: "visao computacional!", entity_type: "technology", ...prov("website", { evidence: "outro trecho", confidence: 0.6 }) },
    { name: "Visão Computacional", entity_type: "concept", ...prov("website") }, // different type → kept
    { name: "Visão Artificial", entity_type: "technology", ...prov("website") }, // similar but different → kept
  ] }, ctx([SITE]));
  assertEquals(p.children.brand_entities.length, 3);
  const merged = p.children.brand_entities.find((e) => e.entity_type === "technology" && e.name.startsWith("Visão C"))!;
  assertEquals(merged.sources.length, 2);
  assertEquals(merged.confidence, 0.8); // same source type → no corroboration boost
});

Deno.test("brand brain: two sources confirming the same fact keep both provenances", () => {
  const p = normalizeBrandBrain({ offerings: [
    { name: "Sight Platform", type: "platform", ...prov("website") },
    { name: "Sight Platform", type: "platform", ...prov("user_description", { confidence: 0.7 }) },
  ] }, ctx([SITE, DESC]));
  const o = p.children.brand_offerings;
  assertEquals(o.length, 1);
  assertEquals(o[0].sources.map((s) => s.source_type).sort(), ["user_description", "website"]);
  assertEquals(o[0].confidence, 0.85);
});

Deno.test("brand brain: dedupe helper never exceeds 0.95", () => {
  const a = { source_type: "website", source_url: null, evidence: "a", confidence: 0.95, explicit_or_inferred: "explicit", observed_at: AT } as const;
  const b = { ...a, source_type: "user_description", evidence: "b" } as const;
  const r = dedupe([{ ...a, sources: [a], k: "x" }, { ...b, sources: [b], k: "x" }], (i) => i.k);
  assertEquals(r[0].confidence, 0.95);
});

Deno.test("brand brain: extraction confidence is technical (description-only capped), null when empty", () => {
  const p = normalizeBrandBrain({ offerings: [{ name: "A", type: "product", ...prov("user_description", { confidence: 1 }) }] }, ctx([DESC]));
  assertEquals(p.brain.extraction_confidence, 0.6);
  assertEquals(extractionConfidence(normalizeBrandBrain({}, ctx([DESC])).children, {}, [DESC]), null);
  const q = normalizeBrandBrain({ offerings: [{ name: "A", type: "product", ...prov("website", { confidence: 1 }) }] }, ctx([SITE, LI_DOWN, DESC]));
  assertEquals(q.brain.extraction_confidence, 0.8);
});

Deno.test("brand brain: garbage model output yields empty, non-persistable payload", () => {
  for (const raw of [null, "texto livre", 42, [], { offerings: "x", voice: "y" }]) {
    const p = normalizeBrandBrain(raw, ctx([SITE]));
    assert(!hasKnowledge(p));
  }
});

Deno.test("brand brain: suggested pages restricted to the brand domain (not fetched)", () => {
  const p = normalizeBrandBrain({ suggested_pages: ["https://nexussight.com/cases", "https://other.com/x"] }, ctx([SITE]));
  assertEquals(p.brain.suggested_pages, ["https://nexussight.com/cases"]);
});

Deno.test("brand brain store: empresa host match is exact (no fuzzy guessing)", () => {
  assert(hostMatches("https://www.nexussight.com/", "nexussight.com"));
  assert(hostMatches("nexussight.com", "nexussight.com"));
  assert(!hostMatches("https://nexussight.com.br", "nexussight.com"));
});
