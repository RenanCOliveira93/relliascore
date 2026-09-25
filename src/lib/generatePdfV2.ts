import jsPDF from "jspdf";
import { DIMENSION_LABELS, type AnalysisResult, type CitationKey, type EntityClarityKey } from "@/types/analysis";
import {
  COLORS, addPageIfNeeded, drawSectionTitle, drawWrappedText, extractProfileName, getScoreColor, sanitizeFilename,
} from "./generatePdf";
import {
  basisLabel, claimCounts, CLAIM_STATUS_LABEL, crawlerGroups, DIMENSION_ORDER, executiveSummary, groupActionsByDimension,
  groupRules, importantClaims, mergeActions, RULE_STATUS_LABEL, strengthsOf, topPriorities, verdictLabel, weightedBreakdown,
} from "./diagnosis";

export const PDF_V2_SECTIONS = [
  "1. Resumo executivo", "2. RELLIA Content Score", "3. Cinco dimensões", "4. Principais prioridades", "5. Pontos fortes",
  "6. Clareza da entidade", "7. Evidências", "8. Prontidão para citação", "9. Technical GEO", "10. Plano de ação",
] as const;

const CLARITY: Record<EntityClarityKey, string> = {
  primary_entity: "Entidade principal", entity_name_clear: "Nome", category_clear: "Categoria", offering_clear: "Oferta",
  audience_clear: "Público", problem_clear: "Problema", value_proposition_clear: "Proposta de valor", differentiators_clear: "Diferenciais",
};
const CLARITY_STATE = { clear: "Claro", partial: "Parcial", absent: "Ausente" } as const;
const CITATION: Record<CitationKey, string> = {
  self_contained_facts: "Fatos autocontidos", clear_definitions: "Definições claras", direct_answers: "Respostas diretas",
  contextualized_numbers: "Números contextualizados", descriptive_headings: "Headings descritivos",
  claim_evidence_connection: "Relação afirmação/evidência", extractable_passages: "Trechos extraíveis",
};
const PRI = { alta: "Alta", media: "Média", baixa: "Baixa" } as const;
const pct = (w: number | null) => (w === null ? "-" : `${Math.round(w * 1000) / 10}%`.replace(".", ","));

