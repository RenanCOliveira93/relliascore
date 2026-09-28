import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  brainUpdatedSinceReview, parseTerritoryAction, sanitizeSuggestions, slugify, sortTerritories, territoryReadiness, validateTerritory,
  type BrainCatalogItem, type TerritoryRelationKind,
} from "./territories.ts";

const E = "11111111-1111-4111-8111-111111111111";
const T = "22222222-2222-4222-8222-222222222222";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const cat: BrainCatalogItem[] = [
  { kind: "positioning", id: id(1), label: "Plataforma de inteligência para varejo" },
  { kind: "offering", id: id(2), label: "Nexus Vision" },
  { kind: "problem", id: id(3), label: "Perdas em loja" },
  { kind: "audience", id: id(4), label: "Varejistas" },
  { kind: "differentiator", id: id(5), label: "Visão computacional proprietária" },
  { kind: "claim", id: id(6), label: "Reduz perdas em 30%" },
  { kind: "evidence", id: id(7), label: "Case Cliente Y" },
  { kind: "entity", id: id(8), label: "Computer Vision" },
];

Deno.test("manual create: valid, user fields only, slug derived", () => {
  const r = parseTerritoryAction({ action: "create", empresa_id: E, values: { name: "Inteligência de varejo", territory_type: "category", priority: "primary", strategic_intent: "Ser entendida como...", desired_association: "Nexus Sight é..." } });
  assert(r.ok); if (!r.ok) return;
  assertEquals(r.value.action, "create");
  if (r.value.action !== "create") return;
  assertEquals(r.value.empresa_id, E);
  assertEquals(r.value.values.slug, "inteligencia-de-varejo");
  assertEquals(r.value.values.priority, "primary");
  assertEquals(r.value.replace_primary, false);
});
Deno.test("create requires name and valid empresa; rejects origin/workspace/IDs from browser", () => {
  assert(!parseTerritoryAction({ action: "create", empresa_id: E, values: {} }).ok);
  assert(!parseTerritoryAction({ action: "create", empresa_id: "x", values: { name: "A" } }).ok);
  assert(!validateTerritory({ name: "A", origin: "brand_brain_suggestion" }).ok);
  assert(!validateTerritory({ name: "A", workspace_id: E }).ok);
  assert(!validateTerritory({ name: "A", empresa_id: E }).ok);
  assert(!validateTerritory({ name: "A", status: "archived" }).ok); // archive is its own audited action
});
Deno.test("priorities: primary / secondary / exploratory accepted, others rejected", () => {
  for (const p of ["primary", "secondary", "exploratory"]) assert(validateTerritory({ name: "A", priority: p }).ok);
  assert(!validateTerritory({ name: "A", priority: "main" }).ok);
});
Deno.test("replace_primary flag only when explicit true", () => {
  const r = parseTerritoryAction({ action: "update", territory_id: T, values: { priority: "primary" }, replace_primary: true });
  assert(r.ok && r.value.action === "update" && r.value.replace_primary);
  const r2 = parseTerritoryAction({ action: "update", territory_id: T, values: { priority: "primary" }, replace_primary: "yes" });
  assert(r2.ok && r2.value.action === "update" && !r2.value.replace_primary);
});
Deno.test("included / excluded topics / related concepts: trimmed, deduped, optional", () => {
  const r = validateTerritory({ name: "A", included_topics: [" prevenção de perdas ", "Prevenção de perdas", "analytics de loja"], excluded_topics: ["inteligência militar"], related_concepts: ["Retail Analytics", ""] });
  assert(r.ok); if (!r.ok) return;
  assertEquals(r.value.included_topics, ["prevenção de perdas", "analytics de loja"]);
  assertEquals(r.value.excluded_topics, ["inteligência militar"]);
  assertEquals(r.value.related_concepts, ["Retail Analytics"]);
  const noExcl = validateTerritory({ name: "A" });
  assert(noExcl.ok && !("excluded_topics" in noExcl.value));
  assert(!validateTerritory({ name: "A", included_topics: "x" }).ok);
});
Deno.test("archive / restore / review / relations parse", () => {
  for (const action of ["archive", "restore", "mark_reviewed"]) assert(parseTerritoryAction({ action, territory_id: T }).ok);
  for (const kind of ["offering", "problem", "audience", "differentiator", "claim", "evidence", "entity", "positioning"] as TerritoryRelationKind[])
    assert(parseTerritoryAction({ action: "relation_add", territory_id: T, kind, item_id: id(2) }).ok);
  assert(!parseTerritoryAction({ action: "relation_add", territory_id: T, kind: "voice", item_id: id(2) }).ok);
  assert(!parseTerritoryAction({ action: "relation_add", territory_id: T, kind: "claim", item_id: "abc" }).ok);
  assert(parseTerritoryAction({ action: "relation_remove", territory_id: T, relation_id: id(9) }).ok);
  assert(!parseTerritoryAction({ action: "delete", territory_id: T }).ok);
});
Deno.test("suggestions: real IDs kept with catalog labels, invented IDs dropped, unsupported suggestions dropped", () => {
  const raw = { suggestions: [
    { name: "Inteligência de varejo", type: "category", rationale: "r", confidence: 0.8, breadth: "balanced", supporting_brand_items: [id(1), id(2), id(99), "not-an-id", id(2)] },
    { name: "Inventado", type: "concept", rationale: "r", confidence: 0.9, breadth: "broad", supporting_brand_items: [id(98)] },
    { name: "Detecção de furtos por visão computacional", type: "weird", confidence: 7, breadth: "narrow", supporting_brand_items: [id(3), id(5)] },
  ] };
  const s = sanitizeSuggestions(raw, cat);
  assertEquals(s.map((x) => x.name), ["Inteligência de varejo", "Detecção de furtos por visão computacional"]);
  assertEquals(s[0].supporting_brand_items.map((i) => i.id), [id(1), id(2)]);
  assertEquals(s[0].supporting_brand_items[1], { kind: "offering", id: id(2), label: "Nexus Vision" });
  assertEquals(s[1].type, "concept");
  assertEquals(s[1].confidence, 1);
  assertEquals(s[1].breadth, "narrow");
  assert(s.every((x) => x.source === "brand_brain"));
});
Deno.test("suggestions: max 8, no Brand Brain → none", () => {
  const many = { suggestions: Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, type: "concept", breadth: "broad", confidence: 0.5, supporting_brand_items: [id(1)] })) };
  assertEquals(sanitizeSuggestions(many, cat).length, 8);
  assertEquals(sanitizeSuggestions(many, []).length, 0);
  assertEquals(sanitizeSuggestions(null, cat).length, 0);
});
Deno.test("accept_suggestion: shape-checked; browser label/kind is re-derived later", () => {
  const ok = parseTerritoryAction({ action: "accept_suggestion", empresa_id: E, priority: "exploratory", suggestion: { name: "X", type: "problem", breadth: "narrow", confidence: 0.6, supporting_brand_items: [{ kind: "problem", id: id(3), label: "p" }] } });
  assert(ok.ok && ok.value.action === "accept_suggestion" && ok.value.priority === "exploratory");
  const bad = parseTerritoryAction({ action: "accept_suggestion", empresa_id: E, suggestion: { name: "X", supporting_brand_items: [] } });
  assert(!bad.ok);
  // Server re-validation against the active brain: a foreign ID leaves no support → rejected.
  assertEquals(sanitizeSuggestions({ suggestions: [{ name: "X", supporting_brand_items: [id(77)] }] }, cat).length, 0);
});
Deno.test("readiness is a checklist, zero evidence reported", () => {
  const r = territoryReadiness([{ relation_kind: "positioning" }, { relation_kind: "offering" }, { relation_kind: "problem" }, { relation_kind: "audience" }, { relation_kind: "entity" }, { relation_kind: "differentiator" }]);
  assertEquals(r.connected, 4);
  assertEquals(r.label, "4 de 6 fundamentos conectados");
  assertEquals(r.items.find((i) => i.key === "evidence")?.connected, false);
  assertEquals(r.items.find((i) => i.key === "claim")?.connected, false);
  assertEquals(territoryReadiness([]).label, "0 de 6 fundamentos conectados");
});
Deno.test("Brand Brain updated: flagged only, never mutates; null versions safe", () => {
  const t = { last_reviewed_brand_brain_version: 3 };
  assert(brainUpdatedSinceReview(t, 4));
  assert(!brainUpdatedSinceReview(t, 3));
  assert(!brainUpdatedSinceReview(t, null));
  assert(!brainUpdatedSinceReview({ last_reviewed_brand_brain_version: null }, 2));
  assertEquals(t.last_reviewed_brand_brain_version, 3);
});
Deno.test("sort: primary, secondary, exploratory, archived last; slugify", () => {
  const l = sortTerritories([
    { priority: "exploratory" as const, status: "active" as const, created_at: "1" },
    { priority: "primary" as const, status: "archived" as const, created_at: "0" },
    { priority: "secondary" as const, status: "active" as const, created_at: "2" },
    { priority: "primary" as const, status: "active" as const, created_at: "3" },
  ]);
  assertEquals(l.map((x) => `${x.priority}:${x.status}`), ["primary:active", "secondary:active", "exploratory:active", "primary:archived"]);
  assertEquals(slugify("Visão computacional p/ Varejo!"), "visao-computacional-p-varejo");
});
