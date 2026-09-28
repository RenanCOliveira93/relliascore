import { describe, expect, test } from "bun:test";
import { interpretTerritory, isTerritoryAware, territoryFieldsFromRow, territoryHistoryBadge, territoryRefLabel } from "../src/lib/territory-alignment-view";

const snap = { territory_id: "t1", empresa_id: "e1", territory_name: "IA para varejo", priority: "primary", core_concept: "IA aplicada",
  included_topics: [{ id: "topic:0", text: "previsão de demanda" }], excluded_topics: [], related_concepts: [], relations: [] } as never;

describe("territory alignment view", () => {
  test("legacy rows have no territory fields", () => {
    expect(territoryFieldsFromRow({ score: 70 })).toEqual({});
    expect(territoryHistoryBadge({ score: 70 })).toBeNull();
  });
  test("reopen reads only persisted snapshot and splits coverage", () => {
    const f = territoryFieldsFromRow({ territory_alignment_version: "ta_1.0", territory_snapshot: snap, territory_alignment_score: "62.4",
      territory_alignment_dimensions: { core_relevance: { available: true, score: 70 }, _topic_coverage: { topics_present: ["topic:0"], relevant_topics_missing: [], topics_not_applicable: [] } } });
    expect(f.territory_alignment_score).toBe(62.4);
    expect(f.territory_topic_coverage?.topics_present).toEqual(["topic:0"]);
    expect((f.territory_alignment_dimensions as Record<string, unknown>)._topic_coverage).toBeUndefined();
    expect(isTerritoryAware(f)).toBe(true);
  });
  test("refs resolve from the snapshot", () => {
    expect(territoryRefLabel("topic:0", snap)).toBe("previsão de demanda");
    expect(territoryRefLabel("t:core", snap)).toContain("IA aplicada");
  });
  test("interpretation never averages", () => {
    expect(interpretTerritory(85, 82, 40)).toContain("contribui pouco");
    expect(interpretTerritory(50, null, 85)).toContain("construção");
    expect(interpretTerritory(80, 80, null)).toBeNull();
  });
});
