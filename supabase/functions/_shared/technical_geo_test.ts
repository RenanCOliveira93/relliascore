import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyPageType, computeTechnicalGeoV2, TECHNICAL_GEO_RULESET_V1, TECHNICAL_GEO_VERSION } from "./technical-geo.ts";
import { crawlerAccessFrom, evaluate, parseRobots } from "./robots.ts";
import { buildAnaliseRow } from "./persist.ts";
import { buildV2Scores, computeContentScore, scoreVersionOf, validateV2Assessment } from "./score-v2.ts";
import type { TechnicalSignals } from "./signals.ts";

const sig = (o: Partial<TechnicalSignals> = {}): TechnicalSignals => ({
  http_status: 200, redirected: false, has_title: true, title_length: 40, has_meta_description: true, meta_description_length: 120,
  has_canonical: true, canonical_matches_url: true, robots_noindex: false, has_lang: true, h1_count: 1, h2_count: 3, h3_count: 2,
  word_count: 900, thin_content: false, internal_links_count: 10, external_links_count: 3, images_count: 2, images_missing_alt: 0,
  alt_text_coverage: 1, has_structured_data: true, json_ld_invalid_count: 0, schema_types: ["Organization", "WebSite"], has_open_graph: true,
  has_author: false, has_published_date: false, has_modified_date: false, issues: [],
  final_url: "https://acme.com/", is_https: true, content_type: "text/html", canonical_other_host: false,
  heading_levels: [1, 2, 3, 2, 3, 2], empty_headings_count: 0, list_count: 2, has_contact_links: true, generic_anchor_count: 0,
  og_type: "website", schema_entity: { type: "Organization", name: "Acme", has_logo: true, same_as_count: 2, has_address: false, has_contact: false },
  ...o,
});
const article = (o: Partial<TechnicalSignals> = {}) => sig({
  final_url: "https://acme.com/blog/guia-geo", og_type: "article", schema_types: ["BlogPosting", "BreadcrumbList"],
  has_author: true, has_published_date: true, has_modified_date: true, schema_entity: null, ...o,
});
const rule = (r: ReturnType<typeof computeTechnicalGeoV2>, id: string) => r.rules.find((x) => x.id === id)!;

