// Brand Alignment presentation (pure). Reads only persisted/returned fields; never recalculates, never averages
// with the Content Score. Reopened history uses the stored brand_context_snapshot, never the current Brand Brain.
import type { AnalysisResult } from "@/types/analysis";
import type { BADimension, BrandAwareFields, BrandContextSnapshot } from "@/types/brand-alignment";

export const BA_ORDER: BADimension[] = ["positioning", "offering", "audience_problem", "differentiation", "claim_evidence", "voice"];
export const BA_LABELS: Record<BADimension, string> = {
  positioning: "Posicionamento", offering: "Produtos & Serviços", audience_problem: "Público & Problemas",
  differentiation: "Diferenciais", claim_evidence: "Claims & Evidências", voice: "Voz da marca",
};
export const POSITIONING_STATUS_LABEL = { aligned: "Alinhado", partially_aligned: "Parcialmente alinhado", weak: "Fraco", conflicting: "Em conflito" } as const;
export const CLAIM_CLASS_LABEL: Record<string, string> = {
  supported_by_brand_profile: "Respaldada no Brand Profile", partially_supported: "Parcialmente respaldada",
  not_found_in_brand_profile: "Não encontrada no Brand Profile", conflicts_with_brand_profile: "Conflita com o Brand Profile", not_applicable: "Não se aplica",
};
export const ENTITY_STATUS_LABEL = { consistent: "Consistente", ambiguous: "Ambígua", not_found: "Não encontrada no perfil", conflict: "Conflito" } as const;
export const GAP_TYPE_LABEL = { inconsistency: "Inconsistência", missing_opportunity: "Oportunidade", unknown_to_brand_profile: "Fora do Brand Profile" } as const;
export const BASIS_LABEL = { human_defined: "definido por você", declared: "declarado", observed: "observado", inferred: "inferido" } as const;
export const CONTENT_SCORE_TOOLTIP = "Preparação do conteúdo para a intenção analisada.";
export const BRAND_ALIGNMENT_TOOLTIP = "Alinhamento deste conteúdo ao conhecimento atual e preferencial da marca.";

export const isBrandAware = (r: BrandAwareFields | null | undefined) => !!r?.brand_alignment_version && !!r?.brand_context_snapshot;

/** Two independent readings; never a combined/average score. */
export function interpretScores(content: number, brand: number | null): string | null {
  if (brand === null) return null;
  const hi = (n: number) => n >= 75, lo = (n: number) => n < 60;
  if (hi(content) && lo(brand)) return "O conteúdo está estruturalmente forte para o tema, mas representa apenas parcialmente o posicionamento e os diferenciais definidos para esta marca.";
  if (lo(content) && hi(brand)) return "O conteúdo representa bem a marca, mas ainda apresenta limitações de estrutura, evidência ou citabilidade.";
  if (hi(content) && hi(brand)) return "O conteúdo está bem preparado para o tema e representa bem a marca.";
  if (lo(content) && lo(brand)) return "O conteúdo tem espaço para evoluir tanto na preparação para o tema quanto na representação da marca.";
  return "Content Score e Brand Alignment medem coisas diferentes; veja cada leitura abaixo.";
}

/** Which Brand Profile section a knowledge reference belongs to (for "Ver no Brand Profile"). */
export function profileSectionFor(ref: string | null, s: BrandContextSnapshot | undefined): string | null {
  if (!ref || !s) return null;
  if (ref.startsWith("field:")) return "overview";
  const has = (l: { id: string }[]) => l.some((x) => x.id === ref);
  if (has(s.offerings)) return "offerings";
  if (has(s.audiences) || has(s.problems)) return "audiences";
  if (has(s.differentiators)) return "differentiators";
  if (has(s.claims) || has(s.evidence)) return "claims";
  if (has(s.entities)) return "entities";
  if (s.voice?.id === ref) return "voice";
  return null;
}
export const profileLink = (empresaId: string | undefined, section: string | null) =>
  empresaId ? `/empresas/${empresaId}/brand${section ? `#${section}` : ""}` : null;

export function unavailableNotes(r: BrandAwareFields): string[] {
  const d = r.brand_alignment_dimensions; if (!d) return [];
  return BA_ORDER.filter((k) => !d[k]?.available).map((k) => d[k]?.reason || `${BA_LABELS[k]} não entrou no cálculo.`);
}

/** History reopen: brand fields come only from the stored row (snapshot). */
export function brandFieldsFromRow(row: Record<string, any>): BrandAwareFields {
  if (!row.brand_alignment_version || !row.brand_context_snapshot) return {};
  return {
    brand_aware: true, brand_context_status: "ok", empresa_id: row.empresa_id ?? row.brand_context_snapshot.empresa_id,
    brand_context_snapshot: row.brand_context_snapshot, brand_alignment_version: row.brand_alignment_version,
    brand_alignment_score: row.brand_alignment_score === null || row.brand_alignment_score === undefined ? null : Number(row.brand_alignment_score),
    brand_alignment_partial: row.brand_alignment_partial === true,
    brand_alignment_weights_applied: row.brand_alignment_weights_applied ?? {},
    brand_alignment_dimensions: row.brand_alignment_dimensions ?? undefined,
    brand_alignment_findings: row.brand_alignment_findings ?? [], brand_strengths: row.brand_strengths ?? [], brand_gaps: row.brand_gaps ?? [],
    brand_entity_consistency: row.brand_entity_consistency ?? [], brand_recommendations: row.brand_recommendations ?? [],
    brand_optimized_version: row.brand_optimized_version ?? null,
  };
}

export const historyBadge = (row: Record<string, any>): { company: string | null; score: number | null } | null =>
  row.brand_alignment_version ? { company: row.brand_context_snapshot?.company_name ?? null, score: row.brand_alignment_score === null ? null : Math.round(Number(row.brand_alignment_score)) } : null;

export type { AnalysisResult };
