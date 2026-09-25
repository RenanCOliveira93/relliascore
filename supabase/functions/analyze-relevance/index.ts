import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { dispatchWebhooks } from "../_shared/webhooks.ts";
import { safeFetch } from "../_shared/url-safety.ts";
import { extractPage } from "../_shared/extract.ts";
import { fetchRobots, type RobotsResult } from "../_shared/robots.ts";
import { buildAnaliseRow } from "../_shared/persist.ts";
import { computeTechnicalSignals, hasEnoughContent, type TechnicalSignals } from "../_shared/signals.ts";
import { budgetBlocks, budgetPlainText, metadataSection, type ContentPayload } from "../_shared/content-budget.ts";
import { extractToolArguments } from "../_shared/model-parse.ts";
import { buildV2Scores, buildV2ToolSchema, validateV2Assessment } from "../_shared/score-v2.ts";
import {
  adminClient, authenticate, checkRateLimits, clientIp, createLogger, jsonResponse, privateCors, refundUsage, verifyWorkspace,
} from "../_shared/http.ts";

type FailureStatus = "invalid_url" | "timeout" | "crawl_failed" | "unsupported_content" | "analysis_failed";

const FAILURE_HTTP: Record<FailureStatus, number> = {
  invalid_url: 400, crawl_failed: 422, unsupported_content: 422, timeout: 504, analysis_failed: 502,
};

