import { describe, expect, test } from "bun:test";
import {
  activeItems, comparePositioning, completeness, confidenceLabel, evidenceForClaim, groupDifferentiators, groupEntities,
  knowledgeStatus, precedenceRank, preferredField, rejectedItems, sourceLine, supersededObservation, voicePreview,
} from "../src/lib/brand-profile";
import { formValues, ITEM_FIELDS } from "../src/lib/brand-profile-fields";
import type { BrandBrainVersion, BrandFieldOverride } from "../src/types/brand-brain";

const src = (t: string, extra = {}) => ({ source_type: t, source_url: null, evidence: "e", confidence: 0.8, explicit_or_inferred: "explicit", observed_at: "2026-09-25", ...extra });
let n = 0;
// deno-lint-ignore no-explicit-any
const item = (o: Record<string, any> = {}): any => ({
  id: `i${++n}`, brand_brain_id: "b", origin: "extraction", human_status: "none", source_type: "website", explicit_or_inferred: "explicit",
  confidence: 0.8, sources: [src(o.source_type ?? "website")], supersedes_id: null, carried_from_id: null, reviewed_by: null, reviewed_at: null,
  source_url: null, evidence: "e", observed_at: "2026-09-25", created_at: "", updated_at: "", ...o,
});
const brain = { field_provenance: {}, primary_category: "Visão computacional", secondary_categories: [], positioning: null } as unknown as BrandBrainVersion;

describe("knowledge status & precedence", () => {
  test("statuses", () => {
    expect(knowledgeStatus(item())).toBe("observed");
    expect(knowledgeStatus(item({ source_type: "user_description" }))).toBe("declared");
    expect(knowledgeStatus(item({ explicit_or_inferred: "inferred" }))).toBe("inferred");
    expect(knowledgeStatus(item({ origin: "user_edit", source_type: "user_edit" }))).toBe("user_edit");
    expect(knowledgeStatus(item({ human_status: "confirmed" }))).toBe("human_confirmed");
    expect(knowledgeStatus(item({ human_status: "rejected" }))).toBe("rejected");
  });
  test("precedence order: user_edit < user_description < multi observed < single observed < inference", () => {
    const multi = item({ sources: [src("website"), src("linkedin")] });
    const ranks = [item({ origin: "user_edit" }), item({ source_type: "user_description" }), multi, item(), item({ explicit_or_inferred: "inferred" })].map(precedenceRank);
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
    expect(precedenceRank(item({ human_status: "rejected" }))).toBe(Infinity);
  });
  test("active items: rejected hidden, superseded observation hidden but preserved", () => {
    const obs = item({ name: "Obs" });
    const edit = item({ origin: "user_edit", source_type: "user_edit", supersedes_id: obs.id, name: "Edit" });
    const rej = item({ human_status: "rejected" });
    const inf = item({ explicit_or_inferred: "inferred" });
    const act = activeItems([inf, obs, edit, rej]);
    expect(act.map((i) => i.id)).toEqual([edit.id, inf.id]);
    expect(rejectedItems([obs, rej])).toEqual([rej]);
    expect(supersededObservation([obs, edit], edit)?.id).toBe(obs.id);
  });
});

describe("fields", () => {
  test("user edit wins but observed value kept", () => {
    const o = { field: "primary_category", status: "user_edit", value: "Inteligência de varejo" } as BrandFieldOverride;
    const p = preferredField(brain, [o], "primary_category");
    expect(p.value).toBe("Inteligência de varejo"); expect(p.observed).toBe("Visão computacional"); expect(p.status).toBe("user_edit");
  });
  test("confirmation keeps observed value, marks human", () => {
    const p = preferredField(brain, [{ field: "primary_category", status: "confirmed" } as BrandFieldOverride], "primary_category");
    expect(p.value).toBe("Visão computacional"); expect(p.status).toBe("human_confirmed");
  });
  test("empty", () => { expect(preferredField(brain, [], "positioning").status).toBe("empty"); expect(preferredField(brain, [], "secondary_categories").value).toBeNull(); });
});

