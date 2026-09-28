// Territory Alignment presentation (pure). Reads only returned/persisted fields; never recalculates and never
// combines with Content Score or Brand Alignment. Reopened history uses territory_snapshot only.
import type { TADimension, TerritoryAwareFields, TerritorySnapshot, TATopicCoverage } from "@/types/territory-alignment";

export const TA_ORDER: TADimension[] = ["core_relevance", "strategic_intent", "topic_coverage", "brand_territory_connection", "evidence_support", "semantic_focus"];
export const TA_LABELS: Record<TADimension, string> = {
  core_relevance: "Relevância central", strategic_intent: "Intenção estratégica", topic_coverage: "Cobertura temática",
  brand_territory_connection: "Conexão marca ↔ território", evidence_support: "Evidências", semantic_focus: "Foco semântico",
};
export const TA_GAP_LABEL: Record<string, string> = {
  missing_topic_opportunity: "Subtópico não explorado", weak_brand_connection: "Conexão fraca com a marca", missing_evidence: "Falta evidência",
  semantic_drift: "Desvio de foco", positioning_gap: "Lacuna de posicionamento", unclear_association: "Associação pouco clara",
  outdated_relation: "Conexão de versão anterior", other: "Outro",
};
export const TA_FINDING_LABEL: Record<string, string> = {
  strong_alignment: "Alinhamento forte", weak_connection: "Conexão fraca", missing_opportunity: "Oportunidade", semantic_drift: "Desvio de foco",
  excluded_concept_conflict: "Conflito com conceito excluído", unsupported_claim: "Afirmação sem evidência ligada", territory_conflict: "Conflito com evidência do território", info: "Observação",
};
export const PRIORITY_SHORT = { primary: "Principal", secondary: "Secundário", exploratory: "Exploratório" } as const;
export const TERRITORY_ALIGNMENT_TOOLTIP = "Quanto este conteúdo contribui para o território estratégico selecionado. Não mede presença real em respostas de IA.";

export const isTerritoryAware = (r: TerritoryAwareFields | null | undefined) => !!r?.territory_alignment_version && !!r?.territory_snapshot;

export function territoryUnavailableNotes(r: TerritoryAwareFields): string[] {
  const d = r.territory_alignment_dimensions; if (!d) return [];
  return TA_ORDER.filter((k) => !d[k]?.available).map((k) => d[k]?.reason || `${TA_LABELS[k]} não entrou no cálculo.`);
}

/** Human text for a territory reference (topic, field or related item) from the snapshot. */
export function territoryRefLabel(ref: string | null, s: TerritorySnapshot | undefined): string | null {
  if (!ref || !s) return null;
  if (ref === "t:core") return s.core_concept ? `Conceito central: ${s.core_concept}` : "Conceito central";
  if (ref === "t:intent") return "Intenção estratégica";
  if (ref === "t:association") return "Associação desejada";
  const t = [...s.included_topics, ...s.excluded_topics, ...s.related_concepts].find((x) => x.id === ref);
  if (t) return t.text;
  return s.relations.find((r) => r.id === ref)?.label ?? null;
}
export function topicTexts(ids: string[], s: TerritorySnapshot | undefined): string[] {
  return ids.map((id) => territoryRefLabel(id, s)).filter((x): x is string => !!x);
}
export const territoryLink = (s: TerritorySnapshot | undefined) => (s ? `/empresas/${s.empresa_id}/territorios/${s.territory_id}` : null);

/** Independent readings; never an average. Wording avoids any promise about AI ranking or citations. */
export function interpretTerritory(content: number, brand: number | null, territory: number | null): string | null {
  if (territory === null) return null;
  const hi = (n: number) => n >= 75, lo = (n: number) => n < 65;
  if (hi(content) && (brand === null || hi(brand)) && lo(territory)) return "O conteúdo é bom e representa a marca, mas contribui pouco para o território escolhido.";
  if (lo(content) && hi(territory)) return "O conteúdo está fortemente ligado ao território, mas ainda tem problemas de construção ou citabilidade.";
  if (hi(territory)) return "O conteúdo contribui de forma clara para o território selecionado.";
  if (lo(territory)) return "O conteúdo contribui pouco para o território selecionado; veja as próximas ações.";
  return "Os três scores medem coisas diferentes; veja cada leitura abaixo.";
}

/** History reopen: territory fields come only from the stored row snapshot. */
// deno-lint-ignore no-explicit-any
export function territoryFieldsFromRow(row: Record<string, any>): TerritoryAwareFields {
  if (!row.territory_alignment_version || !row.territory_snapshot) return {};
  const dims = { ...(row.territory_alignment_dimensions ?? {}) } as Record<string, unknown>;
  const coverage = (dims._topic_coverage ?? undefined) as TATopicCoverage | undefined;
  delete dims._topic_coverage;
  return {
    territory_status: "ok", territory_id: row.territory_id ?? row.territory_snapshot.territory_id, territory_snapshot: row.territory_snapshot,
    territory_alignment_version: row.territory_alignment_version,
    territory_alignment_score: row.territory_alignment_score === null || row.territory_alignment_score === undefined ? null : Number(row.territory_alignment_score),
    territory_alignment_partial: row.territory_alignment_partial === true,
    territory_alignment_weights_applied: row.territory_alignment_weights_applied ?? {},
    territory_alignment_dimensions: dims as TerritoryAwareFields["territory_alignment_dimensions"],
    territory_topic_coverage: coverage,
    territory_findings: row.territory_findings ?? [], territory_strengths: row.territory_strengths ?? [], territory_gaps: row.territory_gaps ?? [],
    territory_next_actions: row.territory_next_actions ?? [], territory_optimized_version: row.territory_optimized_version ?? null,
  };
}

// deno-lint-ignore no-explicit-any
export const territoryHistoryBadge = (row: Record<string, any>): { name: string; score: number | null } | null =>
  row.territory_alignment_version && row.territory_snapshot
    ? { name: row.territory_snapshot.territory_name, score: row.territory_alignment_score === null || row.territory_alignment_score === undefined ? null : Math.round(Number(row.territory_alignment_score)) }
    : null;
