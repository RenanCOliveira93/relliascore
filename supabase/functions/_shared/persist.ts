// Builds a public.analises row for a successful analysis. Pure (testable); callers insert with the service client.
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
}

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
    score: data.score,
    summary: data.summary ?? null,
    sub_scores: data.sub_scores ?? null,
    keywords_analysis: data.keywords_analysis ?? null,
    action_plan: data.action_plan ?? null,
    ...v2AnaliseColumns(data),
  };
}
