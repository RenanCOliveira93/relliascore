// Editable field definitions per Brand Brain section (mirror of supabase/functions/_shared/brand-profile-ops.ts ITEM_SCHEMAS).
export type ItemTable = "brand_offerings" | "brand_audiences" | "brand_problems" | "brand_differentiators" | "brand_claims" | "brand_evidence" | "brand_entities" | "brand_positioning" | "brand_voice" | "brand_visual_identity";

export type FieldDef =
  | { key: string; label: string; kind: "text" | "textarea" | "url"; required?: boolean }
  | { key: string; label: string; kind: "list"; hint?: string }
  | { key: string; label: string; kind: "enum"; options: { value: string; label: string }[]; required?: boolean }
  | { key: string; label: string; kind: "colors" };

const opt = (m: Record<string, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

export const OFFERING_TYPES = { product: "Produto", service: "Serviço", platform: "Plataforma", solution: "Solução", other: "Outro" };
export const AUDIENCE_TYPES = { company: "Empresas", professional: "Profissionais", consumer: "Consumidores", creator: "Criadores", institution: "Instituições", other: "Outro" };
export const DIFF_CATEGORIES = { technology: "Tecnologia", methodology: "Metodologia", expertise: "Especialização", performance: "Desempenho", experience: "Experiência", integration: "Integração", service: "Atendimento", positioning: "Posicionamento", other: "Outro" };
export const CLAIM_TYPES = { performance: "Desempenho", market: "Mercado", customer: "Clientes", technology: "Tecnologia", capability: "Capacidade", experience: "Experiência", certification: "Certificação", statistic: "Estatística", positioning: "Posicionamento", other: "Outro" };
export const CLAIM_STATUS = { evidenced: "Com evidência", partially_evidenced: "Evidência parcial", unevidenced: "Sem evidência cadastrada", unknown: "Não verificado" };
export const EVIDENCE_TYPES = { case_study: "Case", customer: "Cliente", testimonial: "Depoimento", statistic: "Estatística", certification: "Certificação", award: "Prêmio", research: "Pesquisa", partnership: "Parceria", publication: "Publicação", result: "Resultado", other: "Outro" };
export const ENTITY_TYPES = { organization: "Organização", person: "Pessoa", product: "Produto", service: "Serviço", technology: "Tecnologia", location: "Localização", market: "Mercado", concept: "Conceito", customer: "Cliente", partner: "Parceiro", other: "Outra" };
export const RELATIONSHIP_LABELS = { supports: "Sustenta", partially_supports: "Sustenta parcialmente", contradicts: "Contradiz", related: "Relacionada" };

export const ITEM_FIELDS: Record<ItemTable, FieldDef[]> = {
  brand_offerings: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "type", label: "Tipo", kind: "enum", options: opt(OFFERING_TYPES), required: true },
    { key: "description", label: "Descrição", kind: "textarea" },
    { key: "category", label: "Categoria", kind: "text" },
    { key: "target_audience", label: "Público", kind: "text" },
    { key: "problems_solved", label: "Problemas resolvidos", kind: "list" },
    { key: "value_proposition", label: "Proposta de valor", kind: "textarea" },
  ],
  brand_audiences: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "audience_type", label: "Tipo", kind: "enum", options: opt(AUDIENCE_TYPES), required: true },
    { key: "description", label: "Descrição", kind: "textarea" },
    { key: "needs", label: "Necessidades", kind: "list" },
    { key: "problems", label: "Problemas", kind: "list" },
    { key: "industries", label: "Indústrias", kind: "list" },
    { key: "roles", label: "Funções/cargos", kind: "list" },
  ],
  brand_problems: [
    { key: "name", label: "Problema", kind: "text", required: true },
    { key: "description", label: "Descrição", kind: "textarea" },
    { key: "affected_audience", label: "Público afetado", kind: "list" },
    { key: "related_offerings", label: "Produtos/serviços relacionados", kind: "list" },
  ],
  brand_differentiators: [
    { key: "statement", label: "Diferencial", kind: "textarea", required: true },
    { key: "category", label: "Categoria", kind: "enum", options: opt(DIFF_CATEGORIES), required: true },
  ],
  brand_claims: [
    { key: "statement", label: "Afirmação", kind: "textarea", required: true },
    { key: "claim_type", label: "Tipo", kind: "enum", options: opt(CLAIM_TYPES), required: true },
    { key: "verification_status", label: "Status", kind: "enum", options: opt(CLAIM_STATUS), required: true },
  ],
  brand_evidence: [
    { key: "evidence_type", label: "Tipo", kind: "enum", options: opt(EVIDENCE_TYPES), required: true },
    { key: "title", label: "Título", kind: "text", required: true },
    { key: "description", label: "Descrição", kind: "textarea" },
    { key: "value", label: "Resultado/valor", kind: "text" },
    { key: "source_url", label: "Fonte (URL)", kind: "url" },
  ],
  brand_entities: [
    { key: "name", label: "Nome", kind: "text", required: true },
    { key: "entity_type", label: "Tipo", kind: "enum", options: opt(ENTITY_TYPES), required: true },
    { key: "relationship", label: "Relação com a marca", kind: "text" },
    { key: "description", label: "Descrição", kind: "textarea" },
  ],
  brand_positioning: [
    { key: "statement", label: "Como a marca se define", kind: "textarea" },
    { key: "primary_category", label: "Categoria principal", kind: "text" },
    { key: "alternative_categories", label: "Categorias alternativas", kind: "list" },
    { key: "value_proposition", label: "Proposta de valor", kind: "textarea" },
    { key: "differentiators", label: "Diferenciais", kind: "list" },
    { key: "target_market", label: "Mercado-alvo", kind: "text" },
  ],
  brand_voice: [
    { key: "tone_traits", label: "Traços de tom", kind: "list" },
    { key: "communication_style", label: "Estilo", kind: "textarea" },
    { key: "vocabulary_preferred", label: "Vocabulário preferido", kind: "list" },
    { key: "vocabulary_avoided", label: "Vocabulário evitado", kind: "list" },
    { key: "complexity_level", label: "Complexidade", kind: "text" },
    { key: "formality", label: "Formalidade", kind: "text" },
    { key: "emotional_style", label: "Estilo emocional", kind: "text" },
    { key: "recurring_phrases", label: "Frases recorrentes", kind: "list" },
  ],
  brand_visual_identity: [
    { key: "primary_colors", label: "Cores principais", kind: "colors" },
    { key: "secondary_colors", label: "Cores secundárias", kind: "colors" },
    { key: "accent_colors", label: "Cores de destaque", kind: "colors" },
    { key: "detected_fonts", label: "Fontes", kind: "list" },
    { key: "logo_url", label: "Logo (URL)", kind: "url" },
    { key: "visual_style", label: "Estilo visual", kind: "textarea" },
    { key: "imagery_style", label: "Estilo de imagens", kind: "textarea" },
    { key: "consistency_notes", label: "Observações", kind: "textarea" },
  ],
};

