// Brand Profile presentation logic (pure). The precedence rule itself lives in the shared, dependency-free
// module below (also used server-side by brand-context.ts) — do not re-implement in components.
import type {
  BrandBrainVersion, BrandSource, BrandSourceStatus, BrandSourceStatusValue, BrandOffering, BrandAudience, BrandProblem,
  BrandDifferentiator, BrandClaim, BrandEvidence, BrandEntity, BrandPositioning, BrandVoice, BrandVisualIdentity,
  BrandKnowledgeStatus, BrandFieldOverride, ClaimEvidenceRelationship, BrandBrainCompleteness, BrandProfileView,
} from "@/types/brand-brain";
import { activeItems, knowledgeStatus as sharedStatus, precedenceRank, type RankedItem as SharedRanked } from "../../supabase/functions/_shared/brand-precedence";

export interface RankedItem extends SharedRanked { source_type: BrandSource["source_type"]; sources: BrandSource[] }
export const knowledgeStatus = (i: SharedRanked): BrandKnowledgeStatus => sharedStatus(i);
export { activeItems, precedenceRank };
export const rejectedItems = <T extends RankedItem>(items: T[]): T[] => items.filter((i) => i.human_status === "rejected");
/** The extracted observation a human correction replaced (kept for provenance). */
export const supersededObservation = <T extends RankedItem>(items: T[], edit: T): T | null =>
  edit.supersedes_id ? items.find((i) => i.id === edit.supersedes_id) ?? null : null;

export type FieldValue = string | string[] | null;
export interface PreferredField { value: FieldValue; observed: FieldValue; status: "user_edit" | "human_confirmed" | "observed" | "empty"; override: BrandFieldOverride | null }
export function preferredField(brain: BrandBrainVersion, overrides: BrandFieldOverride[], field: BrandFieldOverride["field"]): PreferredField {
  const observed = (brain[field as keyof BrandBrainVersion] ?? null) as FieldValue;
  const o = overrides.find((x) => x.field === field) ?? null;
  const empty = observed === null || (Array.isArray(observed) && observed.length === 0);
  if (o?.status === "user_edit") return { value: o.value as FieldValue, observed, status: "user_edit", override: o };
  if (o?.status === "confirmed") return { value: observed, observed, status: "human_confirmed", override: o };
  return { value: empty ? null : observed, observed, status: empty ? "empty" : "observed", override: null };
}

export const normKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const tokens = (s: string) => new Set(normKey(s).split(" ").filter((w) => w.length > 2));
export function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

export interface PositioningComparison { declared: BrandPositioning | null; observed: BrandPositioning | null; verdict: "consistent" | "different" | "insufficient"; message: string | null }
/** Human edits of positioning count as declared (what the company states about itself). Never labelled as an error. */
export function comparePositioning(items: BrandPositioning[]): PositioningComparison {
  const act = activeItems(items);
  const declared = act.find((p) => p.kind === "declared") ?? null;
  const observed = act.find((p) => p.kind === "observed") ?? null;
  if (!declared || !observed) return { declared, observed, verdict: "insufficient", message: null };
  const catEq = !!declared.primary_category && !!observed.primary_category && normKey(declared.primary_category) === normKey(observed.primary_category);
  const stmtSim = declared.statement && observed.statement ? similarity(declared.statement, observed.statement) : 0;
  if (catEq || stmtSim >= 0.5) return { declared, observed, verdict: "consistent", message: "Boa consistência entre posicionamento declarado e observado." };
  return { declared, observed, verdict: "different", message: "Existe uma diferença de posicionamento que pode valer a pena revisar." };
}

export function completeness(v: Pick<BrandProfileView, "positioning_items" | "offerings" | "audiences" | "problems" | "differentiators" | "claims" | "evidence" | "voice" | "visual_identity">): BrandBrainCompleteness {
  const areas: BrandBrainCompleteness["areas"] = [
    { key: "positioning", label: "Posicionamento", filled: activeItems(v.positioning_items).length > 0 },
    { key: "offerings", label: "Produtos & Serviços", filled: activeItems(v.offerings).length > 0 },
    { key: "audiences", label: "Públicos", filled: activeItems(v.audiences).length > 0 },
    { key: "problems", label: "Problemas", filled: activeItems(v.problems).length > 0 },
    { key: "differentiators", label: "Diferenciais", filled: activeItems(v.differentiators).length > 0 },
    { key: "claims", label: "Claims", filled: activeItems(v.claims).length > 0 },
    { key: "evidence", label: "Evidências", filled: activeItems(v.evidence).length > 0 },
    { key: "voice", label: "Voz", filled: activeItems(v.voice).length > 0 },
    { key: "visual_identity", label: "Identidade visual", filled: activeItems(v.visual_identity).length > 0 },
  ];
  const filled = areas.filter((a) => a.filled).length;
  return { filled, total: areas.length, areas, label: `${filled} de ${areas.length} áreas possuem informações.` };
}

