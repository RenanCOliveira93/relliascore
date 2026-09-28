// Strategic Territories mutations + Brand Brain suggestions. Every call: auth → ownership (user → workspace →
// empresa → territory) → validation → rate limit → mutation → brand_audit_log. The browser only has read access.
// Nothing here computes a score.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, authenticate, checkRateLimits, createLogger, jsonResponse, privateCors } from "../_shared/http.ts";
import { activeItems, type RankedItem } from "../_shared/brand-precedence.ts";
import { extractToolArguments } from "../_shared/model-parse.ts";
import {
  parseTerritoryAction, RELATION_KINDS, RELATION_TABLE, sanitizeSuggestions, TERRITORY_BREADTHS, TERRITORY_TYPES,
  type BrainCatalogItem, type TerritoryAction, type TerritoryRelationKind,
} from "../_shared/territories.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const labelOf = (kind: TerritoryRelationKind, r: Row): string =>
  String((kind === "positioning" ? r.statement ?? r.primary_category : kind === "differentiator" || kind === "claim" ? r.statement : kind === "evidence" ? r.title : r.name) ?? "—").slice(0, 200);

serve(async (req) => {
  const cors = privateCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const requestId = crypto.randomUUID();
  const log = createLogger("territories", requestId);
  const respond = (status: number, body: Record<string, unknown>) => jsonResponse(cors, status, { ...body, request_id: requestId }, requestId);

  const admin = adminClient();
  if (!admin) return respond(500, { error: "Erro interno." });
  const auth = await authenticate(req);
  if (!auth || auth.kind !== "user") return respond(401, { error: "Não autenticado." });
  const userId = auth.userId;

  let body: unknown;
  try { body = await req.json(); } catch { return respond(400, { error: "JSON inválido." }); }
  const parsed = parseTerritoryAction(body);
  if (!parsed.ok) return respond(400, { error: parsed.error });
  const a: TerritoryAction = parsed.value;

  const rules = a.action === "suggest" ? [{ key: `user:${userId}`, max: 10, windowSeconds: 60 }] : [{ key: `user:${userId}`, max: 120, windowSeconds: 60 }];
  if (!(await checkRateLimits(admin, a.action === "suggest" ? "territories-suggest" : "territories", rules, log))) return respond(429, { error: "Muitas ações seguidas. Aguarde um instante." });

  // ---- ownership ----
  const ownEmpresa = async (empresaId: string): Promise<Row | null> => {
    const { data: emp } = await admin.from("empresas").select("id, nome, workspace_id, user_id").eq("id", empresaId).eq("user_id", userId).maybeSingle();
    if (!emp) return null;
    const { data: ws } = await admin.from("workspaces").select("id").eq("id", emp.workspace_id).eq("user_id", userId).maybeSingle();
    return ws ? emp : null;
  };
  let territory: Row | null = null;
  let empresa: Row | null = null;
  if ("territory_id" in a) {
    const { data } = await admin.from("brand_territories").select("*").eq("id", a.territory_id).eq("user_id", userId).maybeSingle();
    if (!data) return respond(403, { error: "Sem permissão." });
    empresa = await ownEmpresa(data.empresa_id);
    if (!empresa || empresa.workspace_id !== data.workspace_id) return respond(403, { error: "Sem permissão." });
    territory = data;
  } else {
    empresa = await ownEmpresa(a.empresa_id);
    if (!empresa) return respond(403, { error: "Sem permissão." });
  }
  const emp = empresa;

  const activeBrain = async (): Promise<Row | null> => {
    const { data } = await admin.from("brand_brains").select("id, version, company_name, primary_category, positioning, value_proposition")
      .eq("empresa_id", emp.id).eq("user_id", userId).eq("workspace_id", emp.workspace_id).eq("is_active", true).maybeSingle();
    return data;
  };
  const catalog = async (brainId: string): Promise<BrainCatalogItem[]> => {
    const lists = await Promise.all(RELATION_KINDS.map((k) => admin.from(RELATION_TABLE[k]).select("*").eq("brand_brain_id", brainId).then((r: { data: Row[] | null }) => r.data ?? [])));
    return RELATION_KINDS.flatMap((k, i) => activeItems(lists[i] as unknown as RankedItem[]).map((r) => ({ kind: k, id: (r as unknown as Row).id, label: labelOf(k, r as unknown as Row) })));
  };
  const audit = (action: string, targetId: string | null, oldValue: unknown, newValue: unknown, brainId: string | null = null) =>
    admin.from("brand_audit_log").insert({ workspace_id: emp.workspace_id, empresa_id: emp.id, brand_brain_id: brainId, user_id: userId, action: `territory_${action}`, target_table: "brand_territories", target_id: targetId, old_value: oldValue, new_value: newValue, request_id: requestId });
  const currentPrimary = async (exceptId: string | null) => {
    let q = admin.from("brand_territories").select("id, name").eq("empresa_id", emp.id).eq("priority", "primary").neq("status", "archived");
    if (exceptId) q = q.neq("id", exceptId);
    const { data } = await q.maybeSingle();
    return data as { id: string; name: string } | null;
  };
  const conflict = (p: { id: string; name: string }) => respond(409, { error: "primary_conflict", conflict: p });
  const isDup = (e: unknown) => (e as { code?: string })?.code === "23505";

  try {
    switch (a.action) {
      case "create": case "accept_suggestion": {
        const wantPrimary = a.action === "create" ? a.values.priority === "primary" : a.priority === "primary";
        if (wantPrimary && !a.replace_primary) { const p = await currentPrimary(null); if (p) return conflict(p); }
        const brain = await activeBrain();
        let row: Row; let supporting: BrainCatalogItem[] = [];
        if (a.action === "create") {
          row = { ...a.values, origin: "user_defined" };
        } else {
          if (!brain) return respond(409, { error: "Esta empresa ainda não tem Brand Brain." });
          // Re-validate every supporting ID against the ACTIVE Brand Brain; invented/foreign IDs are dropped.
          const [s] = sanitizeSuggestions({ suggestions: [a.suggestion] }, await catalog(brain.id));
          if (!s) return respond(400, { error: "A sugestão não corresponde ao Brand Brain atual." });
          supporting = s.supporting_brand_items;
          row = { name: s.name, slug: (await import("../_shared/territories.ts")).slugify(s.name), territory_type: s.type, origin: "brand_brain_suggestion",
            source_brand_brain_id: brain.id, source_brand_brain_version: brain.version, suggestion_confidence: s.confidence, suggestion_rationale: s.rationale || null, suggestion_breadth: s.breadth };
        }
        const priority = a.action === "create" ? (a.values.priority ?? "secondary") : a.priority;
        const insert = { ...row, priority: priority === "primary" ? "secondary" : priority, status: row.status ?? "active", workspace_id: emp.workspace_id, empresa_id: emp.id, user_id: userId, created_by: userId,
          last_reviewed_brand_brain_id: brain?.id ?? null, last_reviewed_brand_brain_version: brain?.version ?? null };
        const { data, error } = await admin.from("brand_territories").insert(insert).select("*").single();
        if (error) { if (isDup(error)) return respond(409, { error: "Já existe um território ativo com esse nome." }); throw error; }
        if (priority === "primary") { const { error: pe } = await admin.rpc("bt_set_priority", { p_territory: data.id, p_priority: "primary" }); if (pe) throw pe; }
        if (supporting.length && brain) {
          const rels = supporting.map((s) => ({ territory_id: data.id, workspace_id: emp.workspace_id, empresa_id: emp.id, user_id: userId, relation_kind: s.kind, item_id: s.id, brand_brain_id: brain.id, brand_brain_version: brain.version, item_label: s.label, origin: "brand_brain_suggestion", created_by: userId }));
          const { error: re } = await admin.from("brand_territory_relations").insert(rels);
          if (re) throw re;
        }
        await audit(a.action === "create" ? "created" : "suggestion_accepted", data.id, null, { ...insert, priority, supporting_brand_items: supporting.map((s) => s.id) }, brain?.id ?? null);
        return respond(200, { ok: true, territory_id: data.id });
      }
      case "update": {
        const t = territory!;
        if (t.status === "archived") return respond(409, { error: "Restaure o território antes de editar." });
        const { priority, ...rest } = a.values as Row;
        if (priority === "primary" && t.priority !== "primary" && !a.replace_primary) { const p = await currentPrimary(t.id); if (p) return conflict(p); }
        const before = Object.fromEntries(Object.keys(a.values).map((k) => [k, t[k] ?? null]));
        if (Object.keys(rest).length) {
          const { error } = await admin.from("brand_territories").update(rest).eq("id", t.id);
          if (error) { if (isDup(error)) return respond(409, { error: "Já existe um território ativo com esse nome." }); throw error; }
          await audit("edited", t.id, Object.fromEntries(Object.keys(rest).map((k) => [k, t[k] ?? null])), rest);
        }
        if (priority && priority !== t.priority) {
          const { data: prev, error } = await admin.rpc("bt_set_priority", { p_territory: t.id, p_priority: priority });
          if (error) throw error;
          await audit("priority_changed", t.id, { priority: t.priority }, { priority, demoted_territory_id: prev ?? null });
        }
        void before;
        return respond(200, { ok: true });
      }
      case "archive": {
        const t = territory!;
        if (t.status === "archived") return respond(200, { ok: true });
        const { error } = await admin.from("brand_territories").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", t.id);
        if (error) throw error;
        await audit("archived", t.id, { status: t.status }, { status: "archived" });
        return respond(200, { ok: true });
      }
      case "restore": {
        const t = territory!;
        if (t.status !== "archived") return respond(200, { ok: true });
        // Restoring never steals the primary slot: a restored primary comes back as secondary if another is active.
        const priority = t.priority === "primary" && (await currentPrimary(t.id)) ? "secondary" : t.priority;
        const { error } = await admin.from("brand_territories").update({ status: "active", archived_at: null, priority }).eq("id", t.id);
        if (error) { if (isDup(error)) return respond(409, { error: "Já existe um território ativo com esse nome." }); throw error; }
        await audit("restored", t.id, { status: "archived", priority: t.priority }, { status: "active", priority });
        return respond(200, { ok: true });
      }
      case "mark_reviewed": {
        const brain = await activeBrain();
        if (!brain) return respond(409, { error: "Esta empresa ainda não tem Brand Brain." });
        const { error } = await admin.from("brand_territories").update({ last_reviewed_brand_brain_id: brain.id, last_reviewed_brand_brain_version: brain.version }).eq("id", territory!.id);
        if (error) throw error;
        await audit("reviewed", territory!.id, { version: territory!.last_reviewed_brand_brain_version }, { version: brain.version }, brain.id);
        return respond(200, { ok: true });
      }
      case "relation_add": {
        const t = territory!;
        const brain = await activeBrain();
        if (!brain) return respond(409, { error: "Esta empresa ainda não tem Brand Brain." });
        // The item must belong to the ACTIVE Brand Brain of THIS empresa (never trust a raw ID from the browser).
        const { data: item } = await admin.from(RELATION_TABLE[a.kind]).select("*").eq("id", a.item_id).eq("brand_brain_id", brain.id).maybeSingle();
        if (!item) return respond(404, { error: "Item não encontrado no Brand Brain ativo." });
        const rel = { territory_id: t.id, workspace_id: emp.workspace_id, empresa_id: emp.id, user_id: userId, relation_kind: a.kind, item_id: a.item_id, brand_brain_id: brain.id, brand_brain_version: brain.version, item_label: labelOf(a.kind, item), origin: "user_defined", created_by: userId };
        const { data, error } = await admin.from("brand_territory_relations").upsert(rel, { onConflict: "territory_id,relation_kind,item_id", ignoreDuplicates: true }).select("id").maybeSingle();
        if (error) throw error;
        await audit("relation_added", t.id, null, { relation_id: data?.id ?? null, kind: a.kind, item_id: a.item_id, label: rel.item_label }, brain.id);
        return respond(200, { ok: true });
      }
      case "relation_remove": {
        const { data, error } = await admin.from("brand_territory_relations").delete().eq("id", a.relation_id).eq("territory_id", territory!.id).select().maybeSingle();
        if (error) throw error;
        if (!data) return respond(404, { error: "Relação não encontrada." });
        await audit("relation_removed", territory!.id, { relation_id: data.id, kind: data.relation_kind, item_id: data.item_id, label: data.item_label }, null, data.brand_brain_id);
        return respond(200, { ok: true });
      }
      case "suggest": {
        const brain = await activeBrain();
        if (!brain) return respond(200, { ok: true, suggestions: [], brand_brain: null });
        const cat = await catalog(brain.id);
        if (cat.length === 0) return respond(200, { ok: true, suggestions: [], brand_brain: { id: brain.id, version: brain.version } });
        const key = Deno.env.get("LOVABLE_API_KEY");
        if (!key) return respond(500, { error: "Erro interno." });
        const lines = cat.slice(0, 120).map((c) => `[${c.id}] (${c.kind}) ${c.label}`).join("\n");
        const ctx = [brain.company_name && `Empresa: ${brain.company_name}`, brain.primary_category && `Categoria: ${brain.primary_category}`, brain.positioning && `Posicionamento: ${brain.positioning}`, brain.value_proposition && `Proposta de valor: ${brain.value_proposition}`].filter(Boolean).join("\n");
        const system = "Você sugere TERRITÓRIOS ESTRATÉGICOS: temas, problemas, categorias ou espaços conceituais pelos quais a marca pode querer ser reconhecida. Um território NÃO é keyword, hashtag, produto, campanha ou tag. Sugira entre 3 e 8, variando amplitude (broad, balanced, narrow) sem tratar amplitude como qualidade. Use SOMENTE os itens listados; supporting_brand_items deve conter apenas IDs exatos entre colchetes. Não invente fatos. Responda em português do Brasil.";
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST", signal: AbortSignal.timeout(45000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: system }, { role: "user", content: `${ctx}\n\nItens do Brand Brain:\n${lines}` }],
            tools: [{ type: "function", function: { name: "deliver_territories", description: "Territory suggestions", parameters: {
              type: "object", required: ["suggestions"], properties: { suggestions: { type: "array", items: { type: "object", required: ["name", "type", "rationale", "supporting_brand_items", "confidence", "breadth"], properties: {
                name: { type: "string" }, type: { type: "string", enum: [...TERRITORY_TYPES] }, rationale: { type: "string" },
                supporting_brand_items: { type: "array", items: { type: "string" } }, confidence: { type: "number" }, breadth: { type: "string", enum: [...TERRITORY_BREADTHS] },
              } } } } } } }],
            tool_choice: { type: "function", function: { name: "deliver_territories" } },
          }),
        });
        if (res.status === 429) return respond(429, { error: "Limite de uso da IA atingido. Tente em instantes." });
        if (res.status === 402) return respond(402, { error: "Créditos de IA esgotados." });
        if (!res.ok) { log("ai_failed", { status: res.status }); return respond(502, { error: "Não foi possível gerar sugestões agora." }); }
        const args = extractToolArguments(await res.json());
        if (!args.ok) return respond(502, { error: "Não foi possível gerar sugestões agora." });
        const suggestions = sanitizeSuggestions(args.value, cat);
        log("suggest_ok", { count: suggestions.length });
        return respond(200, { ok: true, suggestions, brand_brain: { id: brain.id, version: brain.version } });
      }
    }
  } catch (e) {
    log("mutation_failed", { action: a.action, message: String((e as { message?: string })?.message ?? e).slice(0, 200) });
    return respond(500, { error: "Não foi possível salvar. Tente novamente." });
  }
  return respond(400, { error: "Ação inválida." });
});
