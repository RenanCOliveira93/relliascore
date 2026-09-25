// Pure presentation helpers for the RELLIA Content Score 2.0 diagnosis.
// They only read persisted/returned analysis data — they never change the score math.
import {
  DIMENSION_LABELS,
  type ActionPlanItem,
  type AnalysisResult,
  type ContentClaim,
  type DimensionKey,
  type EntitySignal,
  type EntityType,
  type RuleStatus,
  type TechnicalGeoAudit,
  type TechnicalGeoRule,
} from "@/types/analysis";

export const DIMENSION_ORDER: DimensionKey[] = [
  "semantic_relevance", "entity_clarity", "evidence_authority", "citation_readiness", "technical_geo",
];

export type Tone = "positive" | "attention" | "problem" | "neutral";

export const toneOf = (score: number | null | undefined): Tone => {
  if (score === null || score === undefined || Number.isNaN(score)) return "neutral";
  if (score >= 75) return "positive";
  if (score >= 50) return "attention";
  return "problem";
};

export const bandLabel = (score: number | null | undefined): string => {
  const t = toneOf(score);
  return t === "positive" ? "Forte" : t === "attention" ? "Moderado" : t === "problem" ? "Fraco" : "N/D";
};

export const isV2 = (r: Pick<AnalysisResult, "score_version"> | null | undefined) => r?.score_version === "2.0";

/** Weights may be persisted as fractions (0.3) — tolerate percent values defensively. */
const asFraction = (w: number) => (w > 1 ? w / 100 : w);

export interface BreakdownRow { key: DimensionKey; label: string; score: number | null; weight: number | null; contribution: number | null; available: boolean }
export interface Breakdown { rows: BreakdownRow[]; weighted: number | null; rounded: number | null; usesPersistedWeights: boolean }

/** Uses ONLY the persisted weights_applied (no hardcoded weights). */
export function weightedBreakdown(r: AnalysisResult): Breakdown {
  const weights = r.weights_applied ?? {};
  const dims = r.score_dimensions;
  const has = Object.keys(weights).length > 0;
  let sum = 0;
  const rows = DIMENSION_ORDER.map((key) => {
    const d = dims?.[key];
    const w = typeof weights[key] === "number" ? asFraction(weights[key] as number) : null;
    const available = !!d && d.available && typeof d.score === "number" && w !== null;
    const contribution = available ? (d!.score as number) * (w as number) : null;
    if (contribution !== null) sum += contribution;
    return { key, label: DIMENSION_LABELS[key], score: d && d.available ? d.score : null, weight: w, contribution, available };
  });
  return { rows, weighted: has ? Math.round(sum * 100) / 100 : null, rounded: has ? Math.round(sum) : null, usesPersistedWeights: has };
}

// ---------- Basis ----------
export const basisLabel = (b?: string | null): string => {
  switch (b) {
    case "signal": case "technical_signal": return "Detectado na página";
    case "content": return "Identificado no conteúdo";
    case "inference": return "Avaliação semântica";
    default: return "Origem não informada";
  }
};

// ---------- Actions: merge + visual dedupe ----------
export interface DisplayAction extends ActionPlanItem {
  key: string;
  severity?: string;
  dimensions: DimensionKey[];
  origins: string[];
}

const PRIORITY_ORDER: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const sevToPriority = (s?: string): ActionPlanItem["priority"] =>
  s === "critical" || s === "high" ? "alta" : s === "medium" ? "media" : "baixa";

