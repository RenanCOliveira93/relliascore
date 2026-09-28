import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { buildTerritoryContext, renderTerritoryContext, territoryContextIds, type TerritoryData } from "./territory-context.ts";
import { computeTerritoryAlignment, isLiteral, TA_ORDER, TA_WEIGHTS, territoryAnaliseColumns, territoryAvailability, territoryWebhookFields, validateTerritoryAssessment } from "./territory-alignment.ts";
import { computeBrandAlignment, BA_WEIGHTS } from "./brand-alignment.ts";
import { buildAnaliseRow } from "./persist.ts";
import { matchOutdatedRelations, parseTerritoryAction, labelSimilarity } from "./territories.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const territory = {
  id: id(100), empresa_id: id(200), name: "Inteligência de varejo", territory_type: "category", priority: "primary", status: "active",
  strategic_intent: "Ser entendida como plataforma que transforma dados visuais de lojas em inteligência operacional.",
  desired_association: "Nexus Sight é uma solução de inteligência de varejo baseada em visão computacional.",
  core_concept: "Inteligência operacional para varejo físico", description: null, target_audience_summary: "Redes varejistas",
  included_topics: ["prevenção de perdas", "analytics de loja física"], excluded_topics: ["BI genérico"], related_concepts: ["Retail Analytics"],
  updated_at: "2026-09-27T00:00:00Z", last_reviewed_brand_brain_version: 1,
};
const rel = (n: number, kind: string, label: string, v = 2, origin = "user_defined") => ({ id: id(n + 500), item_id: id(n), relation_kind: kind, item_label: label, brand_brain_version: v, origin, brand_brain_id: id(900) });
const data = (over: Partial<TerritoryData> = {}): TerritoryData => ({
  territory, company_name: "Nexus Sight", active_brain_version: 2,
  relations: [rel(1, "offering", "Nexus Vision"), rel(2, "problem", "Perdas em loja"), rel(3, "evidence", "Case Cliente Y"), rel(4, "claim", "Reduz perdas em 30%", 1)],
  items: { [id(3)]: { id: id(3), value: "30% menos perdas", description: "Case varejo" } }, ...over,
});
const CONTENT = "A Nexus Sight usa visão computacional para prevenção de perdas em lojas físicas. Clientes reduziram perdas em 30% com inteligência operacional.";
const dims = (over: Record<string, unknown> = {}) => Object.fromEntries(TA_ORDER.map((k) => [k, { applicable: true, score: 80, reason: "r", content_evidence: ["visão computacional para prevenção de perdas"], territory_refs: ["t:core"], confidence: 0.8, ...(over[k] as object ?? {}) }]));

