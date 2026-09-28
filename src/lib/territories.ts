// UI side of Strategic Territories. Pure logic lives in the shared module (one implementation for server and UI).
export * from "../../supabase/functions/_shared/territories";
import type { TerritoryBreadth, TerritoryPriority, TerritoryRelationKind, TerritoryType } from "../../supabase/functions/_shared/territories";

export const TYPE_LABEL: Record<TerritoryType, string> = {
  category: "Categoria", problem: "Problema", solution: "Solução", expertise: "Expertise", technology: "Tecnologia", market: "Mercado", concept: "Conceito", other: "Outro",
};
export const PRIORITY_LABEL: Record<TerritoryPriority, string> = { primary: "Primário", secondary: "Secundário", exploratory: "Exploratório" };
export const BREADTH_LABEL: Record<TerritoryBreadth, string> = { broad: "Ampla", balanced: "Equilibrada", narrow: "Específica" };
export const KIND_LABEL: Record<TerritoryRelationKind, string> = {
  positioning: "Posicionamento", offering: "Produto/serviço", problem: "Problema", audience: "Público", differentiator: "Diferencial", claim: "Claim", evidence: "Evidência", entity: "Entidade",
};
export const AUDIT_LABEL: Record<string, string> = {
  territory_created: "Criado", territory_edited: "Editado", territory_priority_changed: "Prioridade alterada", territory_archived: "Arquivado",
  territory_restored: "Restaurado", territory_relation_added: "Relação adicionada", territory_relation_removed: "Relação removida",
  territory_suggestion_accepted: "Sugestão aceita", territory_reviewed: "Conexões revisadas",
};
export const splitList = (s: string) => s.split(/[\n,;]/).map((x) => x.trim()).filter(Boolean);
