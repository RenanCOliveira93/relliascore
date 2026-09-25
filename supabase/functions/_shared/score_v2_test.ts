import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildV2Scores, computeContentScore, computeTechnicalGeo, parseContentClaims, parseEntitySignals, scoreVersionOf,
  v2AnaliseColumns, validateV2Assessment, validDimensionScore, SCORE_VERSION,
} from "./score-v2.ts";
import type { TechnicalSignals } from "./signals.ts";

const signals = (o: Partial<TechnicalSignals> = {}): TechnicalSignals => ({
  http_status: 200, redirected: false, has_title: true, title_length: 40, has_meta_description: true, meta_description_length: 120,
  has_canonical: true, canonical_matches_url: true, robots_noindex: false, has_lang: true, h1_count: 1, h2_count: 3, h3_count: 2,
  word_count: 900, thin_content: false, internal_links_count: 10, external_links_count: 3, images_count: 2, images_missing_alt: 0,
  alt_text_coverage: 1, has_structured_data: true, json_ld_invalid_count: 0, schema_types: ["Organization"], has_open_graph: true,
  has_author: true, has_published_date: true, has_modified_date: true, issues: [], ...o,
});

const clar = (status: string, evidence = "trecho") => ({ status, evidence, confidence: 0.9 });
const ev = (present: boolean) => ({ present, evidence: present ? "trecho" : "", confidence: 0.8 });
const cit = (score: number) => ({ score, evidence: "x", confidence: 0.7 });

const llm = (o: Record<string, unknown> = {}) => ({
  summary: "Resumo", strengths: ["a"], improvements: ["b"],
  semantic_relevance: { score: 80, reason: "Cobre bem o tema.", evidence: ["trecho"], confidence: 0.8 },
  entity_clarity: {
    primary_entity: clar("clear"), entity_name_clear: clar("clear"), category_clear: clar("clear"), offering_clear: clar("clear"),
    audience_clear: clar("partial"), problem_clear: clar("clear"), value_proposition_clear: clar("clear"), differentiators_clear: clar("absent", ""),
  },
  evidence_readiness: {
    statistics: ev(true), external_references: ev(false), cases: ev(true), customers: ev(false), certifications: ev(false),
    studies: ev(false), author: ev(false), published_date: ev(false), modified_date: ev(false),
  },
  citation_readiness: {
    reason: "Boa estrutura.", self_contained_facts: cit(70), clear_definitions: cit(60), direct_answers: cit(80),
    contextualized_numbers: cit(50), descriptive_headings: cit(90), claim_evidence_connection: cit(40), extractable_passages: cit(70),
  },
  entity_signals: [{ name: "Acme", type: "organization", evidence: "A Acme é...", confidence: 0.9, explicit_or_inferred: "explicit" }],
  content_claims: [
    { summary: "Reduz custos em 30%", evidence: "estudo interno 2025", support_status: "supported", support_type: "statistic", confidence: 0.8 },
    { summary: "Líder de mercado", support_status: "unsupported", support_type: "none", confidence: 0.7 },
  ],
  compatibility_diagnostic: { conteudo_atual: "a", conteudo_ideal: "b", gap_analysis: [], compatibility_percentage: 60 },
  action_plan: [{ priority: "alta", action: "Adicionar dados", impact: "x", category: "conteudo", basis: "inference", affected_dimension: "evidence_authority" },
    { priority: "baixa", action: "Y", impact: "y", category: "conteudo", affected_dimension: "made_up" }],
  keywords_analysis: { found: [], missing: [], suggested: [] }, ideal_example: "",
  ...o,
});

