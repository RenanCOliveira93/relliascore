// Public REST API authenticated via workspace API keys (header: X-API-Key).
// Endpoints:
//   POST /public-api/analyze         → relevance analysis
//   POST /public-api/analyze-brand   → brand analysis
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { dispatchWebhooks, sha256Hex } from "../_shared/webhooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// In-memory rate limiter, keyed per API key
const limiter = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 60_000;
const MAX = 20;
function rateLimited(key: string) {
  const now = Date.now();
  const e = limiter.get(key);
  if (!e || now > e.resetAt) {
    limiter.set(key, { count: 1, resetAt: now + WINDOW });
    return false;
  }
  e.count++;
  return e.count > MAX;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // last segment of path
  const segments = url.pathname.split("/").filter(Boolean);
  const action = segments[segments.length - 1];

  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  if (!apiKey || !apiKey.startsWith("rl_")) {
    return json(401, { error: "Missing or invalid API key. Use header X-API-Key." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Server misconfigured" });

  const admin = createClient(supabaseUrl, serviceKey);
  const keyHash = await sha256Hex(apiKey);
  const { data: keyRows, error: keyErr } = await admin.rpc("validate_api_key", {
    p_key_hash: keyHash,
  });
  if (keyErr || !keyRows || keyRows.length === 0) {
    return json(401, { error: "Invalid or revoked API key" });
  }
  const { workspace_id, user_id } = keyRows[0] as {
    workspace_id: string;
    user_id: string;
  };

  if (rateLimited(apiKey)) return json(429, { error: "Rate limit exceeded" });

  // Quota: increment user analyses usage
  const { data: ok } = await admin.rpc("increment_analysis_usage", {
    p_user_id: user_id,
  });
  if (ok === false) {
    return json(402, {
      error: "Plan limit reached. Upgrade to continue.",
    });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const FUNCTIONS_BASE = `${supabaseUrl}/functions/v1`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
  };

  // Helper: tenta achar empresa do workspace por URL aproximada
  const findEmpresaIdByUrl = async (rawUrl?: string | null): Promise<string | null> => {
    if (!rawUrl) return null;
    try {
      const host = new URL(
        rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`,
      ).hostname.replace(/^www\./, "");
      const { data } = await admin
        .from("empresas")
        .select("id, url")
        .eq("workspace_id", workspace_id);
      const match = (data ?? []).find((e: any) => {
        try {
          const h = new URL(
            e.url.startsWith("http") ? e.url : `https://${e.url}`,
          ).hostname.replace(/^www\./, "");
          return h === host;
        } catch {
          return false;
        }
      });
      return match?.id ?? null;
    } catch {
      return null;
    }
  };

  if (action === "analyze") {
    const res = await fetch(`${FUNCTIONS_BASE}/analyze-relevance`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return json(res.status, data);

    const empresa_id = await findEmpresaIdByUrl(body.websiteUrl);

    // Persist analise (conteudo)
    const { data: analiseRow } = await admin
      .from("analises")
      .insert({
        user_id,
        workspace_id,
        empresa_id,
        tipo: "conteudo",
        score: data.score ?? null,
        summary: data.summary ?? null,
        sub_scores: data.sub_scores ?? null,
        keywords_analysis: data.keywords_analysis ?? null,
        action_plan: data.action_plan ?? null,
        origem: "webhook_api",
      })
      .select("id")
      .single();

    // Bulk insert do plano de ação
    if (analiseRow?.id && Array.isArray(data.action_plan)) {
      const items = data.action_plan
        .filter((i: any) => i?.action && i?.priority)
        .map((i: any) => ({
          user_id,
          workspace_id,
          empresa_id,
          analise_id: analiseRow.id,
          priority: i.priority,
          action: i.action,
          impact: i.impact ?? null,
          category: i.category ?? null,
        }));
      if (items.length > 0) await admin.from("plano_de_acao").insert(items);
    }

    await dispatchWebhooks(workspace_id, "analysis.completed", {
      analise_id: analiseRow?.id ?? null,
      empresa_id,
      mode: body.mode ?? "business",
      input_type: body.inputType ?? "webpage",
      website_url: body.websiteUrl ?? null,
      search_query: body.searchQuery ?? "",
      score: data.score,
      sub_scores: data.sub_scores,
      action_plan: data.action_plan,
      keywords_analysis: data.keywords_analysis,
      summary: data.summary,
      source: "api",
    });

    return json(200, data);
  }

  if (action === "analyze-brand") {
    const res = await fetch(`${FUNCTIONS_BASE}/analyze-brand`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return json(res.status, data);

    const empresa_id = await findEmpresaIdByUrl(body.website);

    // Mantém a tabela legada brand_analyses
    await admin.from("brand_analyses").insert({
      user_id,
      workspace_id,
      mode: body.mode ?? "business",
      website: body.website ?? null,
      linkedin: body.linkedin ?? null,
      instagram: body.instagram ?? null,
      description: body.description ?? "",
      result: data,
    });

    // E grava também em analises (tipo=marca) para histórico unificado
    const { data: analiseRow } = await admin
      .from("analises")
      .insert({
        user_id,
        workspace_id,
        empresa_id,
        tipo: "marca",
        score: data.consistencia_score ?? null,
        summary: data.resumo_marca ?? null,
        dados_marca: {
          consistencia_score: data.consistencia_score,
          tom_de_voz: data.tom_de_voz,
          publico_alvo: data.publico_alvo,
          recomendacoes: data.recomendacoes,
        },
        origem: "webhook_api",
      })
      .select("id")
      .single();

    await dispatchWebhooks(workspace_id, "brand_analysis.completed", {
      analise_id: analiseRow?.id ?? null,
      empresa_id,
      mode: body.mode ?? "business",
      website: body.website ?? null,
      linkedin: body.linkedin ?? null,
      instagram: body.instagram ?? null,
      consistencia_score: data.consistencia_score,
      tom_de_voz: data.tom_de_voz,
      publico_alvo: data.publico_alvo,
      recomendacoes: data.recomendacoes,
      source: "api",
    });

    return json(200, data);
  }

  return json(404, {
    error: "Unknown endpoint. Use /analyze or /analyze-brand",
    available: ["POST /public-api/analyze", "POST /public-api/analyze-brand"],
  });
});