Deno.test("tg: ruleset version and weights label", () => {
  const r = computeTechnicalGeoV2(sig());
  assertEquals(r.technical_geo_version, TECHNICAL_GEO_VERSION);
  assertEquals(r.weights, "heuristic_weights_v1");
  assert(r.rules.every((x) => x.version === "1.0" && x.source === "deterministic"));
  assertEquals(new Set(TECHNICAL_GEO_RULESET_V1.map((d) => d.id)).size, TECHNICAL_GEO_RULESET_V1.length);
});
Deno.test("tg: page type classification", () => {
  assertEquals(classifyPageType(sig()).page_type, "homepage");
  const a = classifyPageType(article());
  assertEquals(a.page_type, "article");
  assert(a.confidence >= 0.8);
  assertEquals(classifyPageType(sig({ final_url: "https://x.com/produtos/tenis", schema_types: ["Product"], og_type: null })).page_type, "product");
  const amb = classifyPageType(sig({ final_url: "https://x.com/abc", schema_types: [], og_type: null }));
  assertEquals(amb.page_type, "other");
  assert(amb.confidence <= 0.4, "no false confidence");
  const conflict = classifyPageType(sig({ final_url: "https://x.com/blog/x", schema_types: ["Product"], og_type: null }));
  assert(conflict.confidence < 0.8, "conflicting signals lower confidence");
});
Deno.test("tg: homepage without author/dates loses nothing (not_applicable)", () => {
  const r = computeTechnicalGeoV2(sig());
  for (const id of ["author", "published_date", "modified_date", "external_references", "breadcrumb"]) assertEquals(rule(r, id).status, "not_applicable");
  assertEquals(r.score, 100);
});
Deno.test("tg: article without author loses points", () => {
  const full = computeTechnicalGeoV2(article());
  const noAuthor = computeTechnicalGeoV2(article({ has_author: false }));
  assertEquals(rule(noAuthor, "author").status, "fail");
  assert(noAuthor.score < full.score);
});
Deno.test("tg: homepage without Article schema is fine; article with BlogPosting passes", () => {
  assertEquals(rule(computeTechnicalGeoV2(sig()), "schema_matches_page_type").status, "pass");
  assertEquals(rule(computeTechnicalGeoV2(article()), "schema_matches_page_type").status, "pass");
  const wrong = computeTechnicalGeoV2(article({ schema_types: ["Organization"], final_url: "https://acme.com/blog/x" }));
  assertEquals(rule(wrong, "schema_matches_page_type").status, "fail");
  assert(wrong.structured_data_recommendations.some((x) => x.schema_type === "Article"));
});
Deno.test("tg: not_applicable excluded from denominator; unavailable separate from fail", () => {
  const r = computeTechnicalGeoV2(sig());
  const measured = r.rules.filter((x) => ["pass", "warning", "fail"].includes(x.status)).reduce((a, x) => a + x.max_points, 0);
  assertEquals(r.applicable_points, measured);
  const js = rule(r, "js_dependency");
  assertEquals(js.status, "unavailable");
  assertEquals(js.score, null);
  assert(r.unavailable_points >= js.max_points);
  // Missing optional signals become unavailable, never fail
  const legacySig = sig({ is_https: undefined, content_type: undefined, schema_entity: undefined, empty_headings_count: undefined, generic_anchor_count: undefined });
  const l = computeTechnicalGeoV2(legacySig);
  for (const id of ["https", "content_type_html", "entity_schema", "empty_headings", "descriptive_anchors"]) assertEquals(rule(l, id).status, "unavailable");
});
Deno.test("tg: coverage is separate from score", () => {
  const r = computeTechnicalGeoV2(sig());
  assertEquals(r.score, 100);
  assert(r.coverage < 1 && r.coverage > 0.7);
  assertEquals(r.coverage, Math.round(r.applicable_points / (r.applicable_points + r.unavailable_points) * 100) / 100);
});
Deno.test("tg: long title = warning, not fail", () => {
  const x = rule(computeTechnicalGeoV2(sig({ title_length: 90 })), "title_length");
  assertEquals(x.status, "warning");
  assertEquals(x.score, 1);
});
Deno.test("tg: noindex is critical; missing meta description is not", () => {
  const r = computeTechnicalGeoV2(sig({ robots_noindex: true, has_meta_description: false, meta_description_length: 0 }));
  assert(r.critical_issues.some((c) => c.rule_id === "indexable"));
  assert(!r.critical_issues.some((c) => c.rule_id === "meta_description"));
  assert(r.quick_wins.some((q) => q.rule_id === "meta_description"));
  assertEquals(rule(r, "meta_description_length").status, "not_applicable");
});
Deno.test("tg: invalid JSON-LD", () => {
  const partial = computeTechnicalGeoV2(sig({ json_ld_invalid_count: 1 }));
  assertEquals(rule(partial, "json_ld_valid").status, "fail");
  assert(!partial.critical_issues.some((c) => c.rule_id === "json_ld_valid"));
  const allBad = computeTechnicalGeoV2(sig({ has_structured_data: false, json_ld_invalid_count: 2, schema_types: [] }));
  assert(allBad.critical_issues.some((c) => c.rule_id === "json_ld_valid"));
});
Deno.test("tg: alt coverage", () => {
  assertEquals(rule(computeTechnicalGeoV2(sig({ images_count: 0, alt_text_coverage: null })), "alt_text").status, "not_applicable");
  const half = rule(computeTechnicalGeoV2(sig({ images_count: 10, images_missing_alt: 5, alt_text_coverage: 0.5 })), "alt_text");
  assertEquals(half.status, "warning");
  assertEquals(half.score, 1.5);
});
Deno.test("tg: heading hierarchy (no arbitrary H2 count)", () => {
  assertEquals(rule(computeTechnicalGeoV2(sig({ h2_count: 0, h3_count: 0, word_count: 200, heading_levels: [1] })), "heading_hierarchy").status, "pass");
  assertEquals(rule(computeTechnicalGeoV2(sig({ heading_levels: [1, 3, 3, 4] })), "heading_hierarchy").status, "warning");
  assertEquals(rule(computeTechnicalGeoV2(article({ h2_count: 0, h3_count: 0, word_count: 1500, heading_levels: [1] })), "heading_hierarchy").status, "warning");
});
Deno.test("tg: score always 0–100", () => {
  const worst = computeTechnicalGeoV2(sig({ http_status: 500, robots_noindex: true, has_title: false, has_meta_description: false, h1_count: 0, has_canonical: false, has_lang: false, has_structured_data: false, schema_types: [], has_open_graph: false, word_count: 5, internal_links_count: 0, is_https: false, schema_entity: null }));
  assert(worst.score >= 0 && worst.score <= 100);
  assert(worst.score < 20);
});
Deno.test("robots: RFC 9309 matching and AI crawler registry", () => {
  const txt = "User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /private$";
  const g = parseRobots(txt);
  assertEquals(evaluate(g, "GPTBot", "/blog").verdict, "blocked");
  assertEquals(evaluate(g, "Googlebot", "/blog").verdict, "allowed");
  assertEquals(evaluate(g, "PerplexityBot", "/admin/x").verdict, "blocked");
  assertEquals(evaluate(g, "PerplexityBot", "/blog").verdict, "no_rule");
  const acc = crawlerAccessFrom(txt, "/blog");
  assertEquals(acc.find((c) => c.token === "GPTBot")!.category, "training");
  const r = computeTechnicalGeoV2(sig(), { robots: { status: "fetched", url: "x", path: "/blog", crawlers: acc, registry_version: "t", note: "" } });
  assertEquals(rule(r, "robots_txt_search_access").status, "pass"); // training bot blocked ≠ search blocked
  const blockAll = crawlerAccessFrom("User-agent: *\nDisallow: /", "/");
  const r2 = computeTechnicalGeoV2(sig(), { robots: { status: "fetched", url: "x", path: "/", crawlers: blockAll, registry_version: "t", note: "" } });
  assertEquals(rule(r2, "robots_txt_search_access").status, "fail");
  assertEquals(rule(computeTechnicalGeoV2(sig()), "robots_txt_search_access").status, "unavailable");
});

