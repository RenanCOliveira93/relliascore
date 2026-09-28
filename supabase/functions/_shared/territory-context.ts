// Territory Context (04B). Builds a compact, traceable snapshot of ONE strategic territory for Territory Alignment.
// The snapshot is persisted on analises.territory_snapshot; history reads only it (never the current territory).
// Pure builder + one loader that re-verifies ownership user → workspace → empresa → territory (active only).
import { territoryReadiness, isUuid, RELATION_KINDS, RELATION_TABLE, type TerritoryReadiness, type TerritoryRelationKind } from "./territories.ts";

export const TERRITORY_CONTEXT_VERSION = "1.0";
export const TERRITORY_CONTEXT_BUDGET = 5000;
const KIND_LIMIT = 8;

export interface TopicRef { id: string; text: string }
export interface TerritoryCtxRelation {
  id: string; relation_id: string; kind: TerritoryRelationKind; label: string; detail: string | null;
  brand_brain_version: number; source_version_outdated: boolean;
}
export interface TerritorySnapshot {
  territory_context_version: string;
  territory_id: string; empresa_id: string; company_name: string | null;
  territory_name: string; territory_type: string; priority: string;
  strategic_intent: string | null; desired_association: string | null; core_concept: string | null; description: string | null;
  target_audience_summary: string | null;
  included_topics: TopicRef[]; excluded_topics: TopicRef[]; related_concepts: TopicRef[];
  relations: TerritoryCtxRelation[];
  readiness: TerritoryReadiness;
  territory_updated_at: string; last_reviewed_brand_brain_version: number | null; active_brand_brain_version: number | null;
  selection: { truncated: boolean; excluded: { id: string; kind: string; reason: "kind_limit" | "budget" }[]; used_chars: number; budget_chars: number };
}

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
export interface TerritoryData {
  territory: Row; company_name: string | null; active_brain_version: number | null;
  relations: Row[]; items: Record<string, Row>; // item_id → brand item row
}

const detailOf = (kind: TerritoryRelationKind, r: Row | undefined): string | null => {
  if (!r) return null;
  const v = kind === "evidence" ? [r.value, r.description].filter(Boolean).join(" — ")
    : kind === "claim" ? r.verification_status
    : kind === "positioning" ? r.value_proposition
    : r.description;
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 240) : null;
};
const topics = (prefix: string, list: unknown): TopicRef[] =>
  (Array.isArray(list) ? list : []).filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, 30).map((text, i) => ({ id: `${prefix}:${i + 1}`, text }));

export function buildTerritoryContext(d: TerritoryData, budget = TERRITORY_CONTEXT_BUDGET): TerritorySnapshot {
  const t = d.territory;
  const excluded: TerritorySnapshot["selection"]["excluded"] = [];
  const perKind: Record<string, number> = {};
  const relations: TerritoryCtxRelation[] = [];
  let used = [t.name, t.core_concept, t.strategic_intent, t.desired_association, t.description].filter(Boolean).join(" ").length;
  // Human-defined relations first, then suggestion-derived; outdated ones last (still usable, lower confidence).
  const ordered = [...d.relations].sort((a, b) => {
    const oa = d.active_brain_version !== null && a.brand_brain_version < d.active_brain_version ? 1 : 0;
    const ob = d.active_brain_version !== null && b.brand_brain_version < d.active_brain_version ? 1 : 0;
    return oa - ob || (a.origin === "user_defined" ? 0 : 1) - (b.origin === "user_defined" ? 0 : 1);
  });
  for (const r of ordered) {
    if (!RELATION_KINDS.includes(r.relation_kind)) continue;
    const kind = r.relation_kind as TerritoryRelationKind;
    if ((perKind[kind] ?? 0) >= KIND_LIMIT) { excluded.push({ id: r.item_id, kind, reason: "kind_limit" }); continue; }
    const item = d.items[r.item_id];
    const rel: TerritoryCtxRelation = {
      id: r.item_id, relation_id: r.id, kind, label: String(r.item_label ?? "").slice(0, 200), detail: detailOf(kind, item),
      brand_brain_version: r.brand_brain_version,
      source_version_outdated: d.active_brain_version !== null && r.brand_brain_version < d.active_brain_version,
    };
    const size = rel.label.length + (rel.detail?.length ?? 0) + 60;
    if (used + size > budget) { excluded.push({ id: r.item_id, kind, reason: "budget" }); continue; }
    used += size; perKind[kind] = (perKind[kind] ?? 0) + 1; relations.push(rel);
  }
  return {
    territory_context_version: TERRITORY_CONTEXT_VERSION,
    territory_id: t.id, empresa_id: t.empresa_id, company_name: d.company_name,
    territory_name: t.name, territory_type: t.territory_type, priority: t.priority,
    strategic_intent: t.strategic_intent ?? null, desired_association: t.desired_association ?? null, core_concept: t.core_concept ?? null,
    description: t.description ?? null, target_audience_summary: t.target_audience_summary ?? null,
    included_topics: topics("topic", t.included_topics), excluded_topics: topics("excluded", t.excluded_topics), related_concepts: topics("concept", t.related_concepts),
    relations, readiness: territoryReadiness(d.relations.map((r) => ({ relation_kind: r.relation_kind }))),
    territory_updated_at: t.updated_at, last_reviewed_brand_brain_version: t.last_reviewed_brand_brain_version ?? null, active_brand_brain_version: d.active_brain_version,
    selection: { truncated: excluded.length > 0, excluded, used_chars: used, budget_chars: budget },
  };
}