export const confidenceLabel = (c: number): "alta" | "média" | "baixa" => (c >= 0.75 ? "alta" : c >= 0.45 ? "média" : "baixa");

export const SOURCE_LABELS: Record<BrandSourceStatus["source"], string> = { website: "Site", linkedin: "LinkedIn", instagram: "Instagram", user_description: "Descrição fornecida" };
export const SOURCE_STATUS_LABELS: Record<BrandSourceStatusValue, string> = {
  fetched: "analisado", blocked: "bloqueado por segurança", login_required: "login necessário", unavailable: "indisponível", invalid: "endereço inválido", not_provided: "não informado",
};
export const sourceLine = (s: BrandSourceStatus) => `${SOURCE_LABELS[s.source]} — ${s.source === "user_description" && s.status === "fetched" ? "analisada" : SOURCE_STATUS_LABELS[s.status]}`;

export const STATUS_LABELS: Record<BrandKnowledgeStatus, string> = {
  observed: "Observado", declared: "Declarado", inferred: "Inferido", user_edit: "Definido por você", human_confirmed: "Confirmado por você", rejected: "Rejeitado",
};

export const SOURCE_TYPE_LABELS: Record<BrandSource["source_type"], string> = {
  website: "Site", linkedin: "LinkedIn", instagram: "Instagram", user_description: "Descrição fornecida", user_edit: "Edição sua", existing_brand_analysis: "Análise de marca anterior",
};

export function evidenceForClaim(claimId: string, links: ClaimEvidenceRelationship[], evidence: BrandEvidence[]): { link: ClaimEvidenceRelationship; evidence: BrandEvidence }[] {
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return links.filter((l) => l.claim_id === claimId && byId.has(l.evidence_id)).map((l) => ({ link: l, evidence: byId.get(l.evidence_id)! }));
}

export const ENTITY_GROUPS: { type: BrandEntity["entity_type"]; label: string }[] = [
  { type: "organization", label: "Organizações" }, { type: "person", label: "Pessoas" }, { type: "product", label: "Produtos" },
  { type: "service", label: "Serviços" }, { type: "technology", label: "Tecnologias" }, { type: "market", label: "Mercados" },
  { type: "location", label: "Localizações" }, { type: "customer", label: "Clientes" }, { type: "partner", label: "Parceiros" },
  { type: "concept", label: "Conceitos" }, { type: "other", label: "Outras" },
];
export function groupEntities(entities: BrandEntity[]) {
  const act = activeItems(entities);
  return ENTITY_GROUPS.map((g) => ({ ...g, items: act.filter((e) => e.entity_type === g.type) })).filter((g) => g.items.length);
}

/** Groups differentiators as declared / observed / inferred (human-defined ones go with declared). */
export function groupDifferentiators(items: BrandDifferentiator[]) {
  const act = activeItems(items);
  const st = (d: BrandDifferentiator) => knowledgeStatus(d);
  return {
    declared: act.filter((d) => ["declared", "user_edit"].includes(st(d)) || (st(d) === "human_confirmed" && d.source_type === "user_description")),
    observed: act.filter((d) => st(d) === "observed" || (st(d) === "human_confirmed" && d.source_type !== "user_description" && d.explicit_or_inferred === "explicit")),
    inferred: act.filter((d) => st(d) === "inferred" || (st(d) === "human_confirmed" && d.source_type !== "user_description" && d.explicit_or_inferred === "inferred")),
  };
}

/** Voice preview derived only from stored data (no model call). */
export function voicePreview(v: BrandVoice | null): string | null {
  if (!v) return null;
  const parts: string[] = [];
  if (v.tone_traits.length) parts.push(`Tom ${v.tone_traits.slice(0, 3).join(", ")}`);
  if (v.formality) parts.push(`formalidade ${v.formality}`);
  if (v.complexity_level) parts.push(`complexidade ${v.complexity_level}`);
  if (!parts.length) return null;
  const phrase = v.recurring_phrases[0];
  return `${parts.join(" · ")}.${phrase ? ` Exemplo recorrente: “${phrase}”.` : ""}`;
}

export type { BrandOffering, BrandAudience, BrandProblem, BrandClaim, BrandEvidence, BrandEntity, BrandVisualIdentity };
