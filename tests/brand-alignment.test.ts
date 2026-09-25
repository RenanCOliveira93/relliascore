import { describe, expect, it } from "bun:test";
import { rowToResult } from "../src/lib/diagnosis";
import { buildAnalysisPdfV2 } from "../src/lib/generatePdfV2";
import { brandFieldsFromRow, historyBadge, interpretScores, isBrandAware, profileLink, profileSectionFor, unavailableNotes } from "../src/lib/brand-alignment-view";

const snap = {
  brand_context_version: "1.0", brand_brain_id: "b1", brand_brain_version: 3, empresa_id: "e1", company_name: "Nexus Sight",
  primary_category: null, preferred_positioning: { value: "Inteligência de varejo", basis: "human_defined", ref: "field:positioning" }, observed_positioning: null, value_proposition: null,
  offerings: [{ id: "o1", name: "Nexus Loss" }], audiences: [], problems: [{ id: "p1", name: "Perdas", offering_ids: ["o1"] }], differentiators: [], claims: [{ id: "c1", statement: "x" }], evidence: [], entities: [], voice: null,
  selection: { included: [], excluded: [], truncated: false, budget_chars: 6000, used_chars: 100 },
};
const dims = Object.fromEntries(["positioning", "offering", "audience_problem", "differentiation", "claim_evidence", "voice"].map((k) => [k, k === "voice" ? { available: false, score: null, weight: 0.1, reason: "Brand Voice ainda não está definida no Brand Profile. Esta dimensão não entrou no cálculo.", evidence: [], brand_refs: [], confidence: 0.5 } : { available: true, score: 70, weight: 0.2, reason: "ok", evidence: [], brand_refs: [], confidence: 0.8 }]));
const row = {
  id: "a1", score: 82, score_version: "2.0", content_score: 82, empresa_id: "e1", brand_alignment_version: "1.0", brand_alignment_score: 54, brand_alignment_partial: true,
  brand_context_snapshot: snap, brand_alignment_dimensions: dims, brand_alignment_weights_applied: { positioning: 0.2778 },
  brand_strengths: [{ statement: "Reforça categoria", dimension: "positioning", brand_reference: "field:positioning", content_evidence: "inteligência de varejo" }],
  brand_gaps: [{ statement: "Claim nova", gap_type: "unknown_to_brand_profile", dimension: "claim_evidence", brand_reference: null, recommendation: null }],
  brand_recommendations: [{ text: "Confirme a evidência", dimension: "claim_evidence", brand_reference: "c1" }],
};

describe("Brand Alignment UI", () => {
  it("no company → not brand-aware, content-only history unchanged", () => {
    const r = rowToResult({ score: 70, score_version: "2.0", content_score: 70 });
    expect(isBrandAware(r)).toBe(false);
    expect(r.brand_alignment_score).toBeUndefined();
    expect(historyBadge({ score: 70 })).toBeNull();
  });
  it("reopen uses the stored snapshot (not the current Brand Brain)", () => {
    const r = rowToResult(row);
    expect(isBrandAware(r)).toBe(true);
    expect(r.brand_context_snapshot?.brand_brain_version).toBe(3);
    expect(r.brand_alignment_score).toBe(54);
    expect(r.content_score).toBe(82); // independent, never averaged
  });
  it("interpretation never combines scores", () => {
    expect(interpretScores(86, 54)).toContain("apenas parcialmente");
    expect(interpretScores(61, 92)).toContain("representa bem a marca");
    expect(interpretScores(80, null)).toBeNull();
  });
  it("unavailable dimensions are explained", () => {
    expect(unavailableNotes(rowToResult(row))[0]).toContain("Brand Voice");
  });
  it("profile links point to the right section", () => {
    expect(profileSectionFor("o1", snap as never)).toBe("offerings");
    expect(profileSectionFor("p1", snap as never)).toBe("problems");
    expect(profileSectionFor("c1", snap as never)).toBe("claims");
    expect(profileSectionFor("field:positioning", snap as never)).toBe("positioning");
    expect(profileLink("e1", "claims")).toBe("/empresas/e1/brand#claims");
  });
  it("history badge", () => {
    expect(historyBadge(row)).toEqual({ company: "Nexus Sight", score: 54 });
    expect(brandFieldsFromRow({ brand_alignment_version: "1.0" })).toEqual({});
  });
  it("PDF includes the brand section only for brand-aware analyses", () => {
    const txt = (r: any) => (buildAnalysisPdfV2(r, "https://x.com", "q", "business").doc as any).internal.pages.flat().join(" ");
    expect(txt(rowToResult(row))).toContain("Alinhamento com a Marca");
    expect(txt(rowToResult({ ...row, brand_alignment_version: null }))).not.toContain("Alinhamento com a Marca");
  });
});
