// Central Brand Brain precedence rule (pure, dependency-free). Shared by the browser (src/lib/brand-profile.ts
// re-exports it) and the server (brand-context.ts) so there is exactly ONE implementation.
// 1 user_edit / human confirmation, 2 user_description, 3 multiple agreeing observed sources,
// 4 single observed source, 5 inference. Rejected items never count as current knowledge.

export interface PrecedenceSource { source_type: string }
export interface RankedItem {
  id: string; origin: "extraction" | "user_edit"; human_status: "none" | "confirmed" | "rejected";
  source_type: string; explicit_or_inferred: "explicit" | "inferred"; confidence: number;
  sources: PrecedenceSource[]; supersedes_id: string | null;
}
export type KnowledgeStatus = "observed" | "declared" | "inferred" | "user_edit" | "human_confirmed" | "rejected";

export function knowledgeStatus(i: RankedItem): KnowledgeStatus {
  if (i.human_status === "rejected") return "rejected";
  if (i.origin === "user_edit") return "user_edit";
  if (i.human_status === "confirmed") return "human_confirmed";
  if (i.source_type === "user_description") return "declared";
  if (i.explicit_or_inferred === "inferred") return "inferred";
  return "observed";
}

const OBSERVED = new Set(["website", "linkedin", "instagram"]);
export function precedenceRank(i: RankedItem): number {
  const s = knowledgeStatus(i);
  if (s === "rejected") return Number.POSITIVE_INFINITY;
  if (s === "user_edit" || s === "human_confirmed") return 1;
  if (s === "declared") return 2;
  if (s === "inferred") return 5;
  const observedSources = new Set((i.sources ?? []).filter((x) => OBSERVED.has(x.source_type)).map((x) => x.source_type));
  return observedSources.size >= 2 ? 3 : 4;
}

/** Current knowledge: not rejected, not superseded by a human correction; ordered by precedence then confidence. */
export function activeItems<T extends RankedItem>(items: T[]): T[] {
  const superseded = new Set(items.filter((i) => i.origin === "user_edit" && i.supersedes_id).map((i) => i.supersedes_id));
  return items
    .filter((i) => i.human_status !== "rejected" && !superseded.has(i.id))
    .sort((a, b) => precedenceRank(a) - precedenceRank(b) || b.confidence - a.confidence);
}

export const normKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