describe("positioning declared × observed", () => {
  test("different → gentle message, not error", () => {
    const r = comparePositioning([
      item({ kind: "declared", source_type: "user_description", statement: "Empresa de inteligência de varejo", primary_category: "Inteligência de varejo" }),
      item({ kind: "observed", statement: "Plataforma de visão computacional", primary_category: "Visão computacional" }),
    ]);
    expect(r.verdict).toBe("different");
    expect(r.message).toBe("Existe uma diferença de posicionamento que pode valer a pena revisar.");
  });
  test("consistent only when supported", () => {
    const r = comparePositioning([
      item({ kind: "declared", source_type: "user_description", statement: "x", primary_category: "Visão Computacional" }),
      item({ kind: "observed", statement: "y", primary_category: "visão computacional" }),
    ]);
    expect(r.verdict).toBe("consistent");
  });
  test("insufficient when one side missing; user edit counts as declared", () => {
    expect(comparePositioning([item({ kind: "observed", statement: "a" })]).verdict).toBe("insufficient");
    const r = comparePositioning([item({ kind: "declared", origin: "user_edit", source_type: "user_edit", statement: "a b c" }), item({ kind: "observed", statement: "a b c" })]);
    expect(r.declared?.origin).toBe("user_edit");
  });
});

describe("sections", () => {
  test("claim ↔ evidence by id (not title)", () => {
    const ev = item({ title: "Case Rede X", evidence_type: "case_study" });
    const same = item({ title: "Case Rede X", evidence_type: "case_study" });
    const links = [{ id: "l1", claim_id: "c1", evidence_id: ev.id, relationship_type: "supports" }] as never;
    const r = evidenceForClaim("c1", links, [ev, same]);
    expect(r.length).toBe(1); expect(r[0].evidence.id).toBe(ev.id);
    expect(evidenceForClaim("c2", links, [ev])).toEqual([]);
  });
  test("entities grouped by type; rejected excluded", () => {
    const g = groupEntities([item({ name: "CV", entity_type: "technology" }), item({ name: "Retail", entity_type: "market" }), item({ name: "X", entity_type: "market", human_status: "rejected" })]);
    expect(g.map((x) => [x.type, x.items.length])).toEqual([["technology", 1], ["market", 1]]);
  });
  test("differentiators split declared/observed/inferred", () => {
    const d = groupDifferentiators([item({ statement: "a" }), item({ statement: "b", explicit_or_inferred: "inferred" }), item({ statement: "c", source_type: "user_description" }), item({ statement: "d", origin: "user_edit", source_type: "user_edit" })]);
    expect([d.declared.length, d.observed.length, d.inferred.length]).toEqual([2, 1, 1]);
  });
  test("completeness counts areas, not a brand score", () => {
    const c = completeness({ positioning_items: [item()], offerings: [item()], audiences: [], problems: [], differentiators: [], claims: [item({ human_status: "rejected" })], evidence: [], voice: [item()], visual_identity: [] });
    expect(c.filled).toBe(3); expect(c.label).toBe("3 de 9 áreas possuem informações."); expect(c.label).not.toMatch(/score/i);
  });
  test("source status lines", () => {
    expect(sourceLine({ source: "website", status: "fetched" })).toBe("Site — analisado");
    expect(sourceLine({ source: "linkedin", status: "login_required" })).toBe("LinkedIn — login necessário");
    expect(sourceLine({ source: "instagram", status: "unavailable" })).toBe("Instagram — indisponível");
    expect(sourceLine({ source: "user_description", status: "fetched" })).toBe("Descrição fornecida — analisada");
  });
  test("confidence is an extraction label", () => {
    expect([confidenceLabel(0.9), confidenceLabel(0.5), confidenceLabel(0.2)]).toEqual(["alta", "média", "baixa"]);
  });
  test("voice preview derived from stored data only", () => {
    expect(voicePreview(item({ tone_traits: ["técnico", "direto"], formality: "média", complexity_level: null, recurring_phrases: ["Veja o que acontece"] }))).toBe("Tom técnico, direto · formalidade média. Exemplo recorrente: “Veja o que acontece”.");
    expect(voicePreview(null)).toBeNull();
  });
  test("editor fields per section + prefill", () => {
    expect(ITEM_FIELDS.brand_visual_identity.some((f) => f.kind === "colors")).toBe(true);
    expect(formValues("brand_offerings").type).toBe("other");
    expect(formValues("brand_offerings", { name: "A", type: "platform", problems_solved: ["p"] })).toMatchObject({ name: "A", type: "platform", problems_solved: ["p"] });
  });
});
