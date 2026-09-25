// RELLIA Technical GEO 2.0 — deterministic, page-type-aware rules engine.
// Measures observable technical/structural traits that help search, retrieval and generative systems
// access, interpret, identify, structure and contextualize content.
// It does NOT measure popularity, external authority, real recommendation chance or ranking in any AI engine.
//
// Weights are heuristic_weights_v1: an initial, NOT scientifically validated, allocation.
// They will be calibrated later with observed AI Visibility data.
import type { TechnicalSignals } from "./signals.ts";
import type { RobotsResult } from "./robots.ts";

export const TECHNICAL_GEO_VERSION = "1.0" as const;
export const TECHNICAL_GEO_WEIGHTS_LABEL = "heuristic_weights_v1" as const;

export const PAGE_TYPES = ["homepage", "landing_page", "article", "product", "service", "about", "contact", "category", "profile", "other"] as const;
export type PageType = typeof PAGE_TYPES[number];
export type RuleStatus = "pass" | "warning" | "fail" | "not_applicable" | "unavailable";
export type RuleSeverity = "info" | "low" | "medium" | "high" | "critical";
export type RuleCategory = "crawlability" | "metadata" | "semantic_html" | "structured_data" | "entity_signals" | "content_accessibility" | "freshness";

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  crawlability: "Rastreabilidade & Indexação",
  metadata: "Metadados",
  semantic_html: "HTML Semântico",
  structured_data: "Dados Estruturados",
  entity_signals: "Sinais de Entidade",
  content_accessibility: "Acessibilidade do Conteúdo",
  freshness: "Atualidade",
};

export interface PageTypeResult { page_type: PageType; confidence: number; source: "deterministic" | "llm" | "hybrid"; signals: string[] }

export interface RuleResult {
  id: string;
  version: string;
  category: RuleCategory;
  label: string;
  description: string;
  applicable_page_types: PageType[] | "all";
  max_points: number;
  status: RuleStatus;
  /** Earned points (0..max_points); null when not_applicable/unavailable. */
  score: number | null;
  evidence: string;
  recommendation: string | null;
  severity: RuleSeverity;
  source: "deterministic";
}

export interface TechnicalGeoResult {
  technical_geo_version: typeof TECHNICAL_GEO_VERSION;
  weights: typeof TECHNICAL_GEO_WEIGHTS_LABEL;
  page_type: PageTypeResult;
  score: number;
  coverage: number;
  applicable_points: number;
  earned_points: number;
  unavailable_points: number;
  rules: RuleResult[];
  critical_issues: { rule_id: string; label: string; evidence: string; recommendation: string | null }[];
  quick_wins: { rule_id: string; label: string; evidence: string; recommendation: string | null; severity: RuleSeverity }[];
  structured_data_recommendations: { schema_type: string; reason: string; applicable: boolean; priority: "high" | "medium" | "low" }[];
  ai_crawler_access: RobotsResult | null;
}