Deno.test("context: snapshot fields, topic IDs, outdated relation flagged, readiness copied", () => {
  const c = buildTerritoryContext(data());
  assertEquals(c.territory_name, "Inteligência de varejo");
  assertEquals(c.included_topics.map((t) => t.id), ["topic:1", "topic:2"]);
  assertEquals(c.excluded_topics[0], { id: "excluded:1", text: "BI genérico" });
  assert(c.relations.find((r) => r.id === id(4))!.source_version_outdated);
  assert(!c.relations.find((r) => r.id === id(1))!.source_version_outdated);
  assertEquals(c.relations.find((r) => r.id === id(3))!.detail, "30% menos perdas — Case varejo");
  assertEquals(c.readiness.label, "3 de 6 fundamentos conectados");
  assertEquals(c.last_reviewed_brand_brain_version, 1);
  const ids = territoryContextIds(c);
  assert(ids.has(id(1)) && ids.has("topic:2") && ids.has("t:intent"));
  assert(renderTerritoryContext(c).includes("versão anterior do Brand Profile"));
});
Deno.test("context: budget / kind limit exclusions recorded", () => {
  const many = Array.from({ length: 12 }, (_, i) => rel(10 + i, "entity", `Entidade ${i}`));
  const c = buildTerritoryContext(data({ relations: many }));
  assertEquals(c.relations.length, 8);
  assert(c.selection.truncated && c.selection.excluded.every((e) => e.reason === "kind_limit"));
  const tiny = buildTerritoryContext(data(), 400);
  assert(tiny.selection.excluded.some((e) => e.reason === "budget"));
});
Deno.test("snapshot is a copy: changing the territory later does not change it", () => {
  const d = data(); const c = buildTerritoryContext(d);
  d.territory.name = "Outro"; (d.territory.included_topics as string[]).push("x");
  assertEquals(c.territory_name, "Inteligência de varejo");
  assertEquals(c.included_topics.length, 2);
  d.territory.name = "Inteligência de varejo"; (d.territory.included_topics as string[]).pop();
});
Deno.test("formula: fixed weights sum to 1 and are computed in backend", () => {
  assertEquals(Math.round(Object.values(TA_WEIGHTS).reduce((a, b) => a + b, 0) * 1000), 1000);
  const all = Object.fromEntries(TA_ORDER.map((k) => [k, { available: true, score: 100 }])) as never;
  assertEquals(computeTerritoryAlignment(all).score, 100);
  const mixed = { core_relevance: { available: true, score: 90 }, strategic_intent: { available: true, score: 70 }, topic_coverage: { available: true, score: 60 }, brand_territory_connection: { available: true, score: 40 }, evidence_support: { available: true, score: 80 }, semantic_focus: { available: true, score: 100 } };
  assertEquals(computeTerritoryAlignment(mixed).score, Math.round(90 * .3 + 70 * .2 + 60 * .15 + 40 * .15 + 80 * .1 + 100 * .1));
  assertEquals(computeTerritoryAlignment(mixed).partial, false);
});
Deno.test("unavailable dimension: no zero, weights redistributed, partial", () => {
  const d = { core_relevance: { available: true, score: 80 }, strategic_intent: { available: true, score: 80 }, topic_coverage: { available: true, score: 80 }, brand_territory_connection: { available: true, score: 80 }, evidence_support: { available: false, score: null }, semantic_focus: { available: true, score: 80 } };
  const r = computeTerritoryAlignment(d);
  assertEquals(r.score, 80); assert(r.partial);
  assertEquals(r.weights.evidence_support, undefined);
  assertEquals(r.weights.core_relevance, Math.round((0.3 / 0.9) * 10000) / 10000);
  assertEquals(computeTerritoryAlignment(Object.fromEntries(TA_ORDER.map((k) => [k, { available: false, score: null }])) as never).score, null);
});
Deno.test("availability: evidence support off without claims/evidence; intent off without intent/association; topics off without topics", () => {
  const c = buildTerritoryContext(data({ relations: [rel(1, "offering", "X")], territory: { ...territory, strategic_intent: null, desired_association: null, included_topics: [], related_concepts: [] } }));
  const a = territoryAvailability(c);
  assert(!a.evidence_support.available && !a.strategic_intent.available && !a.topic_coverage.available);
  assert(a.core_relevance.available && a.brand_territory_connection.available && a.semantic_focus.available);
});
Deno.test("validation: six dimensions, invented refs dropped, non-literal evidence dropped, model score ignored", () => {
  const c = buildTerritoryContext(data());
  const raw = { overall_score: 99, dimensions: dims({ core_relevance: { territory_refs: ["t:core", id(777)], content_evidence: ["visão computacional para prevenção de perdas", "frase que não existe no texto"] } }), topic_coverage: { topics_present: ["topic:1", "excluded:1", "bogus"], relevant_topics_missing: ["topic:2", "topic:1"], topics_not_applicable: ["concept:1"] }, claim_checks: [], findings: [], strengths: [], gaps: [], next_actions: [], optimized_version: "" };
  const r = validateTerritoryAssessment(raw, c, CONTENT);
  assertEquals(Object.keys(r.territory_alignment_dimensions).length, 6);
  assertEquals(r.territory_alignment_dimensions.core_relevance.territory_reference, ["t:core"]);
  assertEquals(r.territory_alignment_dimensions.core_relevance.evidence, ["visão computacional para prevenção de perdas"]);
  assert(r.discarded_references >= 2);
  assertEquals(r.territory_alignment_score, 80);
  assertEquals(r.territory_topic_coverage, { topics_present: ["topic:1"], relevant_topics_missing: ["topic:2"], topics_not_applicable: ["concept:1"] });
});
Deno.test("evidence support: model can mark not applicable → not zero, partial", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims({ evidence_support: { applicable: false, score: 0 } }) }, c, CONTENT);
  assertEquals(r.territory_alignment_dimensions.evidence_support.available, false);
  assertEquals(r.territory_alignment_dimensions.evidence_support.score, null);
  assert(r.territory_alignment_partial);
  assertEquals(r.territory_alignment_score, 80);
});
Deno.test("not_found is not false; conflict requires ref + concrete evidence", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims(), claim_checks: [
    { content_claim: "Mais de 200 lojas", classification: "conflicts_with_territory_evidence", confidence: 0.9 },
    { content_claim: "reduziram perdas em 30%", classification: "conflicts_with_territory_evidence", territory_ref: id(3), conflict_evidence: "Case mostra 20%", confidence: 0.9 },
    { content_claim: "Algo", classification: "supported_by_territory_evidence", confidence: 0.9 },
  ] }, c, CONTENT);
  const f = r.territory_findings;
  assertEquals(f.find((x) => x.statement === "Mais de 200 lojas")!.classification, "not_found_in_territory");
  assertEquals(f.find((x) => x.statement === "Mais de 200 lojas")!.type, "unsupported_claim");
  const conflict = f.find((x) => x.classification === "conflicts_with_territory_evidence")!;
  assertEquals(conflict.territory_evidence, "Case mostra 20%");
  assertEquals(conflict.severity, "high");
  assertEquals(f.find((x) => x.statement === "Algo")!.classification, "not_found_in_territory");
});
Deno.test("excluded topics are not forbidden words: conflict only with excluded ref + literal content", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims(), findings: [
    { type: "excluded_concept_conflict", severity: "high", dimension: "semantic_focus", statement: "menciona BI", confidence: 0.8 },
    { type: "excluded_concept_conflict", severity: "medium", dimension: "semantic_focus", statement: "reposiciona", territory_ref: "excluded:1", content_evidence: "inteligência operacional", confidence: 0.8 },
    { type: "territory_conflict", severity: "high", dimension: "core_relevance", statement: "sem prova", confidence: 0.8 },
  ] }, c, CONTENT);
  const types = r.territory_findings.map((f) => `${f.type}:${f.severity}`);
  assert(types.includes("excluded_concept_conflict:medium"));
  assertEquals(types.filter((t) => t === "info:info").length, 2);
});
Deno.test("strengths require literal evidence; gaps typed; next actions max 5; outdated relation gap added", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims(),
    strengths: [{ statement: "Explica o conceito", dimension: "core_relevance", content_evidence: "inteligência operacional" }, { statement: "Inventado", dimension: "core_relevance", content_evidence: "texto ausente do conteúdo" }],
    gaps: [{ statement: "Pouca ligação com a marca", gap_type: "weak_brand_connection", dimension: "brand_territory_connection" }, { statement: "x", gap_type: "weird", dimension: "core_relevance" }],
    next_actions: Array.from({ length: 7 }, (_, i) => ({ text: `Ação ${i}`, dimension: "strategic_intent", priority: "high" })) }, c, CONTENT);
  assertEquals(r.territory_strengths.map((s) => s.statement), ["Explica o conceito"]);
  assertEquals(r.territory_gaps.map((g) => g.gap_type), ["weak_brand_connection", "outdated_relation"]);
  assertEquals(r.territory_next_actions.length, 5);
});
Deno.test("outdated relation lowers confidence (not treated as wrong)", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims({ evidence_support: { territory_refs: [id(4)], confidence: 1 } }) }, c, CONTENT);
  assertEquals(r.territory_alignment_dimensions.evidence_support.confidence, 0.8);
  assertEquals(r.territory_alignment_dimensions.evidence_support.available, true);
});
Deno.test("optimized version: invented numbers removed, known ones kept, markdown stripped", () => {
  const c = buildTerritoryContext(data());
  const r = validateTerritoryAssessment({ dimensions: dims(), optimized_version: "## Nexus Sight reduz perdas em 30%. Atende 500 lojas no Brasil. É **inteligência operacional** para varejo." }, c, CONTENT);
  assert(r.territory_optimized_version!.includes("30%"));
  assert(!r.territory_optimized_version!.includes("500"));
  assert(!r.territory_optimized_version!.includes("#") && !r.territory_optimized_version!.includes("*"));
});
Deno.test("literal matcher tolerant to accents/case/quotes", () => {
  const n = "a nexus sight usa visao computacional";
  assert(isLiteral("“Visão Computacional”", n));
  assert(!isLiteral("abc", n));
});
Deno.test("history columns, API and webhook subsets; nothing without territory", () => {
  const c = buildTerritoryContext(data());
  const ta = validateTerritoryAssessment({ dimensions: dims() }, c, CONTENT);
  const res = { ...ta, territory_snapshot: c };
  const cols = territoryAnaliseColumns(res);
  assertEquals(cols.territory_id, id(100));
  assertEquals((cols.territory_snapshot as { territory_name: string }).territory_name, "Inteligência de varejo");
  assert("_topic_coverage" in (cols.territory_alignment_dimensions as object));
  const wh = territoryWebhookFields(res);
  assertEquals(Object.keys(wh).sort(), ["territory_alignment_partial", "territory_alignment_score", "territory_alignment_version", "territory_id", "territory_name"]);
  assertEquals(territoryAnaliseColumns({ score: 1 }), {});
  assertEquals(territoryWebhookFields({}), {});
  const row = buildAnaliseRow({ status: "success", score: 70, ...res }, { userId: "u", workspaceId: "w", empresaId: id(200), origem: "app", inputType: "text", mode: "business", searchQuery: "q", websiteUrl: null })!;
  assertEquals(row.territory_alignment_score, 80);
  const plain = buildAnaliseRow({ status: "success", score: 70 }, { userId: "u", workspaceId: "w", empresaId: null, origem: "app", inputType: "text", mode: "business", searchQuery: "q", websiteUrl: null })!;
  assert(!("territory_id" in plain));
});
Deno.test("Brand Alignment and weights untouched by territory module", () => {
  assertEquals(BA_WEIGHTS.positioning, 0.25);
  const d = Object.fromEntries(Object.keys(BA_WEIGHTS).map((k) => [k, { available: true, score: 60 }])) as never;
  assertEquals(computeBrandAlignment(d).score, 60);
});
Deno.test("review connections: carried/exact high confidence, approximate requires review, nothing migrated automatically", () => {
  const rels = [
    { id: "r1", relation_kind: "offering" as const, item_id: "old1", item_label: "Nexus Vision", brand_brain_version: 1 },
    { id: "r2", relation_kind: "problem" as const, item_id: "old2", item_label: "Perdas em lojas físicas", brand_brain_version: 1 },
    { id: "r3", relation_kind: "claim" as const, item_id: "old3", item_label: "Reduz perdas em 30%", brand_brain_version: 1 },
    { id: "r4", relation_kind: "audience" as const, item_id: "old4", item_label: "Varejistas", brand_brain_version: 1 },
    { id: "r5", relation_kind: "offering" as const, item_id: "cur", item_label: "Atual", brand_brain_version: 2 },
  ];
  const cat = [
    { kind: "offering" as const, id: "new1", label: "NEXUS vision" },
    { kind: "problem" as const, id: "new2", label: "Perdas físicas em lojas de rua" },
    { kind: "claim" as const, id: "new3", label: "Outra coisa", carried_from_id: "old3" },
    { kind: "audience" as const, id: "new4", label: "Indústria farmacêutica" },
  ];
  const m = matchOutdatedRelations(rels, 2, cat);
  assertEquals(m.length, 4);
  const by = Object.fromEntries(m.map((x) => [x.relation_id, x]));
  assertEquals(by.r1.match, "exact"); assert(!by.r1.requires_review);
  assertEquals(by.r2.match, "approximate"); assert(by.r2.requires_review);
  assertEquals(by.r3.match, "carried"); assertEquals(by.r3.candidate!.id, "new3");
  assertEquals(by.r4.match, "none"); assertEquals(by.r4.candidate, null);
  assert(labelSimilarity("a b", "c d") === 0);
  assertEquals(rels[0].item_id, "old1"); // input untouched
});
Deno.test("migrate_relations requires explicit confirmation and valid IDs", () => {
  const T = id(100);
  assert(!parseTerritoryAction({ action: "migrate_relations", territory_id: T, migrations: [{ relation_id: id(1), new_item_id: id(2) }] }).ok);
  assert(parseTerritoryAction({ action: "migrate_relations", territory_id: T, confirm: true, migrations: [{ relation_id: id(1), new_item_id: id(2) }] }).ok);
  assert(!parseTerritoryAction({ action: "migrate_relations", territory_id: T, confirm: true, migrations: [{ relation_id: "x", new_item_id: id(2) }] }).ok);
  assert(!parseTerritoryAction({ action: "migrate_relations", territory_id: T, confirm: true, migrations: [] }).ok);
  assert(parseTerritoryAction({ action: "review_connections", territory_id: T }).ok);
});
