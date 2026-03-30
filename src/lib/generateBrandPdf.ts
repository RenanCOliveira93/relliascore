import jsPDF from "jspdf";
import type { BrandAnalysisResult } from "@/types/brand-analysis";

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

function addPageIfNeeded(doc: jsPDF, y: number, needed: number = 20): number {
  if (y + needed > 275) {
    doc.addPage();
    return 20;
  }
  return y;
}

function drawWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5): number {
  const clean = text?.replace(/[*#_~`>]/g, "").replace(/\n{3,}/g, "\n\n").trim() || "";
  const lines = doc.splitTextToSize(clean, maxWidth);
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

export function generateBrandPdf(result: BrandAnalysisResult, mode: string): void {
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  // Header
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RELLIA — Análise de Marca", margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} • ${mode === "influencer" ? "Influencer" : "Empresa"}`, margin, 26);
  y = 40;

  // Score
  const scoreColor = result.consistencia_score >= 70 ? COLORS.success : result.consistencia_score >= 40 ? COLORS.warning : COLORS.danger;
  doc.setFillColor(...COLORS.lightBg);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.dark);
  doc.text("Consistência da Marca", margin + 5, y + 9);
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${result.consistencia_score}%`, margin + contentWidth - 5, y + 15, { align: "right" });
  y += 30;

  // Resumo
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  y = drawWrappedText(doc, result.resumo_marca, margin, y, contentWidth);
  y += 6;

  // Identity cards
  const identityItems: [string, string][] = [
    ["Tom de Voz:", result.tom_de_voz],
    ["Público-alvo:", result.publico_alvo],
    ["Nicho:", result.nicho],
    ["Estilo Visual:", result.estilo_visual],
    ["Diferencial:", result.diferencial],
  ];
  y = drawSectionTitle(doc, "Identidade da Marca", y, margin);
  doc.setFontSize(10);
  for (const [label, value] of identityItems) {
    y = addPageIfNeeded(doc, y, 12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.dark);
    doc.text(label, margin, y);
    const lw = doc.getTextWidth(label) + 3;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.muted);
    y = drawWrappedText(doc, value, margin + lw, y, contentWidth - lw);
    y += 2;
  }
  y += 4;

  // Colors
  if (result.cores_marca?.length > 0) {
    y = drawSectionTitle(doc, "Paleta de Cores", y, margin);
    y = addPageIfNeeded(doc, y, 20);
    let cx = margin;
    for (const cor of result.cores_marca) {
      if (cx + 24 > margin + contentWidth) {
        cx = margin;
        y += 22;
        y = addPageIfNeeded(doc, y, 20);
      }
      const rgb = hexToRgb(cor.hex);
      doc.setFillColor(...rgb);
      doc.roundedRect(cx, y, 18, 12, 2, 2, "F");
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.muted);
      doc.text(cor.hex, cx + 9, y + 16, { align: "center" });
      doc.text(cor.nome, cx + 9, y + 19, { align: "center" });
      cx += 24;
    }
    y += 24;
  }

  // Keywords
  if (result.palavras_chave?.length > 0) {
    y = drawSectionTitle(doc, "Palavras-chave da Marca", y, margin);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, result.palavras_chave.join(", "), margin, y, contentWidth);
    y += 6;
  }

  // Posicionamento
  y = drawSectionTitle(doc, "Posicionamento", y, margin);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  y = drawWrappedText(doc, result.posicionamento, margin, y, contentWidth);
  y += 4;

  // Comunicação
  y = drawSectionTitle(doc, "Análise de Comunicação", y, margin);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  y = drawWrappedText(doc, result.comunicacao_analise, margin, y, contentWidth);
  y += 4;

  // Presença Digital
  y = drawSectionTitle(doc, "Presença Digital", y, margin);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.dark);
  y = drawWrappedText(doc, result.presenca_digital, margin, y, contentWidth);
  y += 6;

  // Pontos Fortes
  y = drawSectionTitle(doc, "Pontos Fortes", y, margin, COLORS.success);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const s of result.pontos_fortes) {
    y = addPageIfNeeded(doc, y, 10);
    doc.setTextColor(...COLORS.success);
    doc.text("✓", margin + 2, y);
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, s, margin + 8, y, contentWidth - 10);
    y += 2;
  }
  y += 4;

  // Pontos Fracos
  y = drawSectionTitle(doc, "Pontos Fracos", y, margin, COLORS.danger);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const s of result.pontos_fracos) {
    y = addPageIfNeeded(doc, y, 10);
    doc.setTextColor(...COLORS.danger);
    doc.text("✗", margin + 2, y);
    doc.setTextColor(...COLORS.dark);
    y = drawWrappedText(doc, s, margin + 8, y, contentWidth - 10);
    y += 2;
  }
  y += 4;

  // Temas Sugeridos
  if (result.temas_sugeridos?.length > 0) {
    y = drawSectionTitle(doc, "Temas Sugeridos para Conteúdo", y, margin);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const t of result.temas_sugeridos) {
      y = addPageIfNeeded(doc, y, 10);
      doc.setTextColor(...COLORS.primary);
      doc.text("•", margin + 2, y);
      doc.setTextColor(...COLORS.dark);
      y = drawWrappedText(doc, t, margin + 8, y, contentWidth - 10);
      y += 2;
    }
    y += 4;
  }

  // Recomendações
  if (result.recomendacoes?.length > 0) {
    y = drawSectionTitle(doc, "Recomendações Estratégicas", y, margin);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    result.recomendacoes.forEach((r, i) => {
      y = addPageIfNeeded(doc, y, 10);
      doc.setTextColor(...COLORS.primary);
      doc.text(`${i + 1}.`, margin + 2, y);
      doc.setTextColor(...COLORS.dark);
      y = drawWrappedText(doc, r, margin + 10, y, contentWidth - 12);
      y += 2;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("RELLIA — relliascore.lovable.app", margin, 290);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, 290, { align: "right" });
  }

  doc.save(`rellia-marca-${new Date().toISOString().slice(0, 10)}.pdf`);
}