/** Score 2.0 PDF. Only reads persisted results; never recalculates. */
export function buildAnalysisPdfV2(r: AnalysisResult, source: string, query: string, mode: string): { doc: jsPDF; filename: string } {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210, M = 15, CW = W - M * 2;
  const isText = !r.technical_geo;
  let y: number;

  const body = (t: string, size = 10, color = COLORS.dark, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    y = addPageIfNeeded(doc, y, 10);
    y = drawWrappedText(doc, t, M, y, CW);
  };
  const bullet = (t: string, color = COLORS.dark) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...color);
    y = addPageIfNeeded(doc, y, 10);
    doc.text("-", M + 1, y);
    y = drawWrappedText(doc, t, M + 5, y, CW - 5);
    y += 1;
  };
  const title = (t: string) => { y = addPageIfNeeded(doc, y, 25); y = drawSectionTitle(doc, t, y, M); };

  // Header
  doc.setFillColor(...COLORS.primary); doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(...COLORS.white); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("RELLIA - Diagnóstico de Conteúdo", M, 18);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Metodologia Score 2.0 - gerado em ${new Date().toLocaleDateString("pt-BR")}`, M, 26);
  y = 42;
  body(`${isText ? "Conteúdo" : "Página"}: ${isText ? "Texto fornecido (pré-publicação)" : source}`, 10);
  body(`Intenção analisada: "${query}"`, 10);
  body(`Modo: ${mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento"}`, 10);
  y += 4;

  const actions = mergeActions(r.action_plan, r.technical_geo);
  const priorities = topPriorities(actions, r, 5);

  title(PDF_V2_SECTIONS[0]);
  body(executiveSummary(r, priorities));
  y += 4;

  title(PDF_V2_SECTIONS[1]);
  const score = Math.round(r.content_score ?? r.score);
  doc.setFillColor(...COLORS.lightBg); doc.roundedRect(M, y, CW, 20, 3, 3, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...COLORS.dark);
  doc.text(r.content_score_partial ? "Content Score (parcial)" : "Content Score", M + 5, y + 12);
  doc.setFontSize(26); doc.setTextColor(...getScoreColor(score)); doc.text(`${score}/100`, M + CW - 5, y + 14, { align: "right" });
  y += 26;
  body("Mede o quanto o conteúdo está preparado para comunicar tema, entidade, evidências e estrutura a sistemas de busca e IA. Não representa a frequência com que IAs recomendam a marca.", 8, COLORS.muted, "italic");
  if (r.content_score_partial) body("Score parcial: Technical GEO não se aplica a textos pré-publicação; os pesos foram redistribuídos entre as dimensões de conteúdo.", 8, COLORS.muted, "italic");
  y += 4;

  title(PDF_V2_SECTIONS[2]);
  const bd = weightedBreakdown(r);
  for (const k of DIMENSION_ORDER) {
    const d = r.score_dimensions?.[k];
    const row = bd.rows.find((x) => x.key === k)!;
    const na = !d || !d.available || d.score === null;
    body(`${DIMENSION_LABELS[k]}: ${na ? "N/D - não aplicável" : `${Math.round(d!.score as number)} (peso ${pct(row.weight)})`}`, 10, COLORS.dark, "bold");
    if (d?.reason) body(d.reason, 9, COLORS.muted);
    y += 1;
  }
  if (bd.usesPersistedWeights) body(`Resultado ponderado: ${bd.weighted?.toFixed(2).replace(".", ",")} -> ${bd.rounded}`, 9, COLORS.muted);
  y += 4;

  title(PDF_V2_SECTIONS[3]);
  if (!priorities.length) body("Nenhuma ação prioritária identificada.", 10, COLORS.muted);
  priorities.forEach((a, i) => {
    body(`${i + 1}. ${a.action}`, 10, COLORS.dark, "bold");
    body(`Prioridade ${PRI[a.priority]} - ${a.dimensions.map((d) => DIMENSION_LABELS[d]).join(", ") || "Geral"} - ${basisLabel(a.basis)}${typeof a.confidence === "number" ? ` - confiança ${Math.round(a.confidence * 100)}%` : ""}`, 8, COLORS.muted);
    if (a.reason) body(`Motivo: ${a.reason}`, 9);
    if (a.evidence) body(`Evidência: ${a.evidence}`, 9, COLORS.muted);
    y += 2;
  });
  y += 2;

  title(PDF_V2_SECTIONS[4]);
  const strengths = strengthsOf(r);
  if (!strengths.length) body("Nenhum ponto forte destacado nesta análise.", 10, COLORS.muted);
  strengths.forEach((s) => bullet(s));
  y += 4;

  title(PDF_V2_SECTIONS[5]);
  if (r.entity_clarity) {
    for (const k of Object.keys(CLARITY) as EntityClarityKey[]) {
      const it = r.entity_clarity[k]; if (!it) continue;
      bullet(`${CLARITY[k]}: ${CLARITY_STATE[it.status]}${it.value ? ` - ${it.value}` : ""}`);
    }
  } else body("Dados não disponíveis nesta análise.", 10, COLORS.muted);
  y += 4;

  title(PDF_V2_SECTIONS[6]);
  const cc = claimCounts(r.content_claims);
  body(`Afirmações encontradas: ${cc.total} - com suporte: ${cc.supported} - parciais: ${cc.partially_supported} - sem suporte: ${cc.unsupported} - desconhecidas: ${cc.unknown}`, 10);
  body("Avalia se a própria página apresenta suporte para a afirmação. Não é verificação externa de veracidade.", 8, COLORS.muted, "italic");
  importantClaims(r.content_claims).forEach((c) => bullet(`${c.summary} (${CLAIM_STATUS_LABEL[c.support_status]})`));
  y += 4;

  title(PDF_V2_SECTIONS[7]);
  body("Mede se fatos, definições e respostas estão estruturados para extração. Não garante citação por IAs.", 8, COLORS.muted, "italic");
  if (r.citation_readiness) {
    (Object.entries(r.citation_readiness.factors) as [CitationKey, { score: number }][]).forEach(([k, f]) => bullet(`${CITATION[k] ?? k}: ${Math.round(f.score)}`));
  }
  y += 4;

  title(PDF_V2_SECTIONS[8]);
  const tg = r.technical_geo;
  if (!tg) body("N/D - não se aplica a textos pré-publicação.", 10, COLORS.muted);
  else {
    body(`Nota ${Math.round(tg.score)} - cobertura ${Math.round(tg.coverage * 100)}% - tipo de página: ${tg.page_type.page_type}`, 10);
    body("Problemas críticos", 10, COLORS.dark, "bold");
    if (!tg.critical_issues.length) body("Nenhum problema técnico crítico identificado.", 9, COLORS.muted);
    tg.critical_issues.forEach((c) => bullet(`${c.label}: ${c.recommendation ?? c.evidence}`));
    body("Ganhos rápidos", 10, COLORS.dark, "bold");
    tg.quick_wins.forEach((q) => bullet(`${q.label}: ${q.recommendation ?? q.evidence}`));
    if (tg.ai_crawler_access) {
      body("Acesso de crawlers (apenas robots.txt; não garante indexação ou citação)", 10, COLORS.dark, "bold");
      crawlerGroups(tg).forEach((g) => bullet(`${g.label}: ${g.items.map((c) => `${c.token} ${verdictLabel(c.verdict).toLowerCase()}`).join(", ")}`));
    }
  }
  y += 4;

  title(PDF_V2_SECTIONS[9]);
  groupActionsByDimension(actions).forEach((g) => {
    body(g.label, 10, COLORS.dark, "bold");
    (["alta", "media", "baixa"] as const).forEach((p) => g.byPriority[p].forEach((a) => bullet(`[${PRI[p]}] ${a.action}`)));
    y += 1;
  });

  if (tg && tg.rules.length) {
    doc.addPage(); y = 20;
    title("Anexo - Auditoria Technical GEO completa");
    groupRules(tg.rules).forEach((g) => {
      body(g.label, 10, COLORS.dark, "bold");
      g.items.forEach((rule) => bullet(`${rule.label}: ${RULE_STATUS_LABEL[rule.status]}${rule.score !== null ? ` (${rule.score}/${rule.max_points})` : ""}`));
    });
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...COLORS.muted);
    doc.text("RELLIA - relliascore.lovable.app - Score 2.0", M, 290);
    doc.text(`Página ${i} de ${pages}`, W - M, 290, { align: "right" });
  }
  const date = new Date().toISOString().slice(0, 10);
  return { doc, filename: sanitizeFilename(`Rellia-Relevancia-${extractProfileName(source)}-${date}.pdf`) };
}
