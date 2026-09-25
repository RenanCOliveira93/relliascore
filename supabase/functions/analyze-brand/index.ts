import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { dispatchWebhooks } from "../_shared/webhooks.ts";
import { safeFetch } from "../_shared/url-safety.ts";
import { extractPage } from "../_shared/extract.ts";
import { budgetBlocks, metadataSection } from "../_shared/content-budget.ts";
import { extractToolArguments, validateBrandResult } from "../_shared/model-parse.ts";
import {
  adminClient, authenticate, checkRateLimits, clientIp, createLogger, jsonResponse, privateCors, refundUsage, verifyWorkspace,
} from "../_shared/http.ts";

interface SourceStatus { source: string; status: string; reason?: string; content_truncated?: boolean }

serve(async (req) => {
  const cors = privateCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const requestId = crypto.randomUUID();
  const log = createLogger("analyze-brand", requestId);
  const respond = (status: number, body: Record<string, unknown>) => jsonResponse(cors, status, { ...body, request_id: requestId }, requestId);
  log("request_received");

  const admin = adminClient();
  if (!admin) return respond(500, { status: "analysis_failed", error: "Erro interno ao processar análise." });
  const auth = await authenticate(req);
  if (!auth) return respond(401, { error: "Não autenticado." });
  log("auth_validated", { kind: auth.kind });

  let body: any;
  try { body = await req.json(); } catch { return respond(400, { error: "JSON inválido." }); }
  const { website, linkedin, instagram, description, mode = "business" } = body ?? {};

  let workspaceId: string | null = null;
  if (auth.kind === "user") {
    try { workspaceId = await verifyWorkspace(admin, auth.userId, body?.workspaceId); }
    catch { return respond(403, { error: "Workspace não encontrado ou sem permissão." }); }
    const ok = await checkRateLimits(admin, "analyze-brand", [
      { key: `user:${auth.userId}`, max: 5, windowSeconds: 60 },
      ...(workspaceId ? [{ key: `ws:${workspaceId}`, max: 10, windowSeconds: 60 }] : []),
      { key: `ip:${clientIp(req)}`, max: 20, windowSeconds: 60 },
    ], log);
    if (!ok) return respond(429, { error: "Limite de requisições excedido. Tente novamente em alguns minutos." });
  } else {
    workspaceId = auth.workspaceId;
  }

  const fail = async (status: number, error: string) => {
    if (auth.kind === "user") await refundUsage(admin, auth.userId, log);
    return respond(status, { status: "analysis_failed", error });
  };

  if (!description || typeof description !== "string" || description.length < 10 || description.length > 10000) {
    return respond(400, { error: "Descrição é obrigatória (10 a 10000 caracteres)" });
  }
  if (mode !== "business" && mode !== "influencer") return respond(400, { error: "Modo inválido" });

  // Plan quota is consumed server-side from the authenticated identity (never a client-sent user id).
  if (auth.kind === "user") {
    const { data: quotaOk, error: quotaErr } = await admin.rpc("increment_analysis_usage", { p_user_id: auth.userId });
    if (quotaErr || quotaOk === false) return respond(402, { status: "analysis_failed", error: "Limite de análises do seu plano atingido." });
  }
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return fail(500, "Erro interno ao processar análise.");

  // Fetch each provided source safely; failures are reported explicitly, never replaced by guesses.
  const sources: SourceStatus[] = [];
  const contents: string[] = [];
  for (const [label, url] of [["SITE", website], ["LINKEDIN", linkedin], ["INSTAGRAM", instagram]] as const) {
    if (!url || typeof url !== "string" || !url.trim()) continue;
    log("crawl_started", { source: label });
    const f = await safeFetch(url);
    if (!f.ok) {
      sources.push({ source: label.toLowerCase(), status: f.status, reason: f.reason });
      log("crawl_failed", { source: label, status: f.status });
      continue;
    }
    const page = extractPage(f.body, { requestedUrl: f.requestedUrl, finalUrl: f.finalUrl, httpStatus: f.httpStatus, htmlTruncated: f.bodyTruncated });
    if (page.word_count < 15) {
      sources.push({ source: label.toLowerCase(), status: "crawl_failed", reason: "Conteúdo insuficiente (página pode exigir login ou JavaScript)." });
      continue;
    }
    const payload = budgetBlocks(page.content_blocks, description, 5000);
    contents.push(`[${label}] ${f.finalUrl}\n${metadataSection(page)}\nConteúdo${payload.content_truncated ? " (selecionado)" : ""}:\n${payload.text}`);
    sources.push({ source: label.toLowerCase(), status: "success", content_truncated: payload.content_truncated });
    log("extraction_completed", { source: label, word_count: page.word_count });
  }

  const modeLabel = mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento";
  const systemPrompt = `Você é um especialista sênior em branding, posicionamento de marca, comunicação digital e análise de presença online. Perfil: ${modeLabel}.
Analise a marca de forma completa: tom de voz, público, nicho, estilo visual, resumo, palavras-chave, cores, temas, forças, fraquezas, posicionamento, diferencial, consistência (0-100), comunicação, presença digital e recomendações.
Regras: baseie-se apenas na descrição e nos conteúdos efetivamente extraídos. Fontes marcadas como NÃO ACESSADAS não devem ser descritas como se tivessem sido lidas; quando a análise depender de inferência, deixe isso claro no texto. Seja específico, não genérico.`;

  const failed = sources.filter((s) => s.status !== "success").map((s) => `${s.source.toUpperCase()}: NÃO ACESSADA (${s.reason})`);
  const userPrompt = `Descrição fornecida:\n${description}\n\n${failed.length ? `Fontes não acessadas:\n${failed.join("\n")}\n\n` : ""}Conteúdo extraído:\n${contents.join("\n\n") || "Nenhum conteúdo extraído; use apenas a descrição."}\n\nFaça a análise completa usando a função fornecida.`;

  log("model_call_started");
  let aiResponse: unknown;
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        tools: [{ type: "function", function: { name: "deliver_brand_analysis", description: "Deliver the complete brand analysis", parameters: BRAND_SCHEMA } }],
        tool_choice: { type: "function", function: { name: "deliver_brand_analysis" } },
      }),
    });
    if (!response.ok) {
      log("model_call_failed", { http_status: response.status });
      await response.text().catch(() => "");
      if (response.status === 429) return fail(429, "Limite de requisições excedido. Tente novamente em alguns minutos.");
      if (response.status === 402) return fail(402, "Créditos insuficientes.");
      return fail(502, "Não foi possível concluir a análise. Tente novamente.");
    }
    aiResponse = await response.json();
  } catch {
    return fail(502, "Não foi possível concluir a análise. Tente novamente.");
  }

  const args = extractToolArguments(aiResponse);
  const v = args.ok ? validateBrandResult(args.value) : args;
  if (!v.ok) { log("parse_failed", { reason: v.reason }); return fail(502, "Não foi possível interpretar a resposta da IA. Tente novamente."); }
  log("parse_completed");
  const result = { ...v.value, status: "success", analysis_id: requestId, sources_status: sources } as any;

  if (auth.kind === "user" && workspaceId) {
    dispatchWebhooks(workspaceId, "brand_analysis.completed", {
      analysis_id: requestId, mode, website: website ?? null, linkedin: linkedin ?? null, instagram: instagram ?? null,
      consistencia_score: result.consistencia_score, tom_de_voz: result.tom_de_voz, publico_alvo: result.publico_alvo,
      recomendacoes: result.recomendacoes, source: "app",
    }).then(() => log("webhook_dispatched")).catch(() => log("webhook_error"));
  }
  log("completed");
  return respond(200, result);
});