/** Every reference the model may cite: field refs, topic refs and related item IDs. Anything else is discarded. */
export function territoryContextIds(s: TerritorySnapshot): Set<string> {
  const ids = new Set<string>(["t:core", "t:intent", "t:association"]);
  for (const l of [s.included_topics, s.excluded_topics, s.related_concepts]) l.forEach((x) => ids.add(x.id));
  s.relations.forEach((r) => ids.add(r.id));
  return ids;
}
export function territoryRefText(s: TerritorySnapshot): Map<string, string> {
  const m = new Map<string, string>();
  if (s.core_concept) m.set("t:core", s.core_concept);
  if (s.strategic_intent) m.set("t:intent", s.strategic_intent);
  if (s.desired_association) m.set("t:association", s.desired_association);
  for (const l of [s.included_topics, s.excluded_topics, s.related_concepts]) l.forEach((x) => m.set(x.id, x.text));
  s.relations.forEach((r) => m.set(r.id, r.label));
  return m;
}

export function renderTerritoryContext(s: TerritorySnapshot): string {
  const L: string[] = [];
  L.push(`Território: ${s.territory_name} (tipo ${s.territory_type}, prioridade ${s.priority})${s.company_name ? ` — marca ${s.company_name}` : ""}`);
  if (s.core_concept) L.push(`[t:core] Conceito central: ${s.core_concept}`);
  if (s.description) L.push(`Descrição: ${s.description}`);
  if (s.strategic_intent) L.push(`[t:intent] Intenção estratégica: ${s.strategic_intent}`);
  if (s.desired_association) L.push(`[t:association] Associação desejada: ${s.desired_association}`);
  if (s.target_audience_summary) L.push(`Público do território: ${s.target_audience_summary}`);
  const tl = (title: string, l: TopicRef[]) => { if (l.length) L.push(`${title}:\n${l.map((x) => `- [${x.id}] ${x.text}`).join("\n")}`); };
  tl("Subtópicos incluídos (conceituais, não keywords)", s.included_topics);
  tl("Fora do território (não são palavras proibidas; só penalize se o conteúdo reposicionar o território nesses conceitos)", s.excluded_topics);
  tl("Conceitos relacionados", s.related_concepts);
  if (s.relations.length) L.push(`Itens da marca ligados ao território:\n${s.relations.map((r) => `- [${r.id}] (${r.kind}) ${r.label}${r.detail ? ` — ${r.detail}` : ""}${r.source_version_outdated ? " (definido numa versão anterior do Brand Profile; menor confiança)" : ""}`).join("\n")}`);
  return L.join("\n");
}

export type TerritoryLoad =
  | { status: "forbidden" } | { status: "archived" }
  | { status: "ok"; data: TerritoryData };

// deno-lint-ignore no-explicit-any
export async function loadTerritory(admin: any, userId: string, workspaceId: string, empresaId: string | null, territoryId: unknown): Promise<TerritoryLoad> {
  if (!empresaId || !isUuid(territoryId)) return { status: "forbidden" };
  const { data: t } = await admin.from("brand_territories").select("*").eq("id", territoryId).eq("empresa_id", empresaId)
    .eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  if (!t) return { status: "forbidden" };
  const { data: ws } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("user_id", userId).maybeSingle();
  if (!ws) return { status: "forbidden" };
  if (t.status !== "active") return { status: "archived" };
  const [{ data: rels }, { data: brains }, { data: emp }] = await Promise.all([
    admin.from("brand_territory_relations").select("*").eq("territory_id", t.id),
    admin.from("brand_brains").select("id, version, is_active, company_name").eq("empresa_id", empresaId).eq("user_id", userId),
    admin.from("empresas").select("nome").eq("id", empresaId).maybeSingle(),
  ]);
  const brainIds = new Set((brains ?? []).map((b: Row) => b.id));
  const active = (brains ?? []).find((b: Row) => b.is_active) ?? null;
  const items: Record<string, Row> = {};
  const byKind: Record<string, string[]> = {};
  for (const r of rels ?? []) (byKind[r.relation_kind] ??= []).push(r.item_id);
  await Promise.all(Object.entries(byKind).map(async ([k, ids]) => {
    const { data } = await admin.from(RELATION_TABLE[k as TerritoryRelationKind]).select("*").in("id", ids);
    for (const row of data ?? []) if (brainIds.has(row.brand_brain_id)) items[row.id] = row;
  }));
  const relations = (rels ?? []).filter((r: Row) => brainIds.has(r.brand_brain_id));
  return { status: "ok", data: { territory: t, company_name: active?.company_name ?? emp?.nome ?? null, active_brain_version: active?.version ?? null, relations, items } };
}