export const SUMMARY_FIELDS: { field: "short_description" | "primary_category" | "secondary_categories" | "business_model" | "geographic_markets" | "value_proposition" | "target_summary" | "positioning"; label: string; list?: boolean; long?: boolean }[] = [
  { field: "short_description", label: "Descrição", long: true },
  { field: "primary_category", label: "Categoria principal" },
  { field: "secondary_categories", label: "Categorias secundárias", list: true },
  { field: "business_model", label: "Modelo de negócio" },
  { field: "geographic_markets", label: "Mercados", list: true },
  { field: "value_proposition", label: "Proposta de valor", long: true },
  { field: "target_summary", label: "Público", long: true },
  { field: "positioning", label: "Posicionamento", long: true },
];

/** Empty form values for a section; for edits, pre-filled from the item. */
export function formValues(table: ItemTable, item?: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(ITEM_FIELDS[table].map((f) => {
    const v = item?.[f.key];
    if (f.kind === "list") return [f.key, Array.isArray(v) ? v : []];
    if (f.kind === "colors") return [f.key, Array.isArray(v) ? v : []];
    if (f.kind === "enum") return [f.key, typeof v === "string" ? v : f.options[f.options.length - 1].value];
    return [f.key, typeof v === "string" ? v : ""];
  }));
}
