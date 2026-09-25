// Authenticated Brand Profile mutations. Every write: auth → ownership (brain active, owned, workspace owned)
// → validation → rate limit → mutation → audit log. The browser never gets write privileges on brand_* tables.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, authenticate, checkRateLimits, createLogger, jsonResponse, privateCors } from "../_shared/http.ts";
import { ITEM_SCHEMAS, parseAction, userEditRow, type Action, type ItemTable } from "../_shared/brand-profile-ops.ts";

serve(async (req) => {
  const cors = privateCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const requestId = crypto.randomUUID();
  const log = createLogger("brand-profile", requestId);
  const respond = (status: number, body: Record<string, unknown>) => jsonResponse(cors, status, { ...body, request_id: requestId }, requestId);

  const admin = adminClient();
  if (!admin) return respond(500, { error: "Erro interno." });
  const auth = await authenticate(req);
  if (!auth || auth.kind !== "user") return respond(401, { error: "Não autenticado." });
  const userId = auth.userId;

  let body: unknown;
  try { body = await req.json(); } catch { return respond(400, { error: "JSON inválido." }); }
  const parsed = parseAction(body);
  if (!parsed.ok) return respond(400, { error: parsed.error });
  const a: Action = parsed.value;

  const ok = await checkRateLimits(admin, "brand-profile", [{ key: `user:${userId}`, max: 120, windowSeconds: 60 }], log);
  if (!ok) return respond(429, { error: "Muitas alterações seguidas. Aguarde um instante." });

  // Ownership: active version, owned by the user, in a workspace owned by the user. Historical versions are read-only.
  const { data: brain } = await admin.from("brand_brains").select("*").eq("id", a.brand_brain_id).eq("user_id", userId).maybeSingle();
  if (!brain) return respond(403, { error: "Sem permissão." });
  const { data: ws } = await admin.from("workspaces").select("id").eq("id", brain.workspace_id).eq("user_id", userId).maybeSingle();
  if (!ws) return respond(403, { error: "Sem permissão." });
  if (!brain.is_active) return respond(409, { error: "Versões anteriores são somente leitura." });

  const audit = (action: string, extra: Record<string, unknown>) =>
    admin.from("brand_audit_log").insert({ workspace_id: brain.workspace_id, empresa_id: brain.empresa_id, brand_brain_id: brain.id, user_id: userId, action, request_id: requestId, ...extra });
  const now = new Date().toISOString();

  const loadItem = async (table: ItemTable, id: string) => {
    const { data } = await admin.from(table).select("*").eq("id", id).eq("brand_brain_id", brain.id).maybeSingle();
    return data as Record<string, unknown> | null;
  };

  try {
    switch (a.action) {
      case "field_set": case "field_confirm": {
        const observed = brain[a.field] ?? null;
        const { data: prev } = await admin.from("brand_field_overrides").select("*").eq("brand_brain_id", brain.id).eq("field", a.field).maybeSingle();
        const row = a.action === "field_set"
          ? { brand_brain_id: brain.id, field: a.field, status: "user_edit", value: a.value, observed_value: observed, user_id: userId }
          : { brand_brain_id: brain.id, field: a.field, status: "confirmed", value: observed, observed_value: observed, user_id: userId };
        if (a.action === "field_confirm" && (observed === null || (Array.isArray(observed) && observed.length === 0))) return respond(400, { error: "Não há valor observado para confirmar." });
        const { error } = await admin.from("brand_field_overrides").upsert(row, { onConflict: "brand_brain_id,field" });
        if (error) throw error;
        await audit(a.action, { target_table: "brand_field_overrides", field: a.field, old_value: prev ? { status: prev.status, value: prev.value } : null, new_value: { status: row.status, value: row.value } });
        break;
      }
      case "field_clear": {
        const { data: prev } = await admin.from("brand_field_overrides").delete().eq("brand_brain_id", brain.id).eq("field", a.field).select().maybeSingle();
        await audit("field_clear", { target_table: "brand_field_overrides", field: a.field, old_value: prev ? { status: prev.status, value: prev.value } : null });
        break;
      }
      case "item_create": {
        const { data, error } = await admin.from(a.table).insert(userEditRow(a.table, a.values, brain.id, null)).select("id").single();
        if (error) throw error;
        await audit("item_create", { target_table: a.table, target_id: data.id, new_value: a.values });
        break;
      }
      case "item_update": {
        const item = await loadItem(a.table, a.id);
        if (!item) return respond(404, { error: "Item não encontrado." });
        const editable = Object.keys(ITEM_SCHEMAS[a.table]);
        const before = Object.fromEntries(editable.map((k) => [k, item[k] ?? null]));
        if (item.origin === "user_edit") {
          const { error } = await admin.from(a.table).update(a.values).eq("id", a.id);
          if (error) throw error;
          await audit("item_update", { target_table: a.table, target_id: a.id, old_value: before, new_value: a.values });
        } else {
          // Observation is preserved; the human version supersedes it (updated in place if one already exists).
          const merged = { ...before, ...a.values };
          const { data: existing } = await admin.from(a.table).select("id").eq("brand_brain_id", brain.id).eq("supersedes_id", a.id).eq("origin", "user_edit").maybeSingle();
          if (existing) {
            const { error } = await admin.from(a.table).update(a.values).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await admin.from(a.table).insert(userEditRow(a.table, merged, brain.id, a.id));
            if (error) throw error;
          }
          await audit("item_correct", { target_table: a.table, target_id: a.id, old_value: before, new_value: merged });
        }
        break;
      }
      case "item_confirm": case "item_reject": case "item_reset": {
        const item = await loadItem(a.table, a.id);
        if (!item) return respond(404, { error: "Item não encontrado." });
        if (item.origin !== "extraction") return respond(400, { error: "Só itens identificados pela RELLIA podem ser confirmados ou rejeitados." });
        const status = a.action === "item_confirm" ? "confirmed" : a.action === "item_reject" ? "rejected" : "none";
        const { error } = await admin.from(a.table).update({ human_status: status, reviewed_by: status === "none" ? null : userId, reviewed_at: status === "none" ? null : now }).eq("id", a.id);
        if (error) throw error;
        await audit(a.action, { target_table: a.table, target_id: a.id, old_value: { human_status: item.human_status }, new_value: { human_status: status } });
        break;
      }
      case "item_delete": {
        const item = await loadItem(a.table, a.id);
        if (!item) return respond(404, { error: "Item não encontrado." });
        if (item.origin !== "user_edit") return respond(400, { error: "Itens identificados pela RELLIA não são apagados; use Rejeitar." });
        const { error } = await admin.from(a.table).delete().eq("id", a.id);
        if (error) throw error;
        await audit("item_delete", { target_table: a.table, target_id: a.id, old_value: Object.fromEntries(Object.keys(ITEM_SCHEMAS[a.table]).map((k) => [k, item[k] ?? null])) });
        break;
      }
      case "link_add": {
        const [c, e] = await Promise.all([loadItem("brand_claims", a.claim_id), loadItem("brand_evidence", a.evidence_id)]);
        if (!c || !e) return respond(404, { error: "Afirmação ou evidência não encontrada nesta versão." });
        const { data, error } = await admin.from("brand_claim_evidence").upsert({ brand_brain_id: brain.id, claim_id: a.claim_id, evidence_id: a.evidence_id, relationship_type: a.relationship_type, origin: "user_edit", created_by: userId }, { onConflict: "claim_id,evidence_id" }).select("id").single();
        if (error) throw error;
        await audit("link_add", { target_table: "brand_claim_evidence", target_id: data.id, new_value: { claim_id: a.claim_id, evidence_id: a.evidence_id, relationship_type: a.relationship_type } });
        break;
      }
      case "link_remove": {
        const { data, error } = await admin.from("brand_claim_evidence").delete().eq("id", a.id).eq("brand_brain_id", brain.id).select().maybeSingle();
        if (error) throw error;
        if (!data) return respond(404, { error: "Ligação não encontrada." });
        await audit("link_remove", { target_table: "brand_claim_evidence", target_id: a.id, old_value: { claim_id: data.claim_id, evidence_id: data.evidence_id, relationship_type: data.relationship_type } });
        break;
      }
    }
  } catch (e) {
    log("mutation_failed", { action: a.action, message: String((e as { message?: string })?.message ?? e).slice(0, 200) });
    return respond(500, { error: "Não foi possível salvar. Tente novamente." });
  }
  log("mutation_ok", { action: a.action });
  return respond(200, { ok: true });
});
