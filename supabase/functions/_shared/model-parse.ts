// Strict parsing of model output. Never fabricate results on failure.

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function extractToolArguments(aiResponse: unknown): ParseResult<Record<string, unknown>> {
  try {
    const msg = (aiResponse as any)?.choices?.[0]?.message;
    if (!msg) return { ok: false, reason: "no_message" };
    const args = msg.tool_calls?.[0]?.function?.arguments;
    let parsed: unknown;
    if (args !== undefined) parsed = typeof args === "string" ? JSON.parse(args) : args;
    else if (typeof msg.content === "string" && msg.content.trim()) parsed = JSON.parse(msg.content.replace(/```json\n?|\n?```/g, "").trim());
    else return { ok: false, reason: "no_tool_call" };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, reason: "not_object" };
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

const SUB_KEYS = ["relevancia_tematica", "qualidade_conteudo", "autoridade_percebida", "otimizacao_llm", "clareza_proposta_valor"] as const;
const PRIORITIES = ["alta", "media", "baixa"];
const CATEGORIES = ["conteudo", "tecnico", "autoridade", "estrutura"];

export const AFFECTED_DIMENSIONS = ["semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness", "technical_geo"] as const;

export interface ParsedActionItem {
  priority: "alta" | "media" | "baixa";
  action: string;
  impact: string;
  category: "conteudo" | "tecnico" | "autoridade" | "estrutura";
  reason?: string;
  evidence?: string;
  confidence?: number;
  basis?: "signal" | "content" | "inference";
  signal_ref?: string;
  affected_dimension?: typeof AFFECTED_DIMENSIONS[number];
}

export function parseActionPlan(v: unknown, knownSignalIds: string[] = []): ParsedActionItem[] {
  return (Array.isArray(v) ? v : [])
    .filter((i: any) => i && typeof i.action === "string" && PRIORITIES.includes(i.priority))
    .map((i: any) => {
      const basis = ["signal", "content", "inference"].includes(i.basis) ? i.basis : "inference";
      const ref = typeof i.signal_ref === "string" && knownSignalIds.includes(i.signal_ref) ? i.signal_ref : undefined;
      const item: ParsedActionItem = {
        priority: i.priority,
        action: i.action,
        impact: typeof i.impact === "string" ? i.impact : "",
        category: CATEGORIES.includes(i.category) ? i.category : "conteudo",
        reason: typeof i.reason === "string" ? i.reason : undefined,
        evidence: typeof i.evidence === "string" && i.evidence.trim() ? i.evidence : undefined,
        confidence: isNum(i.confidence) ? +clamp(i.confidence, 0, 1).toFixed(2) : undefined,
        // A "signal" claim without a valid signal reference is downgraded to inference.
        basis: basis === "signal" && !ref ? "inference" : basis,
        signal_ref: ref,
      };
      if ((AFFECTED_DIMENSIONS as readonly string[]).includes(i.affected_dimension)) item.affected_dimension = i.affected_dimension;
      return item;
    });
}

export function validateRelevanceResult(raw: Record<string, unknown>, knownSignalIds: string[] = []): ParseResult<Record<string, unknown>> {
  if (!isNum(raw.score)) return { ok: false, reason: "missing_score" };
  if (typeof raw.summary !== "string" || !raw.summary.trim()) return { ok: false, reason: "missing_summary" };
  const sub = raw.sub_scores as Record<string, unknown> | undefined;
  if (!sub || SUB_KEYS.some((k) => !isNum(sub[k]))) return { ok: false, reason: "invalid_sub_scores" };
  const cd = raw.compatibility_diagnostic as Record<string, unknown> | undefined;
  if (!cd || typeof cd.conteudo_atual !== "string" || typeof cd.conteudo_ideal !== "string" || !isNum(cd.compatibility_percentage)) {
    return { ok: false, reason: "invalid_compatibility" };
  }
  const kw = (raw.keywords_analysis ?? {}) as Record<string, unknown>;

  const action_plan = parseActionPlan(raw.action_plan, knownSignalIds);

  const sub_scores = Object.fromEntries(SUB_KEYS.map((k) => [k, Math.round(clamp(sub[k] as number, 0, 100))]));
  return {
    ok: true,
    value: {
      score: Math.round(clamp(raw.score as number, 0, 100)),
      summary: raw.summary,
      strengths: strArr(raw.strengths),
      improvements: strArr(raw.improvements),
      sub_scores,
      compatibility_diagnostic: {
        conteudo_atual: cd.conteudo_atual,
        conteudo_ideal: cd.conteudo_ideal,
        gap_analysis: strArr(cd.gap_analysis),
        compatibility_percentage: Math.round(clamp(cd.compatibility_percentage as number, 0, 100)),
      },
      action_plan,
      keywords_analysis: { found: strArr(kw.found), missing: strArr(kw.missing), suggested: strArr(kw.suggested) },
      ideal_example: typeof raw.ideal_example === "string" ? raw.ideal_example : "",
    },
  };
}

const BRAND_REQUIRED = ["tom_de_voz", "publico_alvo", "nicho", "resumo_marca"];
export function validateBrandResult(raw: Record<string, unknown>): ParseResult<Record<string, unknown>> {
  for (const k of BRAND_REQUIRED) if (typeof raw[k] !== "string" || !(raw[k] as string).trim()) return { ok: false, reason: `missing_${k}` };
  if (!isNum(raw.consistencia_score)) return { ok: false, reason: "missing_consistencia_score" };
  return { ok: true, value: { ...raw, consistencia_score: Math.round(clamp(raw.consistencia_score as number, 0, 100)) } };
}
