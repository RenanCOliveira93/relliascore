// History snapshot round-trip (bun test). No database access: builds the exact row the backend
// inserts and reopens it the way the history screen does. No permanent test data is created.
import { describe, expect, test } from "bun:test";
import type { AnalysisResult, ScoreDimensions, TechnicalGeoAudit } from "../src/types/analysis";
import { executiveSummary, mergeActions, missingSnapshotParts, rowToResult, strengthsOf, topPriorities, weightedBreakdown } from "../src/lib/diagnosis";
import { buildAnalysisPdfV2 } from "../src/lib/generatePdfV2";
import { buildAnaliseRow, normalizeRequestId, type PersistContext } from "../supabase/functions/_shared/persist";

const dim = (score: number | null, weight: number, available = true) =>
  ({ available, score, weight, source: "llm", reason: "motivo", evidence: [], confidence: 0.8 }) as const;

const tg: TechnicalGeoAudit = {
  technical_geo_version: "1", page_type: { page_type: "homepage", confidence: 0.9, source: "url" }, score: 84, coverage: 0.94,
  rules: [{ id: "json_ld_present", version: "1", category: "structured_data", label: "JSON-LD", description: "", max_points: 5, status: "fail", score: 0, evidence: "ausente", recommendation: "Adicionar JSON-LD", severity: "critical" }],
  critical_issues: [{ rule_id: "json_ld_present", label: "JSON-LD", evidence: "ausente", recommendation: "Adicionar JSON-LD" }],
  quick_wins: [], structured_data_recommendations: [],
  ai_crawler_access: { status: "ok", note: "n", crawlers: [{ token: "GPTBot", operator: "OpenAI", category: "training", verdict: "blocked", matched_rule: "Disallow: /" }] },
};
const dims: ScoreDimensions = {
  semantic_relevance: dim(82, 0.3), entity_clarity: dim(76, 0.2), evidence_authority: dim(61, 0.2),
  citation_readiness: dim(70, 0.15), technical_geo: dim(84, 0.15),
};
const compat = { conteudo_atual: "atual", conteudo_ideal: "ideal", gap_analysis: ["gap 1"], compatibility_percentage: 64 };

const live = (): AnalysisResult & Record<string, any> => ({
  status: "success", schema_version: "p0.2", score: 75, summary: "Resumo", strengths: ["Título claro"], improvements: ["Mais dados"],
  sub_scores: { a: 1 } as any, compatibility_diagnostic: compat, ideal_example: "Texto otimizado da execução",
  keywords_analysis: { found: ["crm"], missing: ["preço"], suggested: [] },
  action_plan: [{ priority: "alta", action: "Adicionar JSON-LD", impact: "", category: "tecnico", affected_dimension: "technical_geo", basis: "signal", signal_ref: "json_ld_present", confidence: 0.9 }],
  score_version: "2.0", content_score: 75.1, content_score_partial: false,
  weights_applied: { semantic_relevance: 0.3, entity_clarity: 0.2, evidence_authority: 0.2, citation_readiness: 0.15, technical_geo: 0.15 },
  score_dimensions: dims, technical_geo: tg,
  entity_clarity: { brand: { status: "clear", evidence: "ACME", confidence: 0.9 } } as any,
  content_claims: [{ summary: "10 mil clientes", support_status: "supported", support_type: "statistic", confidence: 0.9 }],
  entity_signals: [{ name: "ACME", type: "organization", confidence: 0.9, explicit_or_inferred: "explicit" }],
  evidence_readiness: { score: 61, factors: {} } as any, citation_readiness: { score: 70, factors: { direct_answer: { score: 70 } } } as any,
});

const ctxUrl: PersistContext = { userId: "user-a", workspaceId: "ws-a", empresaId: null, origem: "app", inputType: "webpage", mode: "business", searchQuery: "melhor crm", websiteUrl: "https://acme.com/", requestId: "9b2f6c1e-1111-4a2b-9c3d-000000000001" };
const ctxText: PersistContext = { ...ctxUrl, inputType: "text", websiteUrl: "https://should-not-be-used.com", requestId: "9b2f6c1e-1111-4a2b-9c3d-000000000002" };
const reopen = (row: Record<string, unknown>) => rowToResult({ id: "row-1", created_at: "2026-09-25", ...row });