Deno.test("v2: weighted formula is exact", () => {
  const r = computeContentScore({ semantic_relevance: 80, entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: 100 });
  assert(r.ok);
  if (r.ok) { assertEquals(r.value.content_score, 80 * 0.3 + 60 * 0.2 + 40 * 0.2 + 50 * 0.15 + 100 * 0.15); assertEquals(r.value.partial, false); }
});
Deno.test("v2: limits 0 and 100", () => {
  const z = computeContentScore({ semantic_relevance: 0, entity_clarity: 0, evidence_authority: 0, citation_readiness: 0, technical_geo: 0 });
  const h = computeContentScore({ semantic_relevance: 100, entity_clarity: 100, evidence_authority: 100, citation_readiness: 100, technical_geo: 100 });
  assert(z.ok && h.ok);
  if (z.ok && h.ok) { assertEquals(z.value.content_score, 0); assertEquals(h.value.content_score, 100); }
});
Deno.test("v2: invalid dimension fails (never becomes 50)", () => {
  assertEquals(computeContentScore({ semantic_relevance: 120, entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: 10 }).ok, false);
  assertEquals(computeContentScore({ semantic_relevance: NaN, entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: 10 }).ok, false);
  assertEquals(computeContentScore({ semantic_relevance: 80, entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: -1 }).ok, false);
  assertEquals(validDimensionScore("50"), null);
});
Deno.test("v2: missing essential dimension fails; missing technical_geo is partial + renormalized", () => {
  assertEquals(computeContentScore({ entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: 10 }).ok, false);
  const p = computeContentScore({ semantic_relevance: 80, entity_clarity: 60, evidence_authority: 40, citation_readiness: 50, technical_geo: null });
  assert(p.ok);
  if (p.ok) {
    assertEquals(p.value.partial, true);
    assertEquals(p.value.weights_applied.technical_geo, undefined);
    const expected = (80 * 0.3 + 60 * 0.2 + 40 * 0.2 + 50 * 0.15) / 0.85;
    assert(Math.abs(p.value.content_score - expected) < 0.001);
  }
});
Deno.test("v2: overall score is computed by the backend; LLM-provided score is ignored", () => {
  const v = validateV2Assessment(llm({ score: 99, sub_scores: { x: 1 }, technical_geo: 100 }));
  assert(v.ok);
  if (!v.ok) return;
  assertEquals(v.value.ignored_fields.sort(), ["score", "sub_scores", "technical_geo"].sort());
  const b = buildV2Scores(v.value, signals());
  assert(b.ok);
  if (b.ok) {
    assert(b.value.score !== 99);
    const d = b.value.score_dimensions;
    const expected = d.semantic_relevance.score! * 0.3 + d.entity_clarity.score! * 0.2 + d.evidence_authority.score! * 0.2 + d.citation_readiness.score! * 0.15 + d.technical_geo.score! * 0.15;
    assert(Math.abs(b.value.content_score - expected) < 0.001);
    assertEquals(b.value.score, Math.round(b.value.content_score));
    assertEquals(d.technical_geo.source, "deterministic");
    assertEquals(d.semantic_relevance.source, "llm");
    assertEquals(d.entity_clarity.source, "hybrid");
  }
});
Deno.test("v2: technical GEO is deterministic from signals", () => {
  assertEquals(computeTechnicalGeo(signals()).score, 100);
  const bad = computeTechnicalGeo(signals({ has_title: false, has_meta_description: false, h1_count: 0, robots_noindex: true }));
  assertEquals(bad.score, 100 - 15 - 10 - 10 - 10);
});
Deno.test("v2: conflict LLM vs technical signal → signal wins", () => {
  const raw = llm();
  (raw.evidence_readiness as any).author = { present: true, evidence: "Por João", confidence: 0.9 };
  const v = validateV2Assessment(raw);
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, signals({ has_author: false, has_published_date: true }));
  assert(b.ok);
  if (b.ok) {
    assertEquals(b.value.evidence_readiness.items.author.present, false);
    assertEquals(b.value.evidence_readiness.items.author.source, "deterministic");
    assertEquals(b.value.evidence_readiness.items.published_date.present, true); // LLM said false, signal says true
    assert(b.value.evidence_readiness.conflicts.some((c) => c.startsWith("author")));
  }
});
Deno.test("v2: descriptive headings capped when there are no subheadings", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, signals({ h2_count: 0, h3_count: 0 }));
  assert(b.ok);
  if (b.ok) assertEquals(b.value.citation_readiness.factors.descriptive_headings.score, 20);
});
Deno.test("v2: entity parsing", () => {
  const e = parseEntitySignals([
    { name: "Acme", type: "organization", evidence: "A Acme", confidence: 2, explicit_or_inferred: "explicit" },
    { name: "X", type: "alien", explicit_or_inferred: "explicit" },
    { type: "person" },
  ]);
  assertEquals(e.length, 2);
  assertEquals(e[0].confidence, 1);
  assertEquals(e[1].type, "other");
  assertEquals(e[1].explicit_or_inferred, "inferred"); // explicit without evidence is downgraded
});
Deno.test("v2: claim parsing", () => {
  const c = parseContentClaims([
    { summary: "A", evidence: "fonte", support_status: "supported", support_type: "reference", confidence: 0.5 },
    { summary: "B", support_status: "supported", support_type: "statistic" },
    { summary: "C", support_status: "weird", support_type: "weird" },
  ]);
  assertEquals(c[0].support_status, "supported");
  assertEquals(c[1].support_status, "unknown"); // no evidence → cannot be supported
  assertEquals(c[2].support_status, "unknown");
  assertEquals(c[2].support_type, "other");
});
Deno.test("v2: evidence readiness counts and scores", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, null);
  assert(b.ok);
  if (b.ok) {
    const er = b.value.evidence_readiness;
    assertEquals(er.factual_claims, 2);
    assertEquals(er.supported_claims, 1);
    assertEquals(er.unsupported_claims, 1);
    // items total 85 + claim support 15 = 100 → statistics 15 + cases 10 + 15*0.5 = 32.5
    assertEquals(er.score, 32.5);
    assertEquals(b.value.score_dimensions.evidence_authority.source, "llm");
  }
});
Deno.test("v2: evidence present without literal evidence is not counted", () => {
  const raw = llm();
  (raw.evidence_readiness as any).studies = { present: true, confidence: 0.9 };
  const v = validateV2Assessment(raw);
  assert(v.ok);
  if (v.ok) assertEquals(v.value.evidence_raw.studies.present, false);
});
Deno.test("v2: citation readiness is the mean of 7 factors and invalid factor fails", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, null);
  assert(b.ok);
  if (b.ok) assertEquals(b.value.citation_readiness.score, Math.round(((70 + 60 + 80 + 50 + 90 + 40 + 70) / 7) * 100) / 100);
  const bad = llm();
  (bad.citation_readiness as any).direct_answers = { score: 150, confidence: 1 };
  assertEquals(validateV2Assessment(bad).ok, false);
});
Deno.test("v2: missing semantic/entity assessment fails", () => {
  assertEquals(validateV2Assessment(llm({ semantic_relevance: { score: 80 } })).ok, false);
  const raw = llm();
  delete (raw.entity_clarity as any).offering_clear;
  assertEquals(validateV2Assessment(raw).ok, false);
});
Deno.test("v2: text input → technical GEO unavailable, partial score, legacy adapters filled", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, null);
  assert(b.ok);
  if (b.ok) {
    assertEquals(b.value.score_dimensions.technical_geo.available, false);
    assertEquals(b.value.score_dimensions.technical_geo.score, null);
    assertEquals(b.value.content_score_partial, true);
    assertEquals(Object.keys(b.value.sub_scores).length, 5);
    assertEquals(b.value.score_version, "2.0");
  }
});
Deno.test("v2: action plan keeps structure and validates affected_dimension", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (v.ok) {
    assertEquals(v.value.action_plan[0].affected_dimension, "evidence_authority");
    assertEquals(v.value.action_plan[1].affected_dimension, undefined);
  }
});
Deno.test("v2: legacy vs 2.0 version interpretation", () => {
  assertEquals(scoreVersionOf({}), "legacy");
  assertEquals(scoreVersionOf({ score_version: null }), "legacy");
  assertEquals(scoreVersionOf({ score_version: "2.0" }), "2.0");
});
Deno.test("v2: persistence columns carry version; legacy data adds nothing", () => {
  assertEquals(v2AnaliseColumns({ score: 70, sub_scores: {} }), {});
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, signals());
  assert(b.ok);
  if (!b.ok) return;
  const row = v2AnaliseColumns({ ...b.value, technical_signals: signals() });
  assertEquals(row.score_version, SCORE_VERSION);
  assertEquals(row.content_score, b.value.content_score);
  assertEquals(row.dim_technical_geo, 100);
  assertEquals(row.dim_semantic_relevance, 80);
  assert(row.entity_signals && row.content_claims && row.evidence_readiness && row.citation_readiness);
});
