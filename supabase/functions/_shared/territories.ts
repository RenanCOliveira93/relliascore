// Strategic Territories (04A) — pure, dependency-free. Types, validation, suggestion sanitizing and the
// readiness checklist. Used by the `territories` edge function and re-exported to the UI by src/lib/territories.ts.
// No scores live here: readiness is a checklist of connected foundations, never a grade.

export const TERRITORY_TYPES = ["category", "problem", "solution", "expertise", "technology", "market", "concept", "other"] as const;
export const TERRITORY_PRIORITIES = ["primary", "secondary", "exploratory"] as const;
export const TERRITORY_STATUSES = ["draft", "active", "archived"] as const;
export const TERRITORY_ORIGINS = ["user_defined", "brand_brain_suggestion"] as const;
export const TERRITORY_BREADTHS = ["broad", "balanced", "narrow"] as const;
export const RELATION_KINDS = ["positioning", "offering", "problem", "audience", "differentiator", "claim", "evidence", "entity"] as const;

export type TerritoryType = typeof TERRITORY_TYPES[number];
export type TerritoryPriority = typeof TERRITORY_PRIORITIES[number];
export type TerritoryStatus = typeof TERRITORY_STATUSES[number];
export type TerritoryOrigin = typeof TERRITORY_ORIGINS[number];
export type TerritoryBreadth = typeof TERRITORY_BREADTHS[number];
export type TerritoryRelationKind = typeof RELATION_KINDS[number];

export const RELATION_TABLE: Record<TerritoryRelationKind, string> = {
  positioning: "brand_positioning", offering: "brand_offerings", problem: "brand_problems", audience: "brand_audiences",
  differentiator: "brand_differentiators", claim: "brand_claims", evidence: "brand_evidence", entity: "brand_entities",
};

export interface TerritoryDefinition {
  core_concept: string | null;
  description: string | null;
  included_topics: string[];
  excluded_topics: string[];
  related_concepts: string[];
}

export interface StrategicTerritory extends TerritoryDefinition {
  id: string; workspace_id: string; empresa_id: string; user_id: string;
  name: string; slug: string; territory_type: TerritoryType; status: TerritoryStatus; priority: TerritoryPriority;
  strategic_intent: string | null; target_audience_summary: string | null; desired_association: string | null;
  origin: TerritoryOrigin; source_brand_brain_id: string | null; source_brand_brain_version: number | null;
  suggestion_confidence: number | null; suggestion_rationale: string | null; suggestion_breadth: TerritoryBreadth | null;
  last_reviewed_brand_brain_id: string | null; last_reviewed_brand_brain_version: number | null;
  created_by: string; created_at: string; updated_at: string; archived_at: string | null;
}

export interface TerritoryRelation {
  id: string; territory_id: string; relation_kind: TerritoryRelationKind; item_id: string;
  brand_brain_id: string; brand_brain_version: number; item_label: string; origin: TerritoryOrigin; created_at: string;
}

export interface SupportingItem { kind: TerritoryRelationKind; id: string; label: string }
export interface TerritorySuggestion {
  name: string; type: TerritoryType; rationale: string; supporting_brand_items: SupportingItem[];
  confidence: number; breadth: TerritoryBreadth; source: "brand_brain";
}

export interface ReadinessItem { key: TerritoryRelationKind; label: string; connected: boolean }
export interface TerritoryReadiness { items: ReadinessItem[]; connected: number; total: number; label: string }

export type TerritoryAuditAction = "created" | "edited" | "priority_changed" | "archived" | "restored" | "relation_added" | "relation_removed" | "suggestion_accepted" | "reviewed";
export interface TerritoryAuditEvent {
  id: string; action: TerritoryAuditAction; user_id: string; created_at: string;
  target_id: string | null; old_value: unknown; new_value: unknown;
}

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "territorio";

// ---------- field validation ----------
type FieldKind = { t: "text"; max: number; required?: boolean } | { t: "list"; max: number } | { t: "enum"; values: readonly string[] };
export const TERRITORY_FIELDS: Record<string, FieldKind> = {
  name: { t: "text", max: 120, required: true },
  description: { t: "text", max: 1000 },
  territory_type: { t: "enum", values: TERRITORY_TYPES },
  priority: { t: "enum", values: TERRITORY_PRIORITIES },
  status: { t: "enum", values: ["draft", "active"] },
  strategic_intent: { t: "text", max: 1000 },
  target_audience_summary: { t: "text", max: 500 },
  desired_association: { t: "text", max: 500 },
  core_concept: { t: "text", max: 300 },
  included_topics: { t: "list", max: 30 },
  excluded_topics: { t: "list", max: 30 },
  related_concepts: { t: "list", max: 30 },
};
export type TerritoryValues = Partial<Omit<StrategicTerritory, "id">>;

