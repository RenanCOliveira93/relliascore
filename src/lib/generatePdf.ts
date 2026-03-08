import jsPDF from "jspdf";
import type { AnalysisResult } from "@/types/analysis";

const COLORS = {
  primary: [99, 102, 241] as [number, number, number],
  dark: [30, 30, 46] as [number, number, number],
  muted: [120, 120, 140] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  warning: [234, 179, 8] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightBg: [243, 244, 246] as [number, number, number],
};

function getScoreColor(score: number): [number, number, number] {
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.warning;
  return COLORS.danger;
}

function addPageIfNeeded(doc: jsPDF, y: number, margin: number = 40): number {
  if (y > 270) {
    doc.addPage();
    return margin;
  }
  return y;
}

export function generateAnalysisPdf(
  result: AnalysisResult,
  websiteUrl: string,
  searchQuery: string,
  mode: string
): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header bar
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("LLM Score — Relatório de Análise", margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, margin, 26);
  y = 40;

  // Meta info
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("URL:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(websiteUrl, margin + 12, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Pesquisa:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`"${searchQuery}"`, margin + 22, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Modo:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento", margin + 15, y);
  y += 10;

  // Score principal
  const scoreColor = getScoreColor(result.score);
  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Score Geral", margin + 5, y + 9);
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${result.score}/100`, margin + contentWidth - 5, y + 15, { align: "right" });
  y += 30;

  // Resumo
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(result.summary, contentWidth);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 6;

  // Sub-scores
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Sub-Scores", margin, y);
  y += 7;

  const subScoreLabels: Record<string, string> = {
    relevancia_tematica: "Relevância Temática",
    qualidade_conteudo: "Qualidade do Conteúdo",
    autoridade_percebida: "Autoridade Percebida",
    otimizacao_llm: "Otimização para LLM",
    clareza_proposta_valor: "Clareza da Proposta de Valor",
  };

  Object.entries(result.sub_scores).forEach(([key, value]) => {
    y = addPageIfNeeded(doc, y);
    doc.setTextColor(...COLORS.dark);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subScoreLabels[key] || key, margin, y);

    // Bar background
    const barX = margin + 65;
    const barWidth = contentWidth - 80;
    doc.setFillColor(...COLORS.lightBg);
    doc.roundedRect(barX, y - 3.5, barWidth, 5, 2, 2, "F");

    // Bar fill
    const fillColor = getScoreColor(value);
    doc.setFillColor(...fillColor);
    doc.roundedRect(barX, y - 3.5, (barWidth * value) / 100, 5, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...fillColor);
    doc.text(`${value}`, margin + contentWidth - 2, y, { align: "right" });
    y += 8;
  });
  y += 4;

  // Pontos fortes
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.success);
  doc.text("Pontos Fortes", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  result.strengths.forEach((s) => {
    y = addPageIfNeeded(doc, y);
    const lines = doc.splitTextToSize(`✓  ${s}`, contentWidth - 5);
    doc.text(lines, margin + 3, y);
    y += lines.length * 5 + 2;
  });
  y += 4;

  // Melhorias
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.danger);
  doc.text("Melhorias Sugeridas", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  result.improvements.forEach((s) => {
    y = addPageIfNeeded(doc, y);
    const lines = doc.splitTextToSize(`•  ${s}`, contentWidth - 5);
    doc.text(lines, margin + 3, y);
    y += lines.length * 5 + 2;
  });
  y += 4;

  // Diagnóstico de Compatibilidade
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text(`Compatibilidade: ${result.compatibility_diagnostic.compatibility_percentage}%`, margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Conteúdo Atual:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const atualLines = doc.splitTextToSize(result.compatibility_diagnostic.conteudo_atual, contentWidth - 5);
  doc.text(atualLines, margin + 3, y);
  y += atualLines.length * 5 + 4;

  y = addPageIfNeeded(doc, y);
  doc.setFont("helvetica", "bold");
  doc.text("Conteúdo Ideal:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const idealLines = doc.splitTextToSize(result.compatibility_diagnostic.conteudo_ideal, contentWidth - 5);
  doc.text(idealLines, margin + 3, y);
  y += idealLines.length * 5 + 4;

  if (result.compatibility_diagnostic.gap_analysis.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFont("helvetica", "bold");
    doc.text("Lacunas Identificadas:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    result.compatibility_diagnostic.gap_analysis.forEach((gap) => {
      y = addPageIfNeeded(doc, y);
      const lines = doc.splitTextToSize(`—  ${gap}`, contentWidth - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 5 + 2;
    });
  }
  y += 4;

  // Plano de Ação
  if (result.action_plan.length > 0) {
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.primary);
    doc.text("Plano de Ação", margin, y);
    y += 7;

    const priorityLabel: Record<string, string> = { alta: "ALTA", media: "MÉDIA", baixa: "BAIXA" };
    const priorityColor: Record<string, [number, number, number]> = {
      alta: COLORS.danger,
      media: COLORS.warning,
      baixa: COLORS.success,
    };

    result.action_plan.forEach((item, i) => {
      y = addPageIfNeeded(doc, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(priorityColor[item.priority] || COLORS.muted));
      doc.text(`[${priorityLabel[item.priority] || item.priority}]`, margin, y);
      doc.setTextColor(...COLORS.dark);
      const actionLines = doc.splitTextToSize(item.action, contentWidth - 30);
      doc.text(actionLines, margin + 22, y);
      y += actionLines.length * 5 + 1;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.muted);
      doc.text(`Impacto: ${item.impact}`, margin + 22, y);
      y += 7;
    });
    y += 4;
  }

  // Palavras-chave
  y = addPageIfNeeded(doc, y);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.primary);
  doc.text("Palavras-chave", margin, y);
  y += 7;

  const kwSections: { label: string; items: string[]; color: [number, number, number] }[] = [
    { label: "Encontradas", items: result.keywords_analysis.found, color: COLORS.success },
    { label: "Ausentes", items: result.keywords_analysis.missing, color: COLORS.danger },
    { label: "Sugeridas", items: result.keywords_analysis.suggested, color: COLORS.primary },
  ];

  kwSections.forEach(({ label, items, color }) => {
    if (items.length === 0) return;
    y = addPageIfNeeded(doc, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(`${label}:`, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    const joined = items.join(", ");
    const lines = doc.splitTextToSize(joined, contentWidth - 5);
    doc.text(lines, margin + 3, y);
    y += lines.length * 5 + 4;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("LLM Score — llm-score.lovable.app", margin, 290);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 290, { align: "right" });
  }

  doc.save(`llm-score-${new Date().toISOString().slice(0, 10)}.pdf`);
}