/** Combines the semantic action plan with Technical GEO issues, collapsing visual duplicates (does not touch stored data). */
export function mergeActions(actions: ActionPlanItem[] = [], tg?: TechnicalGeoAudit | null): DisplayAction[] {
  const out: DisplayAction[] = [];
  const index = new Map<string, DisplayAction>();

  const add = (a: ActionPlanItem & { severity?: string }, origin: string, ruleId?: string) => {
    const textKey = `t:${norm(a.action).slice(0, 80)}|${norm(a.evidence ?? "").slice(0, 80)}`;
    const ruleKey = ruleId ? `r:${ruleId}` : a.signal_ref ? `r:${a.signal_ref}` : null;
    const existing = (ruleKey && index.get(ruleKey)) || index.get(textKey);
    const dim = a.affected_dimension;
    if (existing) {
      if (dim && !existing.dimensions.includes(dim)) existing.dimensions.push(dim);
      if (!existing.origins.includes(origin)) existing.origins.push(origin);
      if (PRIORITY_ORDER[a.priority] < PRIORITY_ORDER[existing.priority]) existing.priority = a.priority;
      if (a.severity && (!existing.severity || SEVERITY_ORDER[a.severity] < SEVERITY_ORDER[existing.severity])) existing.severity = a.severity;
      if (ruleKey) index.set(ruleKey, existing);
      return;
    }
    const item: DisplayAction = { ...a, key: ruleKey ?? textKey, dimensions: dim ? [dim] : [], origins: [origin] };
    out.push(item);
    index.set(textKey, item);
    if (ruleKey) index.set(ruleKey, item);
  };

  for (const a of actions) add(a, "Plano semântico");
  for (const c of tg?.critical_issues ?? []) {
    add({ priority: "alta", severity: "critical", action: c.recommendation ?? c.label, impact: "", category: "tecnico", reason: c.label, evidence: c.evidence, basis: "signal", signal_ref: c.rule_id, affected_dimension: "technical_geo", confidence: 1 }, "Technical GEO", c.rule_id);
  }
  for (const q of tg?.quick_wins ?? []) {
    add({ priority: sevToPriority(q.severity), severity: q.severity, action: q.recommendation ?? q.label, impact: "", category: "tecnico", reason: q.label, evidence: q.evidence, basis: "signal", signal_ref: q.rule_id, affected_dimension: "technical_geo", confidence: 1 }, "Technical GEO", q.rule_id);
  }
  return out;
}

/** 3–5 priorities: priority → severity → weakest affected dimension → confidence. */
export function topPriorities(actions: DisplayAction[], r: AnalysisResult, limit = 5): DisplayAction[] {
  const dimScore = (a: DisplayAction) => {
    const scores = a.dimensions.map((k) => r.score_dimensions?.[k]?.score).filter((s): s is number => typeof s === "number");
    return scores.length ? Math.min(...scores) : 101;
  };
  return [...actions].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3) ||
    (SEVERITY_ORDER[a.severity ?? "info"] ?? 5) - (SEVERITY_ORDER[b.severity ?? "info"] ?? 5) ||
    dimScore(a) - dimScore(b) ||
    (b.confidence ?? 0) - (a.confidence ?? 0),
  ).slice(0, limit);
}

export function groupActionsByDimension(actions: DisplayAction[]): { key: DimensionKey | "other"; label: string; byPriority: Record<"alta" | "media" | "baixa", DisplayAction[]> }[] {
  const keys: (DimensionKey | "other")[] = [...DIMENSION_ORDER, "other"];
  return keys.map((key) => {
    const list = actions.filter((a) => (key === "other" ? a.dimensions.length === 0 : a.dimensions[0] === key));
    return {
      key,
      label: key === "other" ? "Outras" : DIMENSION_LABELS[key],
      byPriority: { alta: list.filter((a) => a.priority === "alta"), media: list.filter((a) => a.priority === "media"), baixa: list.filter((a) => a.priority === "baixa") },
    };
  }).filter((g) => g.byPriority.alta.length + g.byPriority.media.length + g.byPriority.baixa.length > 0);
}

// ---------- Strengths (only real positive signals) ----------
const STRENGTH_PHRASE: Record<DimensionKey, string> = {
  semantic_relevance: "Forte alinhamento com a intenção analisada",
  entity_clarity: "Entidade e oferta comunicadas com clareza",
  evidence_authority: "Afirmações bem sustentadas por evidências",
  citation_readiness: "Alta prontidão para citação",
  technical_geo: "Boa base técnica para sistemas de busca e IA",
};

export function strengthsOf(r: AnalysisResult): string[] {
  const out: string[] = [];
  for (const k of DIMENSION_ORDER) {
    const d = r.score_dimensions?.[k];
    if (d?.available && typeof d.score === "number" && d.score >= 75) out.push(`${STRENGTH_PHRASE[k]} (${Math.round(d.score)})`);
  }
  if (r.entity_clarity?.primary_entity?.status === "clear") {
    out.push(`Entidade principal claramente identificada${r.entity_clarity.primary_entity.value ? `: ${r.entity_clarity.primary_entity.value}` : ""}`);
  }
  const supported = (r.content_claims ?? []).filter((c) => c.support_status === "supported").length;
  if (supported > 0) out.push(`${supported} afirmação(ões) com suporte identificado na página`);
  const rules = r.technical_geo?.rules ?? [];
  const passed = (id: RegExp) => rules.some((x) => id.test(x.id) && x.status === "pass");
  if (passed(/noindex|indexable/i)) out.push("Página indexável (sem bloqueio noindex)");
  if (passed(/json_ld_valid|structured_data_present|schema_page/i)) out.push("Dados estruturados presentes e válidos");
  for (const s of r.strengths ?? []) if (s && !out.includes(s)) out.push(s);
  return out.slice(0, 8);
}

