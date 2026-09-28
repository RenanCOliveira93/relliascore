import { describe, expect, test } from "bun:test";
import { BREADTH_LABEL, KIND_LABEL, PRIORITY_LABEL, TYPE_LABEL, brainUpdatedSinceReview, splitList, territoryReadiness, TERRITORY_TYPES, RELATION_KINDS } from "../src/lib/territories";

describe("territories UI helpers", () => {
  test("labels cover every type, priority, breadth and relation", () => {
    for (const t of TERRITORY_TYPES) expect(TYPE_LABEL[t]).toBeTruthy();
    for (const k of RELATION_KINDS) expect(KIND_LABEL[k]).toBeTruthy();
    expect(PRIORITY_LABEL.primary).toBe("Primário");
    expect(BREADTH_LABEL.balanced).toBe("Equilibrada");
  });
  test("topics input split by line/comma", () => {
    expect(splitList("visão computacional no varejo\nprevenção de perdas, analytics\n\n")).toEqual(["visão computacional no varejo", "prevenção de perdas", "analytics"]);
  });
  test("readiness is a checklist label, never a percentage", () => {
    const r = territoryReadiness([{ relation_kind: "offering" }, { relation_kind: "claim" }]);
    expect(r.label).toBe("2 de 6 fundamentos conectados");
    expect(r.label).not.toContain("%");
  });
  test("stale notice only when the active brain is newer", () => {
    expect(brainUpdatedSinceReview({ last_reviewed_brand_brain_version: 2 }, 3)).toBe(true);
    expect(brainUpdatedSinceReview({ last_reviewed_brand_brain_version: 3 }, 3)).toBe(false);
  });
});