describe("persistence", () => {
  test("URL analysis from the app is persisted with workspace, origin and versions", () => {
    const row = buildAnaliseRow(live(), ctxUrl)!;
    expect(row.origem).toBe("app");
    expect(row.workspace_id).toBe("ws-a");
    expect(row.user_id).toBe("user-a");
    expect(row.website_url).toBe("https://acme.com/");
    expect(row.score_version).toBe("2.0");
    expect(row.technical_geo_version).toBe("1");
    expect(row.schema_version).toBe("p0.2");
    expect(row.weights_applied).toEqual(live().weights_applied);
  });
  test("text analysis is persisted without URL and without the raw text", () => {
    const row = buildAnaliseRow({ ...live(), technical_geo: null }, ctxText)!;
    expect(row.input_type).toBe("text");
    expect(row.website_url).toBeNull();
    expect(Object.keys(row)).not.toContain("content");
    expect(JSON.stringify(row)).not.toContain("should-not-be-used");
  });
  test("failed analyses are never persisted", () => {
    for (const status of ["crawl_failed", "analysis_failed", "invalid_url", "timeout", "unsupported_content"]) {
      expect(buildAnaliseRow({ status, score: 50 }, ctxUrl)).toBeNull();
    }
  });
  test("idempotency key is stored and malformed keys are dropped", () => {
    expect(buildAnaliseRow(live(), ctxUrl)!.request_id).toBe(ctxUrl.requestId);
    expect(normalizeRequestId("x")).toBeNull();
    expect(normalizeRequestId("'; drop table--")).toBeNull();
    expect(normalizeRequestId(crypto.randomUUID())).not.toBeNull();
    // Same execution → identical key → the unique index (user_id, request_id) rejects the second insert.
    expect(buildAnaliseRow(live(), ctxUrl)!.request_id).toBe(buildAnaliseRow(live(), ctxUrl)!.request_id);
  });
  test("strengths, optimized version and current × ideal are persisted", () => {
    const row = buildAnaliseRow(live(), ctxUrl)!;
    expect(row.strengths).toEqual(["Título claro"]);
    expect(row.optimized_version).toBe("Texto otimizado da execução");
    expect(row.current_vs_ideal).toEqual(compat);
  });
});

describe("reopening from history", () => {
  const original = live();
  const r = reopen(buildAnaliseRow(original, ctxUrl)!);
  test("reproduces dimensions and weights", () => {
    expect(r.score_dimensions).toEqual(dims);
    expect(r.weights_applied).toEqual(original.weights_applied);
    expect(r.content_score).toBe(75.1);
  });
  test("reproduces Technical GEO incl. crawler access, page type and coverage", () => {
    expect(r.technical_geo).toEqual(tg);
  });
  test("reproduces plan, strengths, optimized version, current × ideal, claims and entities", () => {
    expect(r.action_plan).toEqual(original.action_plan);
    expect(r.strengths).toEqual(original.strengths);
    expect(r.ideal_example).toBe(original.ideal_example);
    expect(r.compatibility_diagnostic).toEqual(compat);
    expect(r.content_claims).toEqual(original.content_claims);
    expect(r.entity_signals).toEqual(original.entity_signals);
    expect(r.keywords_analysis).toEqual(original.keywords_analysis);
    expect(missingSnapshotParts(r)).toEqual([]);
  });
  test("executive diagnosis is rebuilt identically", () => {
    const pl = topPriorities(mergeActions(original.action_plan, original.technical_geo), original, 5);
    const pr = topPriorities(mergeActions(r.action_plan, r.technical_geo), r, 5);
    expect(executiveSummary(r, pr)).toEqual(executiveSummary(original, pl));
    expect(weightedBreakdown(r)).toEqual(weightedBreakdown(original));
    expect(strengthsOf(r)).toEqual(strengthsOf(original));
  });
  test("PDF from history matches the PDF right after the analysis", () => {
    const a = buildAnalysisPdfV2(original, "https://acme.com/", "melhor crm", "business");
    const b = buildAnalysisPdfV2(r, "https://acme.com/", "melhor crm", "business");
    const strip = (s: string) => s.replace(/\/CreationDate \(.*?\)/g, "").replace(/\/ID \[.*?\]/g, "");
    expect(strip(b.doc.output())).toBe(strip(a.doc.output()));
    expect(b.filename).toBe(a.filename);
  });
  test("text analysis reopens without URL and with Technical GEO absent", () => {
    const t = reopen(buildAnaliseRow({ ...live(), technical_geo: null, content_score_partial: true }, ctxText)!);
    expect(t.technical_geo).toBeNull();
    expect(t.content_score_partial).toBe(true);
  });
  test("older 2.0 rows without the new fields show absence instead of invented data", () => {
    const row = buildAnaliseRow(live(), ctxUrl)!;
    delete row.strengths; delete row.optimized_version; delete row.current_vs_ideal;
    const old = reopen(row);
    expect(old.strengths).toEqual([]);
    expect(old.ideal_example).toBeUndefined();
    expect(old.compatibility_diagnostic).toBeNull();
    expect(missingSnapshotParts(old)).toEqual(["pontos fortes", "versão otimizada", "atual × ideal"]);
  });
  test("live results never report missing snapshot parts", () => {
    expect(missingSnapshotParts(live())).toEqual([]);
  });
});
