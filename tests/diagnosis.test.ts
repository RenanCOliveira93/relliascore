// Frontend presentation tests (bun test). Run: bun test tests/
import { describe, expect, test } from "bun:test";
import type { AnalysisResult, ScoreDimensions, TechnicalGeoAudit } from "../src/types/analysis";
import {
  claimCounts, crawlerGroups, groupEntities, groupRules, mergeActions, rowToResult, strengthsOf, topPriorities,
  weightedBreakdown, executiveSummary, basisLabel, sanitizeOptimized,
} from "../src/lib/diagnosis";
import { buildAnalysisPdfV2, PDF_V2_SECTIONS } from "../src/lib/generatePdfV2";
import { buildLegacyAnalysisPdf } from "../src/lib/generatePdf";

const dim = (score: number | null, weight: number, available = true) =>
  ({ available, score, weight, source: "llm", reason: "motivo", evidence: [], confidence: 0.8 }) as const;

const tg: TechnicalGeoAudit = {
  technical_geo_version: "1", page_type: { page_type: "homepage", confidence: 0.9, source: "url" }, score: 84, coverage: 0.94,
  rules: [
    { id: "indexable", version: "1", category: "crawlability", label: "Indexável", description: "", max_points: 5, status: "pass", score: 5, evidence: "ok", recommendation: null, severity: "high" },
    { id: "json_ld_present", version: "1", category: "structured_data", label: "JSON-LD", description: "", max_points: 5, status: "fail", score: 0, evidence: "ausente", recommendation: "Adicionar JSON-LD", severity: "critical" },
    { id: "author", version: "1", category: "freshness", label: "Autor", description: "", max_points: 3, status: "not_applicable", score: null, evidence: "homepage", recommendation: null, severity: "info" },
    { id: "js_dependency", version: "1", category: "content_accessibility", label: "JS", description: "", max_points: 0, status: "unavailable", score: null, evidence: "não medido", recommendation: null, severity: "info" },
  ],
  critical_issues: [{ rule_id: "json_ld_present", label: "JSON-LD", evidence: "ausente", recommendation: "Adicionar JSON-LD" }],
  quick_wins: [{ rule_id: "meta_description", label: "Meta description", evidence: "curta", recommendation: "Ampliar a description", severity: "low" }],
  structured_data_recommendations: [],
  ai_crawler_access: { status: "ok", note: "nota", crawlers: [{ token: "GPTBot", operator: "OpenAI", category: "training", verdict: "blocked", matched_rule: "Disallow: /" }] },
};

const urlDims: ScoreDimensions = {
  semantic_relevance: dim(82, 0.3), entity_clarity: dim(76, 0.2), evidence_authority: dim(61, 0.2),
  citation_readiness: dim(70, 0.15), technical_geo: dim(84, 0.15),
};

const urlResult = (): AnalysisResult => ({
  score: 75, summary: "s", strengths: [], improvements: [], sub_scores: null as any, compatibility_diagnostic: null as any,
  keywords_analysis: { found: [], missing: [], suggested: [] },
  action_plan: [
    { priority: "media", action: "Adicionar evidências às claims", impact: "", category: "autoridade", affected_dimension: "evidence_authority", basis: "content", confidence: 0.7 },
    { priority: "alta", action: "Adicionar JSON-LD", impact: "", category: "tecnico", affected_dimension: "technical_geo", basis: "signal", signal_ref: "json_ld_present", confidence: 0.9, evidence: "ausente" },
  ],
  score_version: "2.0", content_score: 75.45, content_score_partial: false,
  weights_applied: { semantic_relevance: 0.3, entity_clarity: 0.2, evidence_authority: 0.2, citation_readiness: 0.15, technical_geo: 0.15 },
  score_dimensions: urlDims, technical_geo: tg,
  content_claims: [
    { summary: "Líder do mercado", support_status: "unsupported", support_type: "none", confidence: 0.6 },
    { summary: "10 mil clientes", support_status: "supported", support_type: "statistic", confidence: 0.9 },
  ],
  entity_signals: [
    { name: "ACME", type: "organization", confidence: 0.9, explicit_or_inferred: "explicit" },
    { name: "SaaS", type: "market", confidence: 0.5, explicit_or_inferred: "inferred" },
  ],
});

const textResult = (): AnalysisResult => ({
  ...urlResult(), technical_geo: null, content_score_partial: true, content_score: 72.94,
  weights_applied: { semantic_relevance: 0.3529, entity_clarity: 0.2353, evidence_authority: 0.2353, citation_readiness: 0.1765 },
  score_dimensions: { ...urlDims, technical_geo: dim(null, 0, false) },
});

describe("weights_applied / score breakdown", () => {
  test("uses persisted weights and matches the example math", () => {
    const b = weightedBreakdown(urlResult());
    expect(b.usesPersistedWeights).toBe(true);
    expect(b.weighted).toBe(75.1); // 82×.3+76×.2+61×.2+70×.15+84×.15
    expect(b.rounded).toBe(75);
  });
  test("partial text: Technical GEO is N/D, not zero, and uses redistributed weights", () => {
    const b = weightedBreakdown(textResult());
    const t = b.rows.find((r) => r.key === "technical_geo")!;
    expect(t.available).toBe(false);
    expect(t.score).toBeNull();
    expect(t.contribution).toBeNull();
    expect(b.rows.find((r) => r.key === "semantic_relevance")!.weight).toBe(0.3529);
  });
  test("no persisted weights => no recomputation", () => {
    const r = urlResult(); r.weights_applied = undefined;
    expect(weightedBreakdown(r).weighted).toBeNull();
  });
});

