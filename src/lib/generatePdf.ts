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
  orange: [249, 115, 22] as [number, number, number],
};

function getScoreColor(score: number): [number, number, number] {
  if (score >= 70) return COLORS.success;
  if (score >= 40) return COLORS.warning;
  return COLORS.danger;
}

function addPageIfNeeded(doc: jsPDF, y: number, needed: number = 20): number {
  if (y + needed > 275) {
    doc.addPage();
    return 20;
  }
  return y;
}

function drawWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    y = addPageIfNeeded(doc, y, lineHeight + 2);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number, color: [number, number, number] = COLORS.primary): number {
  y = addPageIfNeeded(doc, y, 15);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...color);
  doc.text(title, margin, y);
  y += 8;
  return y;
}

/** Draw a radar/spider chart using native jsPDF drawing */
function drawRadarChart(
  doc: jsPDF,
  centerX: number,
  centerY: number,
  radius: number,
  data: { label: string; value: number }[]
) {
  const n = data.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // start from top

  // Draw grid circles and labels
  const gridLevels = [25, 50, 75, 100];
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.2);

  for (const level of gridLevels) {
    const r = (radius * level) / 100;
    // Draw polygon for this level
    const points: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      points.push([centerX + r * Math.cos(angle), centerY + r * Math.sin(angle)]);
    }
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      doc.line(points[i][0], points[i][1], points[next][0], points[next][1]);
    }
  }

  // Draw axis lines
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    doc.line(centerX, centerY, x, y);
  }

  // Draw labels
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const labelR = radius + 8;
    const lx = centerX + labelR * Math.cos(angle);
    const ly = centerY + labelR * Math.sin(angle);
    const align = Math.abs(Math.cos(angle)) < 0.1 ? "center" : Math.cos(angle) > 0 ? "left" : "right";
    doc.text(data[i].label, lx, ly + 1, { align: align as any });
  }

  // Draw data polygon (filled)
  const dataPoints: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const r = (radius * data[i].value) / 100;
    dataPoints.push([centerX + r * Math.cos(angle), centerY + r * Math.sin(angle)]);
  }

  // Fill
  doc.setFillColor(99, 102, 241);
  doc.setGState(new (doc as any).GState({ opacity: 0.25 }));
  const pathFill: number[] = [];
  // Use triangle fan approach
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.8);

  // Build path string manually
  let pathStr = "";
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      pathStr += `${dataPoints[i][0]} ${dataPoints[i][1]} m `;
    } else {
      pathStr += `${dataPoints[i][0]} ${dataPoints[i][1]} l `;
    }
  }
  pathStr += "h f";

  // Simpler approach: draw filled triangles from center
  doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    doc.triangle(
      centerX, centerY,
      dataPoints[i][0], dataPoints[i][1],
      dataPoints[next][0], dataPoints[next][1],
      "F"
    );
  }

  // Draw outline
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(1);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    doc.line(dataPoints[i][0], dataPoints[i][1], dataPoints[next][0], dataPoints[next][1]);
  }

  // Draw dots
  doc.setFillColor(99, 102, 241);
  for (const [px, py] of dataPoints) {
    doc.circle(px, py, 1.2, "F");
  }

  // Draw scale numbers
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.muted);
  for (const level of gridLevels) {
    const r = (radius * level) / 100;
    doc.text(`${level}`, centerX + 1.5, centerY - r - 0.5);
  }
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

  // ====== HEADER ======
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

  // ====== META INFO ======
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  const metaItems: [string, string][] = [
    ["URL:", websiteUrl],
    ["Pesquisa:", `"${searchQuery}"`],
    ["Modo:", mode === "influencer" ? "Influencer / Marca Pessoal" : "Empresa / Empreendimento"],
  ];
  for (const [label, value] of metaItems) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(label) + 3;
    const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
    doc.text(valueLines, margin + labelWidth, y);
    y += valueLines.length * 5 + 2;
  }
  y += 4;

  // ====== SCORE PRINCIPAL ======
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

  // ====== RESUMO ======
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = drawWrappedText(doc, result.summary, margin, y, contentWidth);
  y += 6;

  // ====== RADAR CHART (SPIDER/TEIA) ======
  y = addPageIfNeeded(doc, y, 90);
  y = drawSectionTitle(doc, "Sub-Scores por Dimensão", y, margin);

  const subScoreLabels: Record<string, string> = {
    relevancia_tematica: "Relevância Temática",
    qualidade_conteudo: "Qualidade do Conteúdo",
    autoridade_percebida: "Autoridade Percebida",
    otimizacao_llm: "Otimização LLM",
    clareza_proposta_valor: "Proposta de Valor",
  };

  const radarData = Object.entries(result.sub_scores).map(([key, value]) => ({
    label: subScoreLabels[key] || key,
    value,
  }));

  const chartCenterX = pageWidth / 2;
  const chartCenterY = y + 35;
  const chartRadius = 28;

  drawRadarChart(doc, chartCenterX, chartCenterY, chartRadius, radarData);
  y = chartCenterY + chartRadius + 15;

  // Sub-score values as boxes below the chart
  const boxWidth = (contentWidth - 8) / 3;
  const boxHeight = 14;
  let bx = margin;
  let by = y;
  const entries = Object.entries(result.sub_scores);

  entries.forEach(([key, value], i) => {
    if (i === 3) {
      // Second row: center 2 items
      bx = margin + (contentWidth - boxWidth * 2 - 4) / 2;
      by += boxHeight + 4;
    }

    doc.setFillColor(...COLORS.lightBg);
    doc.roundedRect(bx, by, boxWidth, boxHeight, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    doc.text(subScoreLabels[key] || key, bx + boxWidth / 2, by + 5, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(`${value}`, bx + boxWidth / 2, by + 12, { align: "center" });

    bx += boxWidth + 4;
  });

  y = by + boxHeight + 10;

  // ====== PONTOS FORTES ======
  y = addPageIfNeeded(doc, y, 15);
  y = drawSectionTitle(doc, "Pontos Fortes", y, margin, COLORS.success);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  for (const s of result.strengths) {
    y = addPageIfNeeded(doc, y, 10);
    doc.setTextColor(...COLORS.success);
    doc.text("✓", margin + 2, y);
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, s, margin + 8, y, contentWidth - 10);
    y += 2;
  }
  y += 4;

  // ====== MELHORIAS ======
  y = addPageIfNeeded(doc, y, 15);
  y = drawSectionTitle(doc, "Sugestões de Melhoria", y, margin, COLORS.warning);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  for (const s of result.improvements) {
    y = addPageIfNeeded(doc, y, 10);
    doc.setTextColor(...COLORS.warning);
    doc.text("•", margin + 2, y);
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, s, margin + 8, y, contentWidth - 10);
    y += 2;
  }
  y += 4;

  // ====== DIAGNÓSTICO DE COMPATIBILIDADE ======
  y = addPageIfNeeded(doc, y, 20);
  const compat = result.compatibility_diagnostic;
  const compatColor = compat.compatibility_percentage >= 70 ? COLORS.success : compat.compatibility_percentage >= 40 ? COLORS.warning : COLORS.danger;
  y = drawSectionTitle(doc, `Diagnóstico de Compatibilidade — ${compat.compatibility_percentage}%`, y, margin, compatColor);

  // Conteúdo Atual
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Conteúdo Atual:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  y = drawWrappedText(doc, compat.conteudo_atual, margin + 3, y, contentWidth - 5);
  y += 4;

  // Conteúdo Ideal
  y = addPageIfNeeded(doc, y, 15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Conteúdo Ideal:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  y = drawWrappedText(doc, compat.conteudo_ideal, margin + 3, y, contentWidth - 5);
  y += 4;

  // Gap Analysis
  if (compat.gap_analysis.length > 0) {
    y = addPageIfNeeded(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text("Lacunas Identificadas:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const gap of compat.gap_analysis) {
      y = addPageIfNeeded(doc, y, 10);
      doc.setTextColor(...COLORS.orange);
      doc.text("→", margin + 2, y);
      doc.setTextColor(...COLORS.muted);
      y = drawWrappedText(doc, gap, margin + 8, y, contentWidth - 10);
      y += 2;
    }
  }
  y += 6;

  // ====== PLANO DE AÇÃO ======
  if (result.action_plan.length > 0) {
    y = addPageIfNeeded(doc, y, 15);
    y = drawSectionTitle(doc, "Plano de Ação", y, margin);

    const priorityLabel: Record<string, string> = { alta: "ALTA", media: "MÉDIA", baixa: "BAIXA" };
    const priorityColor: Record<string, [number, number, number]> = {
      alta: COLORS.danger,
      media: COLORS.warning,
      baixa: COLORS.success,
    };
    const categoryLabels: Record<string, string> = {
      conteudo: "Conteúdo",
      tecnico: "Técnico",
      autoridade: "Autoridade",
      estrutura: "Estrutura",
    };

    const sorted = [...result.action_plan].sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      return order[a.priority] - order[b.priority];
    });

    for (const item of sorted) {
      y = addPageIfNeeded(doc, y, 18);
      const pColor = priorityColor[item.priority] || COLORS.muted;

      // Priority badge
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...pColor);
      doc.text(`[${priorityLabel[item.priority] || item.priority}]`, margin, y);

      // Category
      doc.setTextColor(...COLORS.muted);
      doc.text(`${categoryLabels[item.category] || item.category}`, margin + 20, y);

      y += 5;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.dark);
      y = drawWrappedText(doc, item.action, margin + 3, y, contentWidth - 5);
      y += 1;
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      y = drawWrappedText(doc, `Impacto: ${item.impact}`, margin + 3, y, contentWidth - 5);
      y += 5;
    }
    y += 4;
  }

  // ====== PALAVRAS-CHAVE ======
  y = addPageIfNeeded(doc, y, 15);
  y = drawSectionTitle(doc, "Análise de Palavras-chave", y, margin);

  const kwSections: { label: string; items: string[]; color: [number, number, number] }[] = [
    { label: "Encontradas", items: result.keywords_analysis.found, color: COLORS.success },
    { label: "Ausentes", items: result.keywords_analysis.missing, color: COLORS.danger },
    { label: "Sugeridas", items: result.keywords_analysis.suggested, color: COLORS.primary },
  ];

  for (const { label, items, color } of kwSections) {
    if (items.length === 0) continue;
    y = addPageIfNeeded(doc, y, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...color);
    doc.text(`${label}:`, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, items.join(", "), margin + 3, y, contentWidth - 5);
    y += 4;
  }

  // ====== EXEMPLO IDEAL ======
  if (result.ideal_example) {
    y = addPageIfNeeded(doc, y, 20);
    y = drawSectionTitle(doc, "Exemplo Ideal de Conteúdo", y, margin, COLORS.primary);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.muted);
    y = drawWrappedText(doc, "Exemplo de conteúdo otimizado que alcançaria um score próximo a 100%:", margin, y, contentWidth);
    y += 3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, result.ideal_example, margin + 3, y, contentWidth - 5);
    y += 6;
  }

  // ====== FOOTER ======
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
