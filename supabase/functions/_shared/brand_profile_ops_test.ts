import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseAction, userEditRow, validateField, validateItem } from "./brand-profile-ops.ts";

const B = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";

Deno.test("ops: manual offering validated; unknown/ownership fields rejected", () => {
  const ok = validateItem("brand_offerings", { name: " Sight ", type: "platform", problems_solved: ["Perdas", "Perdas", " "] });
  assert(ok.ok); if (ok.ok) { assertEquals(ok.value.values.name, "Sight"); assertEquals(ok.value.values.problems_solved, ["Perdas"]); }
  assert(!validateItem("brand_offerings", { name: "x", type: "platform", brand_brain_id: B }).ok);
  assert(!validateItem("brand_offerings", { name: "x", type: "platform", origin: "extraction" }).ok);
  assert(!validateItem("brand_offerings", { type: "platform" }).ok);
  assert(!validateItem("brand_offerings", { name: "x", type: "bogus" }).ok);
  assert(!validateItem("auth_users", { name: "x" }).ok);
});

Deno.test("ops: partial update only validates provided keys", () => {
  const v = validateItem("brand_audiences", { description: "Varejistas médios" }, true);
  assert(v.ok); if (v.ok) assertEquals(Object.keys(v.value.values), ["description"]);
  assert(!validateItem("brand_audiences", { name: "" }, true).ok);
});

Deno.test("ops: problem, differentiator, claim, evidence, entity, voice, visual", () => {
  assert(validateItem("brand_problems", { name: "Perdas no varejo", related_offerings: ["Sight"] }).ok);
  assert(validateItem("brand_differentiators", { statement: "Detecção em tempo real", category: "performance" }).ok);
  assert(validateItem("brand_claims", { statement: "Reduz perdas em 30%", claim_type: "statistic", verification_status: "unknown" }).ok);
  assert(validateItem("brand_evidence", { evidence_type: "case_study", title: "Rede X", value: "-30%", source_url: "https://x.com/case" }).ok);
  assert(!validateItem("brand_evidence", { evidence_type: "case_study", title: "Rede X", source_url: "javascript:alert(1)" }).ok);
  assert(validateItem("brand_entities", { name: "Computer Vision", entity_type: "technology" }).ok);
  assert(validateItem("brand_voice", { tone_traits: ["técnico"], formality: "média" }).ok);
  const vis = validateItem("brand_visual_identity", { primary_colors: [{ hex: "#1a2b3c" }] });
  assert(vis.ok); if (vis.ok) assertEquals(vis.value.values.primary_colors, [{ hex: "#1A2B3C", name: null }]);
  assert(!validateItem("brand_visual_identity", { primary_colors: [{ hex: "blue" }] }).ok);
});

Deno.test("ops: field overrides validated", () => {
  assert(validateField("primary_category", "Visão computacional").ok);
  assert(!validateField("primary_category", "   ").ok);
  assert(!validateField("user_id", "x").ok);
  const l = validateField("geographic_markets", ["Brasil", "Brasil", "México"]);
  assert(l.ok); if (l.ok) assertEquals(l.value.value, ["Brasil", "México"]);
});

Deno.test("ops: parseAction covers every action and rejects bad ids", () => {
  assert(parseAction({ action: "field_set", brand_brain_id: B, field: "positioning", value: "x" }).ok);
  assert(parseAction({ action: "field_confirm", brand_brain_id: B, field: "positioning" }).ok);
  assert(parseAction({ action: "item_confirm", brand_brain_id: B, table: "brand_claims", id: I }).ok);
  assert(parseAction({ action: "item_reject", brand_brain_id: B, table: "brand_claims", id: I }).ok);
  assert(parseAction({ action: "item_delete", brand_brain_id: B, table: "brand_claims", id: I }).ok);
  const link = parseAction({ action: "link_add", brand_brain_id: B, claim_id: I, evidence_id: I, relationship_type: "weird" });
  assert(link.ok); if (link.ok && link.value.action === "link_add") assertEquals(link.value.relationship_type, "supports");
  assert(!parseAction({ action: "item_update", brand_brain_id: "x", table: "brand_claims", id: I, data: {} }).ok);
  assert(!parseAction({ action: "drop_table", brand_brain_id: B }).ok);
});

Deno.test("ops: user edit row is human provenance; positioning edits are declared", () => {
  const r = userEditRow("brand_positioning", { statement: "Inteligência de varejo" }, B, I);
  assertEquals(r.origin, "user_edit"); assertEquals(r.source_type, "user_edit"); assertEquals(r.kind, "declared");
  assertEquals(r.supersedes_id, I); assertEquals(r.confidence, 1);
});