/** partial=true validates only provided keys (edit). Unknown keys are rejected — the browser can't set origin, IDs, etc. */
export function validateTerritory(data: unknown, partial = false): Valid<Record<string, unknown>> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "Dados inválidos." };
  const raw = data as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (!(k in TERRITORY_FIELDS)) return { ok: false, error: `Campo não permitido: ${k}` };
  const out: Record<string, unknown> = {};
  for (const [k, kind] of Object.entries(TERRITORY_FIELDS)) {
    if (!(k in raw)) { if (!partial && kind.t === "text" && kind.required) return { ok: false, error: `${k} é obrigatório` }; continue; }
    const v = raw[k];
    if (kind.t === "text") {
      if (v !== null && v !== undefined && typeof v !== "string") return { ok: false, error: `${k} inválido` };
      const s = typeof v === "string" ? v.trim() : "";
      if (s.length > kind.max) return { ok: false, error: `${k}: máximo ${kind.max} caracteres` };
      if (kind.required && !s) return { ok: false, error: "O nome do território é obrigatório." };
      out[k] = s || null;
    } else if (kind.t === "list") {
      if (v === null || v === undefined) { out[k] = []; continue; }
      if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) return { ok: false, error: `${k} inválido` };
      const seen = new Set<string>(); const list: string[] = [];
      for (const s of (v as string[]).map((x) => x.trim()).filter(Boolean)) { const key = s.toLowerCase(); if (!seen.has(key)) { seen.add(key); list.push(s); } }
      if (list.length > kind.max || list.some((s) => s.length > 160)) return { ok: false, error: `${k}: lista grande demais` };
      out[k] = list;
    } else {
      if (!kind.values.includes(v as string)) return { ok: false, error: `${k} inválido` };
      out[k] = v;
    }
  }
  if (typeof out.name === "string") out.slug = slugify(out.name);
  return { ok: true, value: out };
}

// ---------- actions ----------
export type TerritoryAction =
  | { action: "create"; empresa_id: string; values: Record<string, unknown>; replace_primary: boolean }
  | { action: "update"; territory_id: string; values: Record<string, unknown>; replace_primary: boolean }
  | { action: "archive" | "restore" | "mark_reviewed"; territory_id: string }
  | { action: "relation_add"; territory_id: string; kind: TerritoryRelationKind; item_id: string }
  | { action: "relation_remove"; territory_id: string; relation_id: string }
  | { action: "suggest"; empresa_id: string }
  | { action: "accept_suggestion"; empresa_id: string; suggestion: TerritorySuggestion; priority: TerritoryPriority; replace_primary: boolean };

export function parseTerritoryAction(body: unknown): Valid<TerritoryAction> {
  if (!body || typeof body !== "object") return { ok: false, error: "Dados inválidos." };
  const b = body as Record<string, unknown>;
  const rp = b.replace_primary === true;
  switch (b.action) {
    case "create": {
      if (!isUuid(b.empresa_id)) return { ok: false, error: "Empresa inválida." };
      const v = validateTerritory(b.values); if (!v.ok) return v;
      return { ok: true, value: { action: "create", empresa_id: b.empresa_id, values: v.value, replace_primary: rp } };
    }
    case "update": {
      if (!isUuid(b.territory_id)) return { ok: false, error: "Território inválido." };
      const v = validateTerritory(b.values, true); if (!v.ok) return v;
      if (Object.keys(v.value).length === 0) return { ok: false, error: "Nada para alterar." };
      return { ok: true, value: { action: "update", territory_id: b.territory_id, values: v.value, replace_primary: rp } };
    }
    case "archive": case "restore": case "mark_reviewed":
      if (!isUuid(b.territory_id)) return { ok: false, error: "Território inválido." };
      return { ok: true, value: { action: b.action, territory_id: b.territory_id } };
    case "relation_add":
      if (!isUuid(b.territory_id) || !isUuid(b.item_id)) return { ok: false, error: "Relação inválida." };
      if (!RELATION_KINDS.includes(b.kind as TerritoryRelationKind)) return { ok: false, error: "Tipo de relação inválido." };
      return { ok: true, value: { action: "relation_add", territory_id: b.territory_id, kind: b.kind as TerritoryRelationKind, item_id: b.item_id } };
    case "relation_remove":
      if (!isUuid(b.territory_id) || !isUuid(b.relation_id)) return { ok: false, error: "Relação inválida." };
      return { ok: true, value: { action: "relation_remove", territory_id: b.territory_id, relation_id: b.relation_id } };
    case "suggest":
      if (!isUuid(b.empresa_id)) return { ok: false, error: "Empresa inválida." };
      return { ok: true, value: { action: "suggest", empresa_id: b.empresa_id } };
    case "accept_suggestion": {
      if (!isUuid(b.empresa_id)) return { ok: false, error: "Empresa inválida." };
      const s = b.suggestion as Record<string, unknown> | undefined;
      if (!s || typeof s !== "object") return { ok: false, error: "Sugestão inválida." };
      const priority = (TERRITORY_PRIORITIES.includes(b.priority as TerritoryPriority) ? b.priority : "secondary") as TerritoryPriority;
      // The browser's copy is untrusted: shape-check here, IDs are re-validated against the active Brand Brain server-side.
      const [clean] = sanitizeSuggestions({ suggestions: [s] }, null);
      if (!clean) return { ok: false, error: "Sugestão inválida." };
      return { ok: true, value: { action: "accept_suggestion", empresa_id: b.empresa_id, suggestion: clean, priority, replace_primary: rp } };
    }
    default: return { ok: false, error: "Ação inválida." };
  }
}

