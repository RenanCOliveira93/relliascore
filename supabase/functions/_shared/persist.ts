// Builds a public.analises row for a successful analysis. Pure (testable); callers insert with the service client.
// The row is the historical SNAPSHOT: reopening never re-calls the LLM, re-crawls or re-scores.
// Raw pasted text is never stored (inputType "text" keeps website_url null and has no content column).
import { v2AnaliseColumns } from "./score-v2.ts";

export interface PersistContext {
  userId: string;
  workspaceId: string;
  empresaId: string | null;
  origem: "app" | "webhook_api";
  inputType: "webpage" | "text";
  mode: string;
  searchQuery: string;
  /** Final URL for webpages; null for text (raw text is never stored here). */
  websiteUrl: string | null;
  /** Idempotency key (unique per user). Retries with the same key never create a second row. */
  requestId?: string | null;
}

const REQ_RE = /^[A-Za-z0-9-]{8,64}$/;
export const normalizeRequestId = (v: unknown): string | null => (typeof v === "string" && REQ_RE.test(v) ? v : null);

export function buildAnaliseRow(data: Record<string, any>, ctx: PersistContext): Record<string, unknown> | null {
  // Only successful analyses with a numeric score become history entries.
  if (!data || data.status !== "success" || typeof data.score !== "number") return null;
  return {
    user_id: ctx.userId,
    workspace_id: ctx.workspaceId,
    empresa_id: ctx.empresaId,
    tipo: "conteudo",
    origem: ctx.origem,
    input_type: ctx.inputType,
    website_url: ctx.inputType === "webpage" ? ctx.websiteUrl : null,
    search_query: String(ctx.searchQuery ?? "").slice(0, 2000),
    analysis_mode: ctx.mode,
    request_id: normalizeRequestId(ctx.requestId),
    schema_version: typeof data.schema_version === "string" ? data.schema_version : null,
    score: data.score,
    summary: data.summary ?? null,
    sub_scores: data.sub_scores ?? null,
    keywords_analysis: data.keywords_analysis ?? null,
    action_plan: data.action_plan ?? null,
    strengths: Array.isArray(data.strengths) ? data.strengths : null,
    improvements: Array.isArray(data.improvements) ? data.improvements : null,
    optimized_version: typeof data.ideal_example === "string" && data.ideal_example.trim() ? data.ideal_example : null,
    current_vs_ideal: data.compatibility_diagnostic && typeof data.compatibility_diagnostic === "object" ? data.compatibility_diagnostic : null,
    ...v2AnaliseColumns(data),
  };
}