// ---------- Executive summary (deterministic, no new facts) ----------
export function executiveSummary(r: AnalysisResult, priorities: DisplayAction[]): string {
  const dims = DIMENSION_ORDER
    .map((k) => ({ k, d: r.score_dimensions?.[k] }))
    .filter((x) => x.d?.available && typeof x.d.score === "number") as { k: DimensionKey; d: { score: number } }[];
  if (!dims.length) return r.summary ?? "";
  const score = r.content_score !== undefined ? Math.round(r.content_score) : r.score;
  const overall = score >= 75 ? "boa preparação" : score >= 50 ? "preparação moderada" : "preparação limitada";
  const strong = dims.filter((x) => x.d.score >= 75).sort((a, b) => b.d.score - a.d.score).slice(0, 2);
  const weak = dims.filter((x) => x.d.score < 60).sort((a, b) => a.d.score - b.d.score).slice(0, 2);
  const list = (xs: { k: DimensionKey }[]) => xs.map((x) => DIMENSION_LABELS[x.k]).join(" e ");
  const parts = [`Seu conteúdo apresenta ${overall} para sistemas de busca e IA na intenção analisada.`];
  if (strong.length) parts.push(`Os pontos mais fortes estão em ${list(strong)}.`);
  if (weak.length) parts.push(`As maiores limitações estão em ${list(weak)}.`);
  else if (!strong.length) parts.push("Nenhuma dimensão se destaca de forma isolada; há espaço de melhoria em todas.");
  const first = priorities[0];
  if (first) parts.push(`Priorize: ${first.action.replace(/\.$/, "")}.`);
  return parts.join(" ");
}

// ---------- Claims ----------
export function claimCounts(claims: ContentClaim[] = []) {
  const c = { total: claims.length, supported: 0, partially_supported: 0, unsupported: 0, unknown: 0 };
  for (const x of claims) c[x.support_status] = (c[x.support_status] ?? 0) + 1;
  return c;
}
export const CLAIM_STATUS_LABEL: Record<ContentClaim["support_status"], string> = {
  supported: "Com suporte na página",
  partially_supported: "Suporte parcial",
  unsupported: "Sem suporte identificado nesta página",
  unknown: "Não foi possível avaliar",
};
export const SUPPORT_TYPE_LABEL: Record<ContentClaim["support_type"], string> = {
  statistic: "Estatística", reference: "Referência", case: "Caso", testimonial: "Depoimento", certification: "Certificação",
  study: "Estudo", author: "Autor", none: "Nenhum", other: "Outro",
};
export function importantClaims(claims: ContentClaim[] = [], limit = 6): ContentClaim[] {
  const order = { unsupported: 0, partially_supported: 1, unknown: 2, supported: 3 };
  return [...claims].sort((a, b) => order[a.support_status] - order[b.support_status] || b.confidence - a.confidence).slice(0, limit);
}

// ---------- Entities ----------
export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  organization: "Organização", person: "Pessoa", product: "Produto", service: "Serviço", technology: "Tecnologia",
  market: "Mercado", location: "Localização", concept: "Conceito", other: "Outros",
};
const ENTITY_ORDER: EntityType[] = ["organization", "person", "product", "service", "technology", "market", "location", "concept", "other"];
export function groupEntities(list: EntitySignal[] = []) {
  return ENTITY_ORDER
    .map((type) => ({ type, label: ENTITY_TYPE_LABEL[type], items: list.filter((e) => (ENTITY_ORDER.includes(e.type) ? e.type : "other") === type) }))
    .filter((g) => g.items.length > 0);
}

// ---------- Technical GEO ----------
export const RULE_CATEGORY_LABEL: Record<string, string> = {
  crawlability: "Rastreabilidade & Indexação",
  metadata: "Metadados",
  semantic_html: "HTML Semântico",
  structured_data: "Dados Estruturados",
  entity_signals: "Entidade",
  content_accessibility: "Acessibilidade do Conteúdo",
  freshness: "Atualidade",
};
export const RULE_STATUS_LABEL: Record<RuleStatus, string> = {
  pass: "Aprovado", warning: "Atenção", fail: "Falhou", unavailable: "Não medido", not_applicable: "Não aplicável",
};
export const ruleTone = (s: RuleStatus): Tone => (s === "pass" ? "positive" : s === "warning" ? "attention" : s === "fail" ? "problem" : "neutral");

