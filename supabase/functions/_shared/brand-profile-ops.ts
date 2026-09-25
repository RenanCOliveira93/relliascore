// Brand Profile mutations — pure validation (no I/O). The edge function `brand-profile` applies them
// after verifying ownership. Human input never overwrites observations: extracted rows are kept and a
// user_edit row (supersedes_id → extracted row) or a field override is created instead.

export const ITEM_TABLES = ["brand_offerings", "brand_audiences", "brand_problems", "brand_differentiators", "brand_claims", "brand_evidence", "brand_entities", "brand_positioning", "brand_voice", "brand_visual_identity"] as const;
export type ItemTable = typeof ITEM_TABLES[number];

export const OVERRIDE_FIELDS = ["company_name", "short_description", "long_description", "primary_category", "business_model", "value_proposition", "mission", "target_summary", "tone_summary", "visual_summary", "positioning", "secondary_categories", "geographic_markets", "languages"] as const;
export type OverrideField = typeof OVERRIDE_FIELDS[number];
const LIST_FIELDS: OverrideField[] = ["secondary_categories", "geographic_markets", "languages"];

type Kind = { t: "text"; max: number; required?: boolean } | { t: "list"; max: number } | { t: "enum"; values: readonly string[]; required?: boolean } | { t: "colors" } | { t: "url" };
const T = (max: number, required = false): Kind => ({ t: "text", max, required });
const L = (max = 15): Kind => ({ t: "list", max });
const E = (values: readonly string[], required = true): Kind => ({ t: "enum", values, required });

export const ITEM_SCHEMAS: Record<ItemTable, Record<string, Kind>> = {
  brand_offerings: { name: T(160, true), type: E(["product", "service", "platform", "solution", "other"]), description: T(600), category: T(160), target_audience: T(300), problems_solved: L(), value_proposition: T(600) },
  brand_audiences: { name: T(160, true), audience_type: E(["company", "professional", "consumer", "creator", "institution", "other"]), description: T(600), needs: L(), problems: L(), industries: L(), roles: L() },
  brand_problems: { name: T(160, true), description: T(600), affected_audience: L(), related_offerings: L() },
  brand_differentiators: { statement: T(300, true), category: E(["technology", "methodology", "expertise", "performance", "experience", "integration", "service", "positioning", "other"]) },
  brand_claims: { statement: T(400, true), claim_type: E(["performance", "market", "customer", "technology", "capability", "experience", "certification", "statistic", "positioning", "other"]), verification_status: E(["evidenced", "partially_evidenced", "unevidenced", "unknown"]) },
  brand_evidence: { evidence_type: E(["case_study", "customer", "testimonial", "statistic", "certification", "award", "research", "partnership", "publication", "result", "other"]), title: T(200, true), description: T(600), value: T(120), source_url: { t: "url" } },
  brand_entities: { name: T(160, true), entity_type: E(["organization", "person", "product", "service", "technology", "location", "market", "concept", "customer", "partner", "other"]), relationship: T(120), description: T(300) },
  brand_positioning: { statement: T(400), primary_category: T(160), alternative_categories: L(8), value_proposition: T(600), differentiators: L(10), target_market: T(300) },
  brand_voice: { tone_traits: L(10), communication_style: T(300), vocabulary_preferred: L(), vocabulary_avoided: L(), complexity_level: T(60), formality: T(60), emotional_style: T(120), recurring_phrases: L(10) },
  brand_visual_identity: { primary_colors: { t: "colors" }, secondary_colors: { t: "colors" }, accent_colors: { t: "colors" }, detected_fonts: L(6), logo_url: { t: "url" }, visual_style: T(300), imagery_style: T(300), consistency_notes: T(400) },
};

export type Valid<T> = { ok: true; value: T } | { ok: false; error: string };
const HEX = /^#[0-9a-f]{6}$/i;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanText(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Error("tipo inválido");
  const s = v.trim();
  if (s.length > max) throw new Error(`máximo ${max} caracteres`);
  return s || null;
}
function cleanList(v: unknown, max: number): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error("lista inválida");
  const out = [...new Set((v as string[]).map((s) => s.trim()).filter(Boolean))];
  if (out.length > max || out.some((s) => s.length > 200)) throw new Error("lista grande demais");
  return out;
}
function cleanUrl(v: unknown): string | null {
  const s = cleanText(v, 500);
  if (!s) return null;
  try { const u = new URL(s); if (u.protocol !== "https:" && u.protocol !== "http:") throw 0; return u.toString(); } catch { throw new Error("URL inválida"); }
}
function cleanColors(v: unknown): { hex: string; name: string | null }[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v) || v.length > 8) throw new Error("cores inválidas");
  return v.map((c) => {
    const hex = typeof c?.hex === "string" ? c.hex.trim() : "";
    if (!HEX.test(hex)) throw new Error("cor HEX inválida");
    const name = typeof c?.name === "string" && c.name.trim() ? c.name.trim().slice(0, 60) : null;
    return { hex: hex.toUpperCase(), name };
  });
}