// ---------- suggestions ----------
export interface BrainCatalogItem { kind: TerritoryRelationKind; id: string; label: string }

/**
 * Sanitizes model (or browser) suggestions. With a catalog, supporting items whose IDs are not in the active
 * Brand Brain are dropped, labels come from the catalog (never from the model), and suggestions left without any
 * real support are discarded. catalog=null only shape-checks (used before the server re-validation).
 */
export function sanitizeSuggestions(raw: unknown, catalog: BrainCatalogItem[] | null, max = 8): TerritorySuggestion[] {
  const list = (raw as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(list)) return [];
  const byId = catalog ? new Map(catalog.map((c) => [c.id, c])) : null;
  const out: TerritorySuggestion[] = []; const names = new Set<string>();
  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
    if (!name || names.has(name.toLowerCase())) continue;
    const type = TERRITORY_TYPES.includes(r.type as TerritoryType) ? r.type as TerritoryType : "concept";
    const breadth = TERRITORY_BREADTHS.includes(r.breadth as TerritoryBreadth) ? r.breadth as TerritoryBreadth : "balanced";
    const confidence = typeof r.confidence === "number" && Number.isFinite(r.confidence) ? Math.min(1, Math.max(0, r.confidence)) : 0.5;
    const rationale = typeof r.rationale === "string" ? r.rationale.trim().slice(0, 600) : "";
    const items: SupportingItem[] = []; const seen = new Set<string>();
    for (const it of Array.isArray(r.supporting_brand_items) ? r.supporting_brand_items : []) {
      const id = typeof it === "string" ? it : (it as Record<string, unknown>)?.id;
      if (!isUuid(id) || seen.has(id)) continue;
      if (byId) {
        const c = byId.get(id); if (!c) continue; // invented ID → dropped
        items.push({ kind: c.kind, id: c.id, label: c.label });
      } else {
        const o = it as Record<string, unknown>;
        if (!RELATION_KINDS.includes(o?.kind as TerritoryRelationKind)) continue;
        items.push({ kind: o.kind as TerritoryRelationKind, id, label: typeof o.label === "string" ? o.label.slice(0, 200) : "" });
      }
      seen.add(id);
    }
    if (items.length === 0) continue;
    names.add(name.toLowerCase());
    out.push({ name, type, rationale, supporting_brand_items: items.slice(0, 12), confidence, breadth, source: "brand_brain" });
    if (out.length >= max) break;
  }
  return out;
}

// ---------- readiness (checklist, not a score) ----------
export const READINESS_KEYS: { key: TerritoryRelationKind; label: string }[] = [
  { key: "positioning", label: "Posicionamento relacionado" },
  { key: "offering", label: "Produto/serviço relacionado" },
  { key: "problem", label: "Problema relacionado" },
  { key: "audience", label: "Público relacionado" },
  { key: "claim", label: "Claim relacionado" },
  { key: "evidence", label: "Evidência relacionada" },
];

export function territoryReadiness(relations: Pick<TerritoryRelation, "relation_kind">[]): TerritoryReadiness {
  const kinds = new Set(relations.map((r) => r.relation_kind));
  const items = READINESS_KEYS.map((k) => ({ ...k, connected: kinds.has(k.key) }));
  const connected = items.filter((i) => i.connected).length;
  return { items, connected, total: items.length, label: `${connected} de ${items.length} fundamentos conectados` };
}

/** True when the active Brand Brain is newer than the one the territory was last reviewed against. Never changes the territory. */
export function brainUpdatedSinceReview(t: Pick<StrategicTerritory, "last_reviewed_brand_brain_version">, activeVersion: number | null): boolean {
  return activeVersion !== null && t.last_reviewed_brand_brain_version !== null && activeVersion > t.last_reviewed_brand_brain_version;
}

export const PRIORITY_ORDER: Record<TerritoryPriority, number> = { primary: 0, secondary: 1, exploratory: 2 };
export function sortTerritories<T extends Pick<StrategicTerritory, "priority" | "created_at" | "status">>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.status === "archived" ? 1 : 0) - (b.status === "archived" ? 1 : 0) || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at));
}