serve(async (req) => {
  const cors = privateCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const requestId = crypto.randomUUID();
  const log = createLogger("analyze-relevance", requestId);
  const respond = (status: number, body: Record<string, unknown>) => jsonResponse(cors, status, { ...body, request_id: requestId }, requestId);
  log("request_received", { method: req.method });

  const admin = adminClient();
  if (!admin) return respond(500, { status: "analysis_failed", error: "Erro interno ao processar análise." });

  const auth = await authenticate(req);
  if (!auth) return respond(401, { error: "Não autenticado." });
  log("auth_validated", { kind: auth.kind });

  let body: any;
  try { body = await req.json(); } catch { return respond(400, { error: "JSON inválido." }); }
  const { websiteUrl, searchQuery, mode = "business", inputType = "webpage", content } = body ?? {};

  // Workspace: user calls must own the workspace; internal calls trust public-api's validated key.
  let workspaceId: string | null = null;
  let userId: string | null = auth.userId;
  if (auth.kind === "user") {
    try { workspaceId = await verifyWorkspace(admin, auth.userId, body?.workspaceId); }
    catch { return respond(403, { error: "Workspace não encontrado ou sem permissão." }); }
    const allowed = await checkRateLimits(admin, "analyze-relevance", [
      { key: `user:${auth.userId}`, max: 10, windowSeconds: 60 },
      ...(workspaceId ? [{ key: `ws:${workspaceId}`, max: 20, windowSeconds: 60 }] : []),
      { key: `ip:${clientIp(req)}`, max: 30, windowSeconds: 60 },
    ], log);
    if (!allowed) return respond(429, { error: "Limite de requisições excedido. Tente novamente em alguns minutos." });
  } else {
    workspaceId = auth.workspaceId;
  }

  // Failures that happen after the frontend consumed plan quota are refunded (user calls only;
  // public-api refunds its own calls).
  const fail = async (status: FailureStatus, reason: string, extra: Record<string, unknown> = {}) => {
    if (auth.kind === "user") await refundUsage(admin, userId, log);
    log("analysis_not_completed", { status });
    return respond(FAILURE_HTTP[status], { status, error: reason, ...extra });
  };

  // ---- Input validation ----
  if (inputType !== "webpage" && inputType !== "text") return respond(400, { error: "Tipo de entrada inválido" });
  if (mode !== "business" && mode !== "influencer") return respond(400, { error: "Modo inválido" });
  if (!searchQuery || typeof searchQuery !== "string" || searchQuery.length > 2000) {
    return respond(400, { error: "Consulta de pesquisa inválida (máximo 2000 caracteres)" });
  }
  if (inputType === "text" && (typeof content !== "string" || !content.trim() || content.length > 50000)) {
    return respond(400, { error: "Texto inválido (máximo 50000 caracteres)" });
  }
  if (inputType === "webpage" && (typeof websiteUrl !== "string" || !websiteUrl.trim())) {
    return respond(400, { error: "URL do site é obrigatória para análise de webpage" });
  }

  // Plan quota is consumed server-side from the authenticated identity (never a client-sent user id).
  if (auth.kind === "user") {
    const { data: quotaOk, error: quotaErr } = await admin.rpc("increment_analysis_usage", { p_user_id: auth.userId });
    if (quotaErr || quotaOk === false) return respond(402, { status: "analysis_failed", error: "Limite de análises do seu plano atingido." });
  }
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) { log("config_error", { missing: "LOVABLE_API_KEY" }); return fail("analysis_failed", "Erro interno ao processar análise."); }

  // ---- Content acquisition ----
  let technicalSignals: TechnicalSignals | null = null;
  let robots: RobotsResult | null = null;
  let payload: ContentPayload;
  let metadata = "";
  let sourceMeta: Record<string, unknown> = {};

  if (inputType === "text") {
    payload = budgetPlainText(content.trim());
  } else {
    log("crawl_started");
    const fetched = await safeFetch(websiteUrl);
    if (!fetched.ok) {
      log("crawl_failed", { status: fetched.status, http_status: fetched.httpStatus ?? null });
      return fail(fetched.status, fetched.reason, { http_status: fetched.httpStatus ?? null });
    }
    log("crawl_completed", { http_status: fetched.httpStatus, redirects: fetched.redirects, bytes_truncated: fetched.bodyTruncated });
    // Single robots.txt read (same origin, SSRF-safe, 4s cap). Never blocks the analysis.
    const robotsPromise = fetchRobots(fetched.finalUrl).catch(() => null);

    const page = extractPage(fetched.body, {
      requestedUrl: fetched.requestedUrl, finalUrl: fetched.finalUrl, httpStatus: fetched.httpStatus, htmlTruncated: fetched.bodyTruncated,
    });
    technicalSignals = computeTechnicalSignals(page, { contentType: fetched.contentType });
    robots = await robotsPromise;
    log("robots_checked", { status: robots?.status ?? "unavailable" });
    log("extraction_completed", { word_count: page.word_count, blocks: page.content_blocks.length, schemas: page.schema_types.length });

    if (!hasEnoughContent(page)) {
      return fail("crawl_failed", "A página foi acessada, mas não possui conteúdo textual suficiente para análise (pode depender de JavaScript para renderizar).", {
        technical_signals: technicalSignals,
      });
    }
    payload = budgetBlocks(page.content_blocks, searchQuery);
    metadata = metadataSection(page);
    sourceMeta = { requested_url: fetched.requestedUrl, final_url: fetched.finalUrl, http_status: fetched.httpStatus, html_truncated: fetched.bodyTruncated };
  }

  const signalIds = technicalSignals?.issues.map((i) => i.id) ?? [];
  const modeContext = mode === "influencer"
    ? `O contexto é de um INFLUENCER / MARCA PESSOAL. Foque em: autoridade pessoal, presença digital, tom de voz autêntico, engajamento percebido, conexão com a audiência, storytelling, prova social e posicionamento como referência no nicho.`
    : `O contexto é de uma EMPRESA / EMPREENDIMENTO. Foque em: SEO técnico, evidências de credibilidade presentes no conteúdo, proposta de valor clara, conversão, competitividade no mercado, credibilidade institucional e otimização para buscas comerciais.`;
  const textContext = inputType === "text"
    ? `IMPORTANTE: Este texto ainda NÃO foi publicado. Analise como se fosse ser postado. Forneça um exemplo completo de texto ideal (score próximo a 100%) mantendo a essência do original.`
    : `Forneça um exemplo de conteúdo ideal (score próximo a 100%) que a página deveria ter para ser perfeitamente relevante para a pesquisa.`;

  const systemPrompt = `Você é um especialista em SEO, GEO (Generative Engine Optimization) e análise de conteúdo digital. ${modeContext}

${textContext}

Regras de evidência:
- Os SINAIS TÉCNICOS fornecidos são FATOS medidos automaticamente. Não os contradiga e não invente sinais técnicos que não estejam listados.
- Em cada item do plano de ação, informe "basis": "signal" quando baseado em um sinal técnico (e preencha "signal_ref" com o id exato do problema), "content" quando baseado em trecho concreto do conteúdo (cite o trecho em "evidence"), ou "inference" quando for julgamento seu.
- Nunca invente evidências. "confidence" vai de 0 a 1.
- Você NÃO calcula score geral nem nota técnica: o backend calcula o RELLIA Content Score a partir das suas avaliações e dos fatos técnicos. Não estime probabilidade de recomendação nem ranking em ChatGPT, Gemini, Claude ou Perplexity.
- Evidência & Autoridade mede apenas evidências PRESENTES no conteúdo (dados, referências, cases, autoria, datas). Não infira autoridade externa, Domain Authority ou popularidade.
- entity_clarity: "clear" só com trecho literal em "evidence"; se ausente, use "absent". Não invente entidade.
- content_claims: liste afirmações relevantes e se o próprio material as sustenta (sem checagem externa).
- Em cada ação do plano, informe "affected_dimension" (semantic_relevance, entity_clarity, evidence_authority, citation_readiness ou technical_geo). Não invente números de impacto.
- "reason" deve ser uma justificativa curta para o usuário, nunca raciocínio interno.
${payload.content_truncated ? "- O conteúdo foi resumido por seleção de blocos; não conclua que algo está ausente só porque não aparece no trecho enviado, a menos que os sinais técnicos confirmem." : ""}`;

  const userPrompt = `Tipo de Entrada: ${inputType === "text" ? "Texto pré-publicação" : "Webpage publicada"}
Modo: ${mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento"}
${sourceMeta.final_url ? `URL analisada: ${sourceMeta.final_url}` : ""}

${technicalSignals ? `=== SINAIS TÉCNICOS (fatos) ===\n${JSON.stringify({ ...technicalSignals, issues: undefined })}\nProblemas detectados (id: descrição):\n${technicalSignals.issues.map((i) => `- ${i.id}: ${i.message}`).join("\n") || "(nenhum)"}\n` : ""}
${metadata ? `=== METADADOS ===\n${metadata}\n` : ""}
=== CONTEÚDO${payload.content_truncated ? ` (selecionado: ${payload.sent_chars} de ${payload.original_chars} caracteres)` : ""} ===
${payload.text}

=== PESQUISA/PROBLEMA DO USUÁRIO ===
"${searchQuery}"

Faça a análise completa usando a função fornecida.`;

  log("model_call_started", { prompt_chars: userPrompt.length, content_truncated: payload.content_truncated });
  let aiResponse: unknown;
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{ type: "function", function: { name: "deliver_analysis", description: "Deliver the complete analysis result", parameters: RELEVANCE_SCHEMA } }],
        tool_choice: { type: "function", function: { name: "deliver_analysis" } },
      }),
    });
    if (!response.ok) {
      log("model_call_failed", { http_status: response.status });
      await response.text().catch(() => "");
      if (auth.kind === "user") await refundUsage(admin, userId, log);
      if (response.status === 429) return respond(429, { status: "analysis_failed", error: "Limite de requisições excedido. Tente novamente em alguns minutos." });
      if (response.status === 402) return respond(402, { status: "analysis_failed", error: "Créditos insuficientes. Por favor, adicione créditos à sua conta." });
      return respond(502, { status: "analysis_failed", error: "Não foi possível concluir a análise. Tente novamente." });
    }
    aiResponse = await response.json();
  } catch (e) {
    log("model_call_error", { name: (e as Error)?.name });
    return fail("analysis_failed", "Não foi possível concluir a análise. Tente novamente.");
  }
  log("model_call_completed");

  const args = extractToolArguments(aiResponse);
  const validated = args.ok ? validateV2Assessment(args.value, signalIds) : args;
  if (!validated.ok) {
    log("parse_failed", { reason: validated.reason });
    return fail("analysis_failed", "Não foi possível interpretar a resposta da IA. Tente novamente.");
  }
  if (validated.value.ignored_fields.length) log("llm_forbidden_fields_ignored", { fields: validated.value.ignored_fields });
  const scored = buildV2Scores(validated.value, technicalSignals, { robots });
  if (!scored.ok) {
    log("score_failed", { reason: scored.reason });
    return fail("analysis_failed", "Não foi possível calcular o score com segurança. Tente novamente.");
  }
  log("parse_completed");
  const a = validated.value;
  const v2 = scored.value;
  const r = {
    score: v2.score, sub_scores: v2.sub_scores, summary: a.summary, strengths: a.strengths, improvements: a.improvements,
    compatibility_diagnostic: a.compatibility_diagnostic, action_plan: a.action_plan, keywords_analysis: a.keywords_analysis,
    ideal_example: a.ideal_example,
  };

  const result = {
    // Legacy flat format (kept for UI/PDF/API compatibility)
    ...r,
    status: "success",
    schema_version: "p0.2",
    score_version: v2.score_version,
    content_score: v2.content_score,
    content_score_partial: v2.content_score_partial,
    weights_applied: v2.weights_applied,
    score_dimensions: v2.score_dimensions,
    entity_clarity: v2.entity_clarity,
    evidence_readiness: v2.evidence_readiness,
    citation_readiness: v2.citation_readiness,
    entity_signals: v2.entity_signals,
    content_claims: v2.content_claims,
    technical_geo_checks: v2.technical_geo_checks,
    technical_geo: v2.technical_geo,
    dimensions_used: v2.dimensions_used,
    analysis_id: requestId as string,
    technical_signals: technicalSignals,
    // Only what the model produced (no overall score — that is computed by the backend).
    llm_assessment: {
      semantic_relevance: a.semantic_relevance, entity_clarity: a.entity_clarity, evidence_readiness: a.evidence_raw,
      citation_readiness: a.citation_raw, summary: a.summary, strengths: a.strengths, improvements: a.improvements,
      compatibility_diagnostic: a.compatibility_diagnostic, action_plan: a.action_plan,
    },
    source_meta: {
      ...sourceMeta,
      input_type: inputType,
      content_truncated: payload.content_truncated,
      original_chars: payload.original_chars,
      sent_chars: payload.sent_chars,
    },
  };

  // Persist successful member-area analyses (public-api persists its own calls). Failures never reach here.
  if (auth.kind === "user" && workspaceId && userId) {
    try {
      let empresaId: string | null = null;
      const host = (() => { try { return new URL(String(sourceMeta.final_url ?? websiteUrl)).hostname.replace(/^www\./, ""); } catch { return null; } })();
      if (host) {
        const { data: emps } = await admin.from("empresas").select("id,url").eq("workspace_id", workspaceId);
        empresaId = (emps ?? []).find((e: any) => { try { return new URL(/^https?:/i.test(e.url) ? e.url : `https://${e.url}`).hostname.replace(/^www\./, "") === host; } catch { return false; } })?.id ?? null;
      }
      const row = buildAnaliseRow(result, {
        userId, workspaceId, empresaId, origem: "app", inputType, mode, searchQuery,
        websiteUrl: inputType === "webpage" ? String(sourceMeta.final_url ?? websiteUrl) : null,
      });
      const { data: saved, error: saveErr } = row ? await admin.from("analises").insert(row).select("id").single() : { data: null, error: { code: "invalid_row" } };
      if (saveErr || !saved) log("persist_failed", { code: saveErr?.code });
      else {
        result.analysis_id = saved.id;
        const items = (r.action_plan ?? []).filter((i: any) => i?.action && i?.priority).map((i: any) => ({
          user_id: userId, workspace_id: workspaceId, empresa_id: empresaId, analise_id: saved.id,
          priority: i.priority, action: i.action, impact: i.impact ?? null, category: i.category ?? null, affected_dimension: i.affected_dimension ?? null,
        }));
        if (items.length) await admin.from("plano_de_acao").insert(items);
        log("persisted");
      }
    } catch { log("persist_failed"); }
  }

  if (auth.kind === "user" && workspaceId) {
    dispatchWebhooks(workspaceId, "analysis.completed", {
      analysis_id: result.analysis_id, mode, input_type: inputType, website_url: websiteUrl ?? null, search_query: searchQuery,
      score: r.score, sub_scores: r.sub_scores, action_plan: r.action_plan, keywords_analysis: r.keywords_analysis,
      summary: r.summary, technical_signals: technicalSignals, source: "app",
      score_version: v2.score_version, content_score: v2.content_score, content_score_partial: v2.content_score_partial,
      score_dimensions: Object.fromEntries(Object.entries(v2.score_dimensions).map(([k, d]) => [k, { score: d.score, source: d.source, available: d.available }])),
    }).then(() => log("webhook_dispatched")).catch(() => log("webhook_error"));
  }

  log("completed", { score_version: v2.score_version, content_score: v2.content_score });
  return respond(200, result);
});

const ACTION_ITEM_SCHEMA = {
  type: "object",
  properties: {
    priority: { type: "string", enum: ["alta", "media", "baixa"] },
    action: { type: "string" },
    impact: { type: "string", description: "Impacto qualitativo. Não invente números." },
    category: { type: "string", enum: ["conteudo", "tecnico", "autoridade", "estrutura"] },
    reason: { type: "string", description: "Por que esta ação é necessária" },
    evidence: { type: "string", description: "Trecho literal do conteúdo ou descrição do sinal técnico. Vazio se for inferência." },
    confidence: { type: "number", description: "0 a 1" },
    basis: { type: "string", enum: ["signal", "content", "inference"] },
    signal_ref: { type: "string", description: "id do problema técnico quando basis=signal" },
    affected_dimension: { type: "string", enum: ["semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness", "technical_geo"] },
  },
  required: ["priority", "action", "impact", "category", "reason", "confidence", "basis", "affected_dimension"],
};

const RELEVANCE_SCHEMA = buildV2ToolSchema(ACTION_ITEM_SCHEMA);