/** Validates user data for an item. partial=true (update) only validates provided keys. Unknown keys are rejected. */
export function validateItem(table: unknown, data: unknown, partial = false): Valid<{ table: ItemTable; values: Record<string, unknown> }> {
  if (!ITEM_TABLES.includes(table as ItemTable)) return { ok: false, error: "Seção inválida." };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "Dados inválidos." };
  const schema = ITEM_SCHEMAS[table as ItemTable];
  const raw = data as Record<string, unknown>;
  for (const k of Object.keys(raw)) if (!(k in schema)) return { ok: false, error: `Campo não permitido: ${k}` };
  const values: Record<string, unknown> = {};
  try {
    for (const [k, kind] of Object.entries(schema)) {
      if (partial && !(k in raw)) continue;
      const v = raw[k];
      if (kind.t === "text") { const s = cleanText(v, kind.max); if (kind.required && !s) throw new Error(`${k} é obrigatório`); values[k] = s; }
      else if (kind.t === "list") values[k] = cleanList(v, kind.max);
      else if (kind.t === "enum") { if (!kind.values.includes(v as string)) { if (kind.required) throw new Error(`${k} inválido`); values[k] = null; } else values[k] = v; }
      else if (kind.t === "colors") values[k] = cleanColors(v);
      else values[k] = cleanUrl(v);
    }
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  if (Object.keys(values).length === 0) return { ok: false, error: "Nada para salvar." };
  return { ok: true, value: { table: table as ItemTable, values } };
}

export function validateField(field: unknown, value: unknown): Valid<{ field: OverrideField; value: string | string[] }> {
  if (!OVERRIDE_FIELDS.includes(field as OverrideField)) return { ok: false, error: "Campo inválido." };
  try {
    if (LIST_FIELDS.includes(field as OverrideField)) return { ok: true, value: { field: field as OverrideField, value: cleanList(value, 10) } };
    const s = cleanText(value, field === "long_description" ? 2000 : 600);
    if (!s) return { ok: false, error: "Informe um valor." };
    return { ok: true, value: { field: field as OverrideField, value: s } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export const RELATIONSHIPS = ["supports", "partially_supports", "contradicts", "related"] as const;

export type Action =
  | { action: "field_set"; brand_brain_id: string; field: OverrideField; value: string | string[] }
  | { action: "field_confirm" | "field_clear"; brand_brain_id: string; field: OverrideField }
  | { action: "item_create"; brand_brain_id: string; table: ItemTable; values: Record<string, unknown> }
  | { action: "item_update"; brand_brain_id: string; table: ItemTable; id: string; values: Record<string, unknown> }
  | { action: "item_confirm" | "item_reject" | "item_reset" | "item_delete"; brand_brain_id: string; table: ItemTable; id: string }
  | { action: "link_add"; brand_brain_id: string; claim_id: string; evidence_id: string; relationship_type: typeof RELATIONSHIPS[number] }
  | { action: "link_remove"; brand_brain_id: string; id: string };

/** Parses the request body into a typed action. Never trusts ownership fields from the body (checked server-side). */
export function parseAction(body: unknown): Valid<Action> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const brain = b.brand_brain_id;
  if (typeof brain !== "string" || !UUID_RE.test(brain)) return { ok: false, error: "Brand Brain inválido." };
  const id = (k: string) => (typeof b[k] === "string" && UUID_RE.test(b[k] as string) ? (b[k] as string) : null);
  switch (b.action) {
    case "field_set": { const v = validateField(b.field, b.value); return v.ok ? { ok: true, value: { action: "field_set", brand_brain_id: brain, ...v.value } } : v; }
    case "field_confirm": case "field_clear":
      if (!OVERRIDE_FIELDS.includes(b.field as OverrideField)) return { ok: false, error: "Campo inválido." };
      return { ok: true, value: { action: b.action, brand_brain_id: brain, field: b.field as OverrideField } };
    case "item_create": { const v = validateItem(b.table, b.data); return v.ok ? { ok: true, value: { action: "item_create", brand_brain_id: brain, ...v.value } } : v; }
    case "item_update": {
      const iid = id("id"); if (!iid) return { ok: false, error: "Item inválido." };
      const v = validateItem(b.table, b.data, true); return v.ok ? { ok: true, value: { action: "item_update", brand_brain_id: brain, id: iid, ...v.value } } : v;
    }
    case "item_confirm": case "item_reject": case "item_reset": case "item_delete": {
      const iid = id("id"); if (!iid || !ITEM_TABLES.includes(b.table as ItemTable)) return { ok: false, error: "Item inválido." };
      return { ok: true, value: { action: b.action, brand_brain_id: brain, table: b.table as ItemTable, id: iid } };
    }
    case "link_add": {
      const c = id("claim_id"), e = id("evidence_id");
      if (!c || !e) return { ok: false, error: "Ligação inválida." };
      const rel = RELATIONSHIPS.includes(b.relationship_type as typeof RELATIONSHIPS[number]) ? b.relationship_type as typeof RELATIONSHIPS[number] : "supports";
      return { ok: true, value: { action: "link_add", brand_brain_id: brain, claim_id: c, evidence_id: e, relationship_type: rel } };
    }
    case "link_remove": { const iid = id("id"); return iid ? { ok: true, value: { action: "link_remove", brand_brain_id: brain, id: iid } } : { ok: false, error: "Ligação inválida." }; }
    default: return { ok: false, error: "Ação inválida." };
  }
}

/** Row for a new human item. User edits of positioning are the company's own statement → declared. */
export function userEditRow(table: ItemTable, values: Record<string, unknown>, brandBrainId: string, supersedesId: string | null): Record<string, unknown> {
  const base: Record<string, unknown> = { ...values, brand_brain_id: brandBrainId, origin: "user_edit", source_type: "user_edit", confidence: 1, explicit_or_inferred: "explicit", evidence: null, sources: [], human_status: "none", supersedes_id: supersedesId };
  if (table === "brand_positioning") base.kind = "declared";
  if (table === "brand_offerings" && !base.type) base.type = "other";
  return base;
}