// ---------------------------------------------------------------------------------------------
// Page type (deterministic first; LLM hook reserved: source stays "deterministic" in this version)
// ---------------------------------------------------------------------------------------------
const URL_PATTERNS: [PageType, RegExp][] = [
  ["article", /\/(blog|artigos?|articles?|posts?|news|noticias?|materias?|insights|guia|guides?)(\/|$)|\/\d{4}\/\d{2}\//i],
  ["product", /\/(produtos?|products?|p|item|shop\/[^/]+)(\/|$)/i],
  ["service", /\/(servicos?|serviços?|services?|solucoes|soluções|solutions?)(\/|$)/i],
  ["about", /\/(sobre|sobre-nos|quem-somos|about|about-us|empresa|institucional)(\/|$)/i],
  ["contact", /\/(contato|fale-conosco|contact|contact-us)(\/|$)/i],
  ["category", /\/(categorias?|category|categories|collections?|tags?|colecao)(\/|$)/i],
  ["profile", /\/(perfil|profile|autor|author|team\/[^/]+|equipe\/[^/]+|in\/[^/]+)(\/|$)/i],
  ["landing_page", /\/(lp|landing|oferta|promo|campanha|webinar)(\/|$)/i],
];
const SCHEMA_PAGE: [PageType, RegExp][] = [
  ["article", /^(Article|BlogPosting|NewsArticle|TechArticle|Report|ScholarlyArticle)$/],
  ["product", /^(Product|ProductGroup|Offer)$/],
  ["service", /^Service$/],
  ["about", /^AboutPage$/],
  ["contact", /^ContactPage$/],
  ["category", /^(CollectionPage|ItemList|OfferCatalog)$/],
  ["profile", /^ProfilePage$/],
];

export function classifyPageType(s: TechnicalSignals): PageTypeResult {
  const votes = new Map<PageType, number>();
  const signals: string[] = [];
  const vote = (t: PageType, w: number, why: string) => { votes.set(t, (votes.get(t) ?? 0) + w); signals.push(`${t}:${why}`); };

  let path = "";
  if (s.final_url) {
    try { path = new URL(s.final_url).pathname; } catch { /* ignore */ }
    if (path === "" || path === "/" || /^\/(index\.(html?|php))?$/i.test(path) || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(path)) vote("homepage", 3, "url_root");
    for (const [t, re] of URL_PATTERNS) if (re.test(path)) { vote(t, 2, "url_pattern"); break; }
  }
  for (const [t, re] of SCHEMA_PAGE) if (s.schema_types.some((x) => re.test(x))) vote(t, 2.5, "schema");
  if (/^article$/i.test(s.og_type ?? "")) vote("article", 1.5, "og_type");
  if (/^(product|og:product)$/i.test(s.og_type ?? "")) vote("product", 1.5, "og_type");
  if (/^profile$/i.test(s.og_type ?? "")) vote("profile", 1.5, "og_type");
  if (s.has_author && s.has_published_date && s.word_count >= 400) vote("article", 1, "author_and_date");

  if (!votes.size) return { page_type: "other", confidence: 0.3, source: "deterministic", signals: ["no_signal"] };
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [top, topW] = sorted[0];
  const total = sorted.reduce((a, [, w]) => a + w, 0);
  // Confidence grows with agreeing evidence and drops with competing evidence; capped to avoid false certainty.
  const strength = Math.min(1, topW / 4);
  const agreement = topW / total;
  const confidence = Math.round(Math.min(0.95, 0.35 + 0.6 * strength * agreement) * 100) / 100;
  return { page_type: top, confidence, source: "deterministic", signals };
}

// ---------------------------------------------------------------------------------------------
// Ruleset
// ---------------------------------------------------------------------------------------------
type Eval = { status: RuleStatus; ratio?: number; evidence: string; recommendation?: string | null; severity?: RuleSeverity };
interface RuleDef {
  id: string;
  category: RuleCategory;
  label: string;
  description: string;
  applicable_page_types: PageType[] | "all";
  max_points: number;
  /** Severity used when the rule fails (warnings downgrade one level). */
  fail_severity: RuleSeverity;
  quick_win?: boolean;
  evaluate: (s: TechnicalSignals, ctx: { pageType: PageType; robots: RobotsResult | null }) => Eval;
}

const ALL = "all" as const;
const EDITORIAL: PageType[] = ["article"];
const ENTITY_PAGES: PageType[] = ["homepage", "about", "profile", "contact"];
const BREADCRUMB_PAGES: PageType[] = ["article", "product", "category", "service"];
const EXPECTED_SCHEMA: Record<PageType, { any: string[]; recommend: string; alt?: string[] }> = {
  homepage: { any: ["Organization", "Corporation", "LocalBusiness", "WebSite", "Person", "ProfessionalService"], recommend: "Organization", alt: ["WebSite"] },
  landing_page: { any: ["Organization", "Product", "Service", "WebPage", "Offer", "Event", "Course"], recommend: "WebPage" },
  article: { any: ["Article", "BlogPosting", "NewsArticle", "TechArticle", "Report", "ScholarlyArticle"], recommend: "Article" },
  product: { any: ["Product", "ProductGroup"], recommend: "Product" },
  service: { any: ["Service", "ProfessionalService", "LocalBusiness", "Organization"], recommend: "Service" },
  about: { any: ["AboutPage", "Organization", "Corporation", "Person", "LocalBusiness"], recommend: "Organization" },
  contact: { any: ["ContactPage", "Organization", "LocalBusiness", "Corporation"], recommend: "Organization" },
  category: { any: ["CollectionPage", "ItemList", "OfferCatalog", "BreadcrumbList"], recommend: "CollectionPage" },
  profile: { any: ["ProfilePage", "Person", "Organization"], recommend: "Person" },
  other: { any: [], recommend: "WebPage" },
};
const MIN_WORDS: Record<PageType, number> = {
  homepage: 120, landing_page: 150, article: 300, product: 120, service: 200, about: 150, contact: 30, category: 60, profile: 80, other: 150,
};

const na = (why = "Não se aplica a este tipo de página."): Eval => ({ status: "not_applicable", evidence: why });
const un = (why: string): Eval => ({ status: "unavailable", evidence: why });

export const TECHNICAL_GEO_RULESET_V1: RuleDef[] = [
  // ---- A. Crawlability & Indexability ----
  {
    id: "http_ok", category: "crawlability", label: "Página acessível (HTTP 2xx)", description: "A página responde com sucesso.",
    applicable_page_types: ALL, max_points: 10, fail_severity: "critical",
    evaluate: (s) => s.http_status >= 200 && s.http_status < 300
      ? { status: "pass", evidence: `HTTP ${s.http_status}.` }
      : { status: "fail", evidence: `HTTP ${s.http_status}.`, recommendation: "Garanta que a URL responda com status 200." },
  },
  {
    id: "https", category: "crawlability", label: "HTTPS", description: "A URL final usa HTTPS.",
    applicable_page_types: ALL, max_points: 3, fail_severity: "medium", quick_win: true,
    evaluate: (s) => s.is_https === undefined ? un("Protocolo final não registrado.")
      : s.is_https ? { status: "pass", evidence: "URL final em HTTPS." }
      : { status: "fail", evidence: "URL final sem HTTPS.", recommendation: "Sirva a página por HTTPS e redirecione a versão HTTP." },
  },
  {
    id: "indexable", category: "crawlability", label: "Indexável (sem noindex)", description: "A meta robots não bloqueia indexação.",
    applicable_page_types: ALL, max_points: 10, fail_severity: "critical",
    evaluate: (s) => s.robots_noindex
      ? { status: "fail", evidence: "Meta robots contém noindex.", recommendation: "Remova o noindex se esta página deve ser encontrada." }
      : { status: "pass", evidence: "Nenhum noindex encontrado." },
  },
  {
    id: "canonical_present", category: "crawlability", label: "Canonical declarado", description: "A página declara uma URL canônica.",
    applicable_page_types: ALL, max_points: 3, fail_severity: "low", quick_win: true,
    evaluate: (s) => s.has_canonical ? { status: "pass", evidence: "Link canonical presente." }
      : { status: "fail", evidence: "Nenhum link canonical encontrado.", recommendation: "Adicione <link rel=\"canonical\"> apontando para a URL preferida." },
  },
  {
    id: "canonical_consistent", category: "crawlability", label: "Canonical coerente", description: "O canonical aponta para esta página.",
    applicable_page_types: ALL, max_points: 4, fail_severity: "high",
    evaluate: (s) => {
      if (!s.has_canonical) return na("Sem canonical declarado (avaliado na regra anterior).");
      if (s.canonical_matches_url !== false) return { status: "pass", evidence: "Canonical aponta para a própria URL." };
      if (s.canonical_other_host) return { status: "fail", severity: "critical", evidence: "Canonical aponta para outro domínio.", recommendation: "Corrija o canonical para a URL desta página, salvo se a duplicação for intencional." };
      return { status: "warning", ratio: 0.4, evidence: "Canonical aponta para outra URL do mesmo site.", recommendation: "Confirme se esta página deve consolidar em outra URL; caso contrário, aponte o canonical para ela mesma." };
    },
  },
  {
    id: "content_type_html", category: "crawlability", label: "Content-Type HTML", description: "O servidor declara conteúdo HTML.",
    applicable_page_types: ALL, max_points: 2, fail_severity: "medium",
    evaluate: (s) => !s.content_type ? un("Content-Type não registrado.")
      : /html/.test(s.content_type) ? { status: "pass", evidence: `Content-Type: ${s.content_type}.` }
      : { status: "fail", evidence: `Content-Type: ${s.content_type}.`, recommendation: "Sirva a página com Content-Type text/html." },
  },
  {
    id: "robots_txt_search_access", category: "crawlability", label: "robots.txt permite robôs de busca", description: "O robots.txt não bloqueia robôs de busca conhecidos para este caminho.",
    applicable_page_types: ALL, max_points: 4, fail_severity: "high",
    evaluate: (_s, { robots }) => {
      if (!robots || robots.status === "unavailable") return un("robots.txt não pôde ser lido.");
      if (robots.status === "not_found") return { status: "pass", evidence: "robots.txt ausente (sem restrições declaradas)." };
      const search = robots.crawlers.filter((c) => c.category === "search");
      const blocked = search.filter((c) => c.verdict === "blocked");
      if (!blocked.length) return { status: "pass", evidence: "Nenhum robô de busca conhecido bloqueado para este caminho." };
      const google = blocked.some((c) => c.token === "Googlebot");
      return {
        status: google ? "fail" : "warning", ratio: google ? 0 : 1 - blocked.length / search.length,
        evidence: `Bloqueados: ${blocked.map((c) => `${c.token} (${c.matched_rule})`).join(", ")}.`,
        recommendation: "Revise o robots.txt se o bloqueio não for intencional. Permitir um robô não garante indexação ou citação.",
      };
    },
  },
  // ---- B. Metadata ----
  {
    id: "title_present", category: "metadata", label: "Title presente", description: "A página tem <title>.",
    applicable_page_types: ALL, max_points: 6, fail_severity: "high", quick_win: true,
    evaluate: (s) => s.has_title ? { status: "pass", evidence: `Title com ${s.title_length} caracteres.` }
      : { status: "fail", evidence: "Nenhum <title> encontrado.", recommendation: "Adicione um title descritivo que nomeie o assunto e a entidade da página." },
  },
  {
    id: "title_length", category: "metadata", label: "Tamanho do title", description: "Title nem curto nem longo demais (referência, não regra absoluta).",
    applicable_page_types: ALL, max_points: 2, fail_severity: "low",
    evaluate: (s) => !s.has_title ? na("Sem title (avaliado na regra anterior).")
      : s.title_length > 65 ? { status: "warning", ratio: 0.5, evidence: `Title com ${s.title_length} caracteres (referência: até ~60–65).`, recommendation: "Considere encurtar o title para que não seja truncado." }
      : s.title_length < 10 ? { status: "warning", ratio: 0.5, evidence: `Title com apenas ${s.title_length} caracteres.`, recommendation: "Torne o title mais descritivo." }
      : { status: "pass", evidence: `Title com ${s.title_length} caracteres.` },
  },
  {
    id: "meta_description", category: "metadata", label: "Meta description", description: "A página tem meta description.",
    applicable_page_types: ALL, max_points: 5, fail_severity: "medium", quick_win: true,
    evaluate: (s) => s.has_meta_description ? { status: "pass", evidence: `Meta description com ${s.meta_description_length} caracteres.` }
      : { status: "fail", evidence: "Nenhuma meta description encontrada.", recommendation: "Adicione uma descrição concisa que explique o conteúdo e a proposta principal desta página." },
  },
  {
    id: "meta_description_length", category: "metadata", label: "Qualidade estrutural da description", description: "Description com tamanho útil (referência ~50–160).",
    applicable_page_types: ALL, max_points: 1, fail_severity: "low",
    evaluate: (s) => !s.has_meta_description ? na("Sem meta description (avaliado na regra anterior).")
      : s.meta_description_length < 50 ? { status: "warning", ratio: 0.5, evidence: `Description com ${s.meta_description_length} caracteres.`, recommendation: "Amplie a description para resumir melhor a página." }
      : s.meta_description_length > 170 ? { status: "warning", ratio: 0.5, evidence: `Description com ${s.meta_description_length} caracteres.`, recommendation: "Considere encurtar a description." }
      : { status: "pass", evidence: `Description com ${s.meta_description_length} caracteres.` },
  },
  {
    id: "lang", category: "metadata", label: "Idioma declarado", description: "Atributo lang no <html>.",
    applicable_page_types: ALL, max_points: 3, fail_severity: "low", quick_win: true,
    evaluate: (s) => s.has_lang ? { status: "pass", evidence: "Atributo lang presente." }
      : { status: "fail", evidence: "Atributo lang ausente.", recommendation: "Declare o idioma, por exemplo <html lang=\"pt-BR\">." },
  },
  {
    id: "open_graph", category: "metadata", label: "OpenGraph", description: "Tags og:* presentes.",
    applicable_page_types: ALL, max_points: 2, fail_severity: "low", quick_win: true,
    evaluate: (s) => s.has_open_graph ? { status: "pass", evidence: "Tags OpenGraph presentes." }
      : { status: "fail", evidence: "Tags OpenGraph ausentes.", recommendation: "Adicione og:title, og:description e og:type." },
  },
  // ---- C. Semantic HTML ----
  {
    id: "h1", category: "semantic_html", label: "H1 principal", description: "A página tem um H1 que nomeia o assunto.",
    applicable_page_types: ALL, max_points: 6, fail_severity: "high",
    evaluate: (s) => s.h1_count === 1 ? { status: "pass", evidence: "Exatamente um H1." }
      : s.h1_count === 0 ? { status: "fail", evidence: "Nenhum H1 encontrado.", recommendation: "Adicione um H1 que nomeie claramente o assunto da página." }
      : s.h1_count <= 2 ? { status: "warning", ratio: 0.7, evidence: `${s.h1_count} H1 encontrados.`, recommendation: "Prefira um único H1 principal." }
      : { status: "warning", ratio: 0.4, evidence: `${s.h1_count} H1 encontrados.`, recommendation: "Mantenha um H1 principal e use H2/H3 para as seções." },
  },
  {
    id: "heading_hierarchy", category: "semantic_html", label: "Hierarquia de headings", description: "Estrutura coerente para o tamanho e tipo da página (sem exigir quantidade fixa de H2).",
    applicable_page_types: ALL, max_points: 4, fail_severity: "medium",
    evaluate: (s, { pageType }) => {
      const long = s.word_count >= 800 && ["article", "service", "landing_page", "other", "about"].includes(pageType);
      const subs = s.h2_count + s.h3_count;
      if (long && subs === 0) return { status: "warning", ratio: 0.3, evidence: `Conteúdo com ${s.word_count} palavras sem subtítulos.`, recommendation: "Divida o conteúdo em seções com H2 descritivos." };
      if (!s.heading_levels) return subs === 0 && !long ? { status: "pass", evidence: "Página curta; subtítulos não são necessários." } : { status: "pass", evidence: `${s.h2_count} H2 e ${s.h3_count} H3.` };
      let skips = 0; let prev = 0;
      for (const l of s.heading_levels) { if (prev && l > prev + 1) skips++; prev = l; }
      if (skips === 0) return { status: "pass", evidence: subs ? `Sequência de headings sem saltos (${s.h2_count} H2, ${s.h3_count} H3).` : "Página curta; subtítulos não são necessários." };
      return { status: "warning", ratio: skips > 3 ? 0.3 : 0.6, evidence: `${skips} salto(s) de nível (ex.: H1 → H3).`, recommendation: "Evite pular níveis de heading; use H2 antes de H3." };
    },
  },
  {
    id: "empty_headings", category: "semantic_html", label: "Headings sem texto", description: "Nenhum heading vazio.",
    applicable_page_types: ALL, max_points: 1, fail_severity: "low", quick_win: true,
    evaluate: (s) => s.empty_headings_count === undefined ? un("Contagem de headings vazios não registrada.")
      : s.empty_headings_count === 0 ? { status: "pass", evidence: "Nenhum heading vazio." }
      : { status: "warning", ratio: 0.3, evidence: `${s.empty_headings_count} heading(s) vazio(s).`, recommendation: "Remova headings vazios ou dê texto a eles." },
  },
  {
    id: "sufficient_text", category: "semantic_html", label: "Texto principal suficiente", description: "Volume de texto adequado ao tipo de página.",
    applicable_page_types: ALL, max_points: 6, fail_severity: "medium",
    evaluate: (s, { pageType }) => {
      const min = MIN_WORDS[pageType];
      if (s.word_count < 30) return { status: "fail", severity: "critical", evidence: `Apenas ${s.word_count} palavras extraídas.`, recommendation: "Garanta que o conteúdo principal esteja no HTML entregue." };
      if (s.word_count >= min) return { status: "pass", evidence: `${s.word_count} palavras (referência para ${pageType}: ${min}).` };
      if (s.word_count >= min / 2) return { status: "warning", ratio: 0.5, evidence: `${s.word_count} palavras (referência para ${pageType}: ${min}).`, recommendation: "Considere ampliar o conteúdo principal com informação útil." };
      return { status: "fail", evidence: `${s.word_count} palavras (referência para ${pageType}: ${min}).`, recommendation: "Amplie o conteúdo principal com informação útil e específica." };
    },
  },
  // ---- D. Structured Data ----
  {
    id: "json_ld_present", category: "structured_data", label: "Dados estruturados presentes", description: "Existe ao menos um bloco JSON-LD.",
    applicable_page_types: ALL, max_points: 4, fail_severity: "medium", quick_win: true,
    evaluate: (s) => s.has_structured_data || s.json_ld_invalid_count > 0
      ? { status: s.has_structured_data ? "pass" : "fail", evidence: s.has_structured_data ? `Tipos: ${s.schema_types.slice(0, 8).join(", ") || "sem @type"}.` : "Somente blocos JSON-LD inválidos.", recommendation: s.has_structured_data ? null : "Corrija o JSON-LD da página." }
      : { status: "fail", evidence: "Nenhum JSON-LD encontrado.", recommendation: "Adicione dados estruturados adequados ao tipo de página." },
  },
  {
    id: "json_ld_valid", category: "structured_data", label: "JSON-LD válido", description: "Todos os blocos JSON-LD são JSON válido.",
    applicable_page_types: ALL, max_points: 4, fail_severity: "high",
    evaluate: (s) => {
      if (!s.has_structured_data && s.json_ld_invalid_count === 0) return na("Sem JSON-LD para validar.");
      if (s.json_ld_invalid_count === 0) return { status: "pass", evidence: "Todos os blocos JSON-LD são válidos." };
      if (!s.has_structured_data) return { status: "fail", severity: "critical", evidence: `${s.json_ld_invalid_count} bloco(s) JSON-LD inválido(s) e nenhum válido.`, recommendation: "Corrija a sintaxe do JSON-LD; hoje nenhum dado estruturado é legível." };
      return { status: "fail", evidence: `${s.json_ld_invalid_count} bloco(s) JSON-LD inválido(s).`, recommendation: "Corrija a sintaxe dos blocos JSON-LD inválidos." };
    },
  },
  {
    id: "schema_matches_page_type", category: "structured_data", label: "Schema adequado ao tipo de página", description: "Os tipos de schema correspondem ao que a página é.",
    applicable_page_types: ["homepage", "landing_page", "article", "product", "service", "about", "contact", "category", "profile"], max_points: 6, fail_severity: "medium", quick_win: true,
    evaluate: (s, { pageType }) => {
      const exp = EXPECTED_SCHEMA[pageType];
      const hit = s.schema_types.filter((t) => exp.any.includes(t));
      if (hit.length) return { status: "pass", evidence: `Schema adequado encontrado: ${hit.join(", ")}.` };
      return { status: "fail", evidence: s.schema_types.length ? `Tipos encontrados (${s.schema_types.slice(0, 6).join(", ")}) não correspondem a ${pageType}.` : `Nenhum schema para ${pageType}.`, recommendation: `Considere schema ${exp.recommend} para esta página.` };
    },
  },
  {
    id: "breadcrumb", category: "structured_data", label: "BreadcrumbList", description: "Trilha de navegação estruturada em páginas internas.",
    applicable_page_types: BREADCRUMB_PAGES, max_points: 2, fail_severity: "low",
    evaluate: (s) => s.schema_types.includes("BreadcrumbList") ? { status: "pass", evidence: "BreadcrumbList presente." }
      : { status: "warning", ratio: 0, evidence: "BreadcrumbList ausente.", recommendation: "Considere BreadcrumbList para contextualizar a posição da página no site." },
  },
  // ---- E. Entity Signals ----
  {
    id: "entity_schema", category: "entity_signals", label: "Entidade principal estruturada", description: "Organization/Person representa a entidade da página.",
    applicable_page_types: ENTITY_PAGES, max_points: 4, fail_severity: "medium", quick_win: true,
    evaluate: (s) => s.schema_entity === undefined ? un("Entidade estruturada não registrada.")
      : s.schema_entity ? { status: "pass", evidence: `${s.schema_entity.type}${s.schema_entity.name ? `: ${s.schema_entity.name}` : ""}.` }
      : { status: "fail", evidence: "Nenhum schema Organization/Person encontrado.", recommendation: "Adicione schema Organization (ou Person, para marca pessoal) com nome oficial." },
  },
  {
    id: "entity_name", category: "entity_signals", label: "Nome da entidade no schema", description: "A entidade estruturada declara nome.",
    applicable_page_types: ENTITY_PAGES, max_points: 2, fail_severity: "low",
    evaluate: (s) => s.schema_entity === undefined ? un("Entidade estruturada não registrada.")
      : !s.schema_entity ? na("Sem entidade estruturada (avaliado na regra anterior).")
      : s.schema_entity.name ? { status: "pass", evidence: `Nome: ${s.schema_entity.name}.` }
      : { status: "fail", evidence: "Entidade sem propriedade name.", recommendation: "Informe o nome oficial em name." },
  },
  {
    id: "entity_logo", category: "entity_signals", label: "Logo/imagem da entidade", description: "logo ou image na entidade estruturada.",
    applicable_page_types: ["homepage", "about"], max_points: 1, fail_severity: "low",
    evaluate: (s) => s.schema_entity === undefined ? un("Entidade estruturada não registrada.")
      : !s.schema_entity ? na("Sem entidade estruturada.")
      : s.schema_entity.has_logo ? { status: "pass", evidence: "logo/image presente." }
      : { status: "warning", ratio: 0, evidence: "Entidade sem logo/image.", recommendation: "Adicione logo à entidade estruturada." },
  },
  {
    id: "entity_same_as", category: "entity_signals", label: "sameAs (perfis oficiais)", description: "Links sameAs conectam a entidade a perfis oficiais.",
    applicable_page_types: ["homepage", "about", "profile"], max_points: 2, fail_severity: "low",
    evaluate: (s) => s.schema_entity === undefined ? un("Entidade estruturada não registrada.")
      : !s.schema_entity ? na("Sem entidade estruturada.")
      : s.schema_entity.same_as_count > 0 ? { status: "pass", evidence: `${s.schema_entity.same_as_count} link(s) sameAs.` }
      : { status: "warning", ratio: 0, evidence: "Nenhum sameAs.", recommendation: "Liste perfis oficiais da entidade em sameAs." },
  },
  {
    id: "contact_info", category: "entity_signals", label: "Contato identificável", description: "Telefone/e-mail/endereço estruturado ou links de contato.",
    applicable_page_types: ["contact"], max_points: 3, fail_severity: "medium",
    evaluate: (s) => {
      if (s.schema_entity === undefined && s.has_contact_links === undefined) return un("Sinais de contato não registrados.");
      const structured = !!(s.schema_entity?.has_contact || s.schema_entity?.has_address);
      if (structured) return { status: "pass", evidence: "Contato/endereço estruturado na entidade." };
      if (s.has_contact_links) return { status: "warning", ratio: 0.6, evidence: "Links tel:/mailto: presentes, sem contato estruturado.", recommendation: "Inclua telephone/email/address no schema da entidade." };
      return { status: "fail", evidence: "Nenhum contato identificável.", recommendation: "Exiba e estruture telefone, e-mail ou endereço." };
    },
  },
  // ---- F. Content Accessibility ----
  {
    id: "alt_text", category: "content_accessibility", label: "Texto alternativo em imagens", description: "Cobertura de alt text.",
    applicable_page_types: ALL, max_points: 3, fail_severity: "low", quick_win: true,
    evaluate: (s) => {
      if (s.images_count === 0 || s.alt_text_coverage === null) return na("Página sem imagens.");
      const c = s.alt_text_coverage;
      if (c >= 0.9) return { status: "pass", ratio: c, evidence: `${Math.round(c * 100)}% das imagens com alt.` };
      return { status: c >= 0.5 ? "warning" : "fail", ratio: c, evidence: `${s.images_missing_alt} de ${s.images_count} imagens sem alt.`, recommendation: "Adicione alt descritivo às imagens relevantes." };
    },
  },
  {
    id: "internal_links", category: "content_accessibility", label: "Links internos", description: "A página conecta-se a outras páginas do site.",
    applicable_page_types: ALL, max_points: 2, fail_severity: "low",
    evaluate: (s) => s.internal_links_count >= 3 ? { status: "pass", evidence: `${s.internal_links_count} links internos.` }
      : s.internal_links_count > 0 ? { status: "warning", ratio: 0.5, evidence: `${s.internal_links_count} link(s) interno(s).`, recommendation: "Conecte a página a conteúdos relacionados do site." }
      : { status: "fail", evidence: "Nenhum link interno.", recommendation: "Adicione links para páginas relacionadas do site." },
  },
  {
    id: "external_references", category: "content_accessibility", label: "Referências externas", description: "Conteúdo editorial cita fontes externas.",
    applicable_page_types: EDITORIAL, max_points: 2, fail_severity: "low",
    evaluate: (s) => s.external_links_count > 0 ? { status: "pass", evidence: `${s.external_links_count} link(s) externo(s).` }
      : { status: "warning", ratio: 0, evidence: "Nenhum link externo.", recommendation: "Cite fontes externas que sustentem as afirmações." },
  },
  {
    id: "descriptive_anchors", category: "content_accessibility", label: "Âncoras descritivas", description: "Links evitam textos genéricos como \"clique aqui\".",
    applicable_page_types: ALL, max_points: 1, fail_severity: "low",
    evaluate: (s) => {
      if (s.generic_anchor_count === undefined) return un("Âncoras não analisadas.");
      const total = s.internal_links_count + s.external_links_count;
      if (!total) return na("Página sem links.");
      return s.generic_anchor_count === 0 ? { status: "pass", evidence: "Nenhuma âncora genérica." }
        : { status: "warning", ratio: Math.max(0, 1 - s.generic_anchor_count / total * 5), evidence: `${s.generic_anchor_count} âncora(s) genérica(s).`, recommendation: "Use textos de link que descrevam o destino." };
    },
  },
  {
    id: "js_dependency", category: "content_accessibility", label: "Dependência de JavaScript", description: "Reservado: medir se o conteúdo depende de JavaScript para aparecer.",
    applicable_page_types: ALL, max_points: 2, fail_severity: "medium",
    evaluate: () => un("Não medido nesta versão (sem renderização de JavaScript)."),
  },
  // ---- G. Freshness ----
  {
    id: "author", category: "freshness", label: "Autor identificado", description: "Autoria declarada em conteúdo editorial.",
    applicable_page_types: EDITORIAL, max_points: 3, fail_severity: "medium",
    evaluate: (s) => s.has_author ? { status: "pass", evidence: "Autor identificado." }
      : { status: "fail", evidence: "Autor não identificado.", recommendation: "Identifique o autor (meta author ou author no schema Article)." },
  },
  {
    id: "published_date", category: "freshness", label: "Data de publicação", description: "Data de publicação em conteúdo editorial.",
    applicable_page_types: EDITORIAL, max_points: 3, fail_severity: "low", quick_win: true,
    evaluate: (s) => s.has_published_date ? { status: "pass", evidence: "Data de publicação presente." }
      : { status: "fail", evidence: "Data de publicação ausente.", recommendation: "Declare datePublished / article:published_time." },
  },
  {
    id: "modified_date", category: "freshness", label: "Data de atualização", description: "Data de atualização em conteúdo editorial.",
    applicable_page_types: EDITORIAL, max_points: 2, fail_severity: "low",
    evaluate: (s) => s.has_modified_date ? { status: "pass", evidence: "Data de atualização presente." }
      : { status: "warning", ratio: 0, evidence: "Data de atualização ausente.", recommendation: "Declare dateModified quando o conteúdo for revisado." },
  },
];

const SEV_ORDER: RuleSeverity[] = ["info", "low", "medium", "high", "critical"];
const downgrade = (s: RuleSeverity): RuleSeverity => SEV_ORDER[Math.max(0, SEV_ORDER.indexOf(s) - 1)];
const r2 = (v: number) => Math.round(v * 100) / 100;

export function evaluateRule(def: RuleDef, s: TechnicalSignals, ctx: { pageType: PageType; robots: RobotsResult | null }): RuleResult {
  const base = {
    id: def.id, version: TECHNICAL_GEO_VERSION, category: def.category, label: def.label, description: def.description,
    applicable_page_types: def.applicable_page_types, max_points: def.max_points, source: "deterministic" as const,
  };
  const applicable = def.applicable_page_types === "all" || def.applicable_page_types.includes(ctx.pageType);
  if (!applicable) return { ...base, status: "not_applicable", score: null, evidence: "Não se aplica a este tipo de página.", recommendation: null, severity: "info" };
  const e = def.evaluate(s, ctx);
  if (e.status === "not_applicable" || e.status === "unavailable") return { ...base, status: e.status, score: null, evidence: e.evidence, recommendation: null, severity: "info" };
  const ratio = e.status === "pass" ? (e.ratio ?? 1) : e.status === "fail" ? (e.ratio ?? 0) : (e.ratio ?? 0.5);
  const severity: RuleSeverity = e.severity ?? (e.status === "pass" ? "info" : e.status === "warning" ? downgrade(def.fail_severity) : def.fail_severity);
  return { ...base, status: e.status, score: r2(Math.min(1, Math.max(0, ratio)) * def.max_points), evidence: e.evidence, recommendation: e.status === "pass" ? null : (e.recommendation ?? null), severity };
}

export function computeTechnicalGeoV2(s: TechnicalSignals, opts: { robots?: RobotsResult | null; pageType?: PageTypeResult } = {}): TechnicalGeoResult {
  const page = opts.pageType ?? classifyPageType(s);
  const robots = opts.robots ?? null;
  const ctx = { pageType: page.page_type, robots };
  const rules = TECHNICAL_GEO_RULESET_V1.map((d) => evaluateRule(d, s, ctx));
  const measured = rules.filter((r) => r.status === "pass" || r.status === "warning" || r.status === "fail");
  const applicable_points = measured.reduce((a, r) => a + r.max_points, 0);
  const earned_points = r2(measured.reduce((a, r) => a + (r.score ?? 0), 0));
  const unavailable_points = rules.filter((r) => r.status === "unavailable").reduce((a, r) => a + r.max_points, 0);
  const score = applicable_points ? r2(Math.min(100, Math.max(0, (earned_points / applicable_points) * 100))) : 0;
  const coverage = applicable_points + unavailable_points ? r2(applicable_points / (applicable_points + unavailable_points)) : 0;

  const quickSet = new Set(TECHNICAL_GEO_RULESET_V1.filter((d) => d.quick_win).map((d) => d.id));
  const critical_issues = rules.filter((r) => r.status === "fail" && r.severity === "critical")
    .map((r) => ({ rule_id: r.id, label: r.label, evidence: r.evidence, recommendation: r.recommendation }));
  const quick_wins = rules.filter((r) => (r.status === "fail" || r.status === "warning") && r.severity !== "critical" && quickSet.has(r.id))
    .map((r) => ({ rule_id: r.id, label: r.label, evidence: r.evidence, recommendation: r.recommendation, severity: r.severity }));

  return {
    technical_geo_version: TECHNICAL_GEO_VERSION, weights: TECHNICAL_GEO_WEIGHTS_LABEL, page_type: page,
    score, coverage, applicable_points, earned_points, unavailable_points, rules, critical_issues, quick_wins,
    structured_data_recommendations: structuredDataRecommendations(s, page.page_type),
    ai_crawler_access: robots,
  };
}

/** Structured recommendations only (no JSON-LD code generation in this version). */
export function structuredDataRecommendations(s: TechnicalSignals, pageType: PageType): TechnicalGeoResult["structured_data_recommendations"] {
  const out: TechnicalGeoResult["structured_data_recommendations"] = [];
  const has = (t: string) => s.schema_types.includes(t);
  const exp = EXPECTED_SCHEMA[pageType];
  if (exp.any.length && !exp.any.some(has)) {
    out.push({ schema_type: exp.recommend, reason: `Nenhum schema adequado a ${pageType} foi encontrado.`, applicable: true, priority: pageType === "other" ? "low" : "high" });
  }
  if (pageType === "homepage" && exp.alt) for (const t of exp.alt) if (!has(t) && exp.recommend !== t) out.push({ schema_type: t, reason: "Identifica o site e seu nome na página inicial.", applicable: true, priority: "medium" });
  if (ENTITY_PAGES.includes(pageType) && s.schema_entity && s.schema_entity.same_as_count === 0) {
    out.push({ schema_type: s.schema_entity.type, reason: "Entidade sem sameAs ligando a perfis oficiais.", applicable: true, priority: "low" });
  }
  if (BREADCRUMB_PAGES.includes(pageType) && !has("BreadcrumbList")) out.push({ schema_type: "BreadcrumbList", reason: "Contextualiza a posição da página no site.", applicable: true, priority: "low" });
  return out;
}