describe("actions", () => {
  test("technical duplicates are collapsed into one action with multiple origins", () => {
    const a = mergeActions(urlResult().action_plan, tg);
    const jsonLd = a.filter((x) => x.action === "Adicionar JSON-LD");
    expect(jsonLd.length).toBe(1);
    expect(jsonLd[0].origins).toEqual(["Plano semântico", "Technical GEO"]);
    expect(a.some((x) => x.action === "Ampliar a description")).toBe(true); // quick win
  });
  test("priorities: alta + critical first, capped", () => {
    const r = urlResult();
    const p = topPriorities(mergeActions(r.action_plan, tg), r, 2);
    expect(p[0].action).toBe("Adicionar JSON-LD");
    expect(p.length).toBe(2);
  });
  test("basis is translated and inference is not hidden", () => {
    expect(basisLabel("signal")).toBe("Detectado na página");
    expect(basisLabel("technical_signal")).toBe("Detectado na página");
    expect(basisLabel("content")).toBe("Identificado no conteúdo");
    expect(basisLabel("inference")).toBe("Avaliação semântica");
  });
});

describe("technical geo", () => {
  test("groups rules and keeps not_applicable/unavailable as their own states", () => {
    const g = groupRules(tg.rules);
    expect(g.map((x) => x.label)).toContain("Atualidade");
    expect(g.find((x) => x.key === "freshness")!.counts.not_applicable).toBe(1);
    expect(g.find((x) => x.key === "content_accessibility")!.counts.unavailable).toBe(1);
    expect(g.find((x) => x.key === "freshness")!.counts.fail).toBe(0);
  });
  test("crawlers split into search/training/other; missing ones are 'not measured'", () => {
    const g = crawlerGroups(tg);
    const training = g.find((x) => x.key === "training")!;
    expect(training.items.find((c) => c.token === "GPTBot")!.verdict).toBe("blocked");
    expect(g.find((x) => x.key === "search")!.items[0].verdict).toBe("unavailable");
  });
});

describe("claims, entities, strengths", () => {
  test("claim counts", () => {
    expect(claimCounts(urlResult().content_claims)).toEqual({ total: 2, supported: 1, partially_supported: 0, unsupported: 1, unknown: 0 });
  });
  test("entities keep explicit vs inferred", () => {
    const g = groupEntities(urlResult().entity_signals);
    expect(g[0].label).toBe("Organização");
    expect(g.find((x) => x.type === "market")!.items[0].explicit_or_inferred).toBe("inferred");
  });
  test("strengths only from real positive signals", () => {
    const s = strengthsOf(urlResult());
    expect(s.some((x) => x.includes("Relevância") || x.includes("intenção"))).toBe(true);
    expect(s.some((x) => x.includes("Dados estruturados"))).toBe(false); // json_ld failed
    expect(s.some((x) => x.includes("indexável"))).toBe(true);
  });
  test("summary mentions weakest dimension and makes no visibility promises", () => {
    const r = urlResult();
    const s = executiveSummary(r, topPriorities(mergeActions(r.action_plan, tg), r));
    expect(s).toContain("Evidência & Autoridade");
    expect(s.toLowerCase()).not.toContain("vai recomendar");
  });
  test("optimized text is sanitized", () => {
    expect(sanitizeOptimized("# Título\n\n\n\n**forte**")).toBe("Título\n\nforte");
  });
});

describe("legacy + history", () => {
  test("legacy rows are not filled with 2.0 data", () => {
    const r = rowToResult({ score: 60, summary: "x", action_plan: [] });
    expect(r.score_version).toBeUndefined();
    expect(r.technical_geo).toBeUndefined();
    expect(r.entity_clarity).toBeUndefined();
  });
  test("2.0 rows rebuild technical geo from persisted columns", () => {
    const r = rowToResult({ score: 75, score_version: "2.0", content_score: 75.45, technical_geo_version: "1", dim_technical_geo: 84, technical_geo_coverage: 0.94, technical_geo_rules: tg.rules, technical_geo_critical_issues: tg.critical_issues, technical_geo_quick_wins: tg.quick_wins });
    expect(r.technical_geo!.score).toBe(84);
    expect(r.technical_geo!.critical_issues.length).toBe(1);
  });
});

describe("pdf", () => {
  test("2.0 PDF contains the new structure", () => {
    const { doc, filename } = buildAnalysisPdfV2(urlResult(), "https://acme.com", "melhor crm", "business");
    const out = doc.output();
    for (const s of PDF_V2_SECTIONS) expect(out).toContain(s.split(". ")[1].slice(0, 10));
    expect(out).toContain("Auditoria Technical GEO completa");
    expect(filename).toMatch(/^Rellia-Relevancia-/);
  });
  test("2.0 text PDF shows Technical GEO as N/D", () => {
    const out = buildAnalysisPdfV2(textResult(), "Texto fornecido", "q", "business").doc.output();
    expect(out).toContain("N/D - n");
  });
  test("legacy PDF still builds", () => {
    const legacy = { ...urlResult(), score_version: undefined, score_dimensions: undefined, technical_geo: null,
      sub_scores: { relevancia_tematica: 60, qualidade_conteudo: 60, autoridade_percebida: 60, otimizacao_llm: 60, clareza_proposta_valor: 60 },
      compatibility_diagnostic: { conteudo_atual: "a", conteudo_ideal: "b", gap_analysis: [], compatibility_percentage: 50 } } as AnalysisResult;
    const { doc } = buildLegacyAnalysisPdf(legacy, "https://acme.com", "q", "business");
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