export function groupRules(rules: TechnicalGeoRule[] = []) {
  const keys = [...Object.keys(RULE_CATEGORY_LABEL), ...new Set(rules.map((r) => r.category).filter((c) => !(c in RULE_CATEGORY_LABEL)))];
  return keys.map((k) => {
    const items = rules.filter((r) => r.category === k);
    const count = (s: RuleStatus) => items.filter((r) => r.status === s).length;
    return { key: k, label: RULE_CATEGORY_LABEL[k] ?? k, items, counts: { pass: count("pass"), warning: count("warning"), fail: count("fail"), unavailable: count("unavailable"), not_applicable: count("not_applicable") } };
  }).filter((g) => g.items.length > 0);
}

export const CRAWLER_GROUPS: { key: string; label: string; tokens: string[] }[] = [
  { key: "search", label: "Busca / descoberta", tokens: ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"] },
  { key: "training", label: "Treinamento", tokens: ["GPTBot", "ClaudeBot", "Google-Extended"] },
  { key: "other", label: "Outros", tokens: ["CCBot"] },
];
export const verdictLabel = (v?: string) =>
  v === "allowed" ? "Permitido" : v === "blocked" ? "Bloqueado" : v === "no_rule" ? "Sem regra específica" : "Não medido";

export function crawlerGroups(tg?: TechnicalGeoAudit | null) {
  const list = tg?.ai_crawler_access?.crawlers ?? [];
  const known = new Set(CRAWLER_GROUPS.flatMap((g) => g.tokens));
  return CRAWLER_GROUPS.map((g) => ({
    ...g,
    items: [
      ...g.tokens.map((t) => { const c = list.find((x) => x.token.toLowerCase() === t.toLowerCase()); return { token: t, operator: c?.operator ?? "", verdict: c?.verdict ?? "unavailable", matched_rule: c?.matched_rule ?? null }; }),
      ...(g.key === "other" ? list.filter((c) => !known.has(c.token)).map((c) => ({ token: c.token, operator: c.operator, verdict: c.verdict, matched_rule: c.matched_rule })) : []),
    ],
  }));
}

// ---------- Optimized version ----------
export const sanitizeOptimized = (s?: string | null) =>
  (s ?? "").replace(/[*#_~`>]/g, "").replace(/\n{3,}/g, "\n\n").trim();

// ---------- Persisted row → result (history) ----------
/** Rebuilds a displayable result from a public.analises row. Never invents missing fields. */
export function rowToResult(row: Record<string, any>): AnalysisResult {
  const base: AnalysisResult = {
    score: row.score ?? 0,
    summary: row.summary ?? "",
    strengths: [],
    improvements: [],
    sub_scores: row.sub_scores ?? null,
    compatibility_diagnostic: null as any,
    action_plan: row.action_plan ?? [],
    keywords_analysis: row.keywords_analysis ?? null,
    technical_signals: row.technical_signals ?? null,
  };
  if (row.score_version !== "2.0") return base;
  const tg: TechnicalGeoAudit | null = row.technical_geo_version
    ? {
        technical_geo_version: row.technical_geo_version,
        page_type: { page_type: row.page_type ?? "unknown", confidence: row.page_type_confidence ?? 0, source: row.page_type_source ?? "" },
        score: row.dim_technical_geo ?? 0,
        coverage: row.technical_geo_coverage ?? 0,
        rules: row.technical_geo_rules ?? [],
        critical_issues: row.technical_geo_critical_issues ?? [],
        quick_wins: row.technical_geo_quick_wins ?? [],
        structured_data_recommendations: row.structured_data_recommendations ?? [],
        ai_crawler_access: row.ai_crawler_access ?? null,
      }
    : null;
  return {
    ...base,
    score_version: "2.0",
    content_score: row.content_score ?? undefined,
    content_score_partial: row.content_score_partial === true,
    weights_applied: row.weights_applied ?? undefined,
    score_dimensions: row.score_dimensions ?? undefined,
    entity_clarity: row.entity_clarity ?? undefined,
    entity_signals: row.entity_signals ?? undefined,
    content_claims: row.content_claims ?? undefined,
    evidence_readiness: row.evidence_readiness ?? undefined,
    citation_readiness: row.citation_readiness ?? undefined,
    technical_geo: tg,
  };
}