// ---- Content Score integration ----
const clar = (status: string) => ({ status, evidence: "trecho", confidence: 0.9 });
const llm = () => ({
  summary: "s", strengths: [], improvements: [],
  semantic_relevance: { score: 80, reason: "r", evidence: ["e"], confidence: 0.8 },
  entity_clarity: Object.fromEntries(["primary_entity", "entity_name_clear", "category_clear", "offering_clear", "audience_clear", "problem_clear", "value_proposition_clear", "differentiators_clear"].map((k) => [k, clar("clear")])),
  evidence_readiness: Object.fromEntries(["statistics", "external_references", "cases", "customers", "certifications", "studies", "author", "published_date", "modified_date"].map((k) => [k, { present: false, confidence: 0.8 }])),
  citation_readiness: { reason: "r", ...Object.fromEntries(["self_contained_facts", "clear_definitions", "direct_answers", "contextualized_numbers", "descriptive_headings", "claim_evidence_connection", "extractable_passages"].map((k) => [k, { score: 60, evidence: "x", confidence: 0.7 }])) },
  entity_signals: [], content_claims: [],
  compatibility_diagnostic: { conteudo_atual: "a", conteudo_ideal: "b", gap_analysis: [], compatibility_percentage: 50 },
  action_plan: [], keywords_analysis: { found: [], missing: [], suggested: [] }, ideal_example: "x",
});

Deno.test("text input: Technical GEO N/D, 4 weights normalized, partial", () => {
  const c = computeContentScore({ semantic_relevance: 85, entity_clarity: 85, evidence_authority: 85, citation_readiness: 85, technical_geo: null });
  assert(c.ok);
  if (!c.ok) return;
  assertEquals(c.value.partial, true);
  assertEquals(c.value.weights_applied, { semantic_relevance: 0.3529, entity_clarity: 0.2353, evidence_authority: 0.2353, citation_readiness: 0.1765 });
  assertEquals(c.value.content_score, 85);
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, null);
  assert(b.ok);
  if (!b.ok) return;
  assertEquals(b.value.score_dimensions.technical_geo.available, false);
  assertEquals(b.value.technical_geo, null);
  assertEquals(b.value.dimensions_used, ["semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness"]);
});
Deno.test("persistence: authenticated success row carries Technical GEO; failure never persists", () => {
  const v = validateV2Assessment(llm());
  assert(v.ok);
  if (!v.ok) return;
  const b = buildV2Scores(v.value, sig());
  assert(b.ok);
  if (!b.ok) return;
  const ctx = { userId: "u", workspaceId: "w", empresaId: null, origem: "app" as const, inputType: "webpage" as const, mode: "business", searchQuery: "q", websiteUrl: "https://acme.com/" };
  const row = buildAnaliseRow({ ...b.value, status: "success" }, ctx)!;
  assertEquals(row.origem, "app");
  assertEquals(row.technical_geo_version, "1.0");
  assertEquals(row.page_type, "homepage");
  assertEquals(row.dim_technical_geo, 100);
  assert(Array.isArray(row.technical_geo_rules));
  assert(typeof row.technical_geo_coverage === "number");
  assertEquals(buildAnaliseRow({ status: "crawl_failed", error: "x" }, ctx), null);
  assertEquals(buildAnaliseRow({ status: "analysis_failed" }, ctx), null);
  const text = buildAnaliseRow({ ...buildV2Scores(v.value, null).ok && (buildV2Scores(v.value, null) as any).value, status: "success" }, { ...ctx, inputType: "text", websiteUrl: "leak" })!;
  assertEquals(text.website_url, null);
  assertEquals(text.content_score_partial, true);
  assertEquals(text.technical_geo_version, null);
});
Deno.test("legacy still interpreted as legacy (no recalculation)", () => {
  assertEquals(scoreVersionOf({ score: 70 }), "legacy");
  const row = buildAnaliseRow({ status: "success", score: 70, sub_scores: {} }, { userId: "u", workspaceId: "w", empresaId: null, origem: "webhook_api", inputType: "webpage", mode: "business", searchQuery: "q", websiteUrl: null })!;
  assertEquals(row.score_version, undefined);
  assertEquals(row.technical_geo_version, undefined);
});