const BRAND_SCHEMA = {
  type: "object",
  properties: {
    tom_de_voz: { type: "string" }, publico_alvo: { type: "string" }, nicho: { type: "string" }, estilo_visual: { type: "string" },
    resumo_marca: { type: "string" },
    palavras_chave: { type: "array", items: { type: "string" } },
    cores_marca: { type: "array", items: { type: "object", properties: { hex: { type: "string" }, nome: { type: "string" } }, required: ["hex", "nome"] } },
    temas_sugeridos: { type: "array", items: { type: "string" } },
    pontos_fortes: { type: "array", items: { type: "string" } },
    pontos_fracos: { type: "array", items: { type: "string" } },
    posicionamento: { type: "string" }, diferencial: { type: "string" },
    consistencia_score: { type: "number" },
    comunicacao_analise: { type: "string" }, presenca_digital: { type: "string" },
    recomendacoes: { type: "array", items: { type: "string" } },
  },
  required: ["tom_de_voz", "publico_alvo", "nicho", "estilo_visual", "resumo_marca", "palavras_chave", "cores_marca", "temas_sugeridos", "pontos_fortes", "pontos_fracos", "posicionamento", "diferencial", "consistencia_score", "comunicacao_analise", "presenca_digital", "recomendacoes"],
  additionalProperties: false,
};
