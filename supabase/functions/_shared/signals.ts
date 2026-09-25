// Deterministic technical signals. These are FACTS computed from the page — never produced by the LLM.
import type { PageExtraction, SchemaEntity } from "./extract.ts";

export interface TechnicalIssue { id: string; severity: "alta" | "media" | "baixa"; message: string }

export interface TechnicalSignals {
  http_status: number;
  redirected: boolean;
  has_title: boolean;
  title_length: number;
  has_meta_description: boolean;
  meta_description_length: number;
  has_canonical: boolean;
  canonical_matches_url: boolean | null;
  robots_noindex: boolean;
  has_lang: boolean;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  word_count: number;
  thin_content: boolean;
  internal_links_count: number;
  external_links_count: number;
  images_count: number;
  images_missing_alt: number;
  alt_text_coverage: number | null; // 0-1
  has_structured_data: boolean;
  json_ld_invalid_count: number;
  schema_types: string[];
  has_open_graph: boolean;
  has_author: boolean;
  has_published_date: boolean;
  has_modified_date: boolean;
  issues: TechnicalIssue[];
  // ---- Technical GEO 2.0 extras (optional: older fixtures/rows may not carry them → rules become "unavailable") ----
  final_url?: string;
  is_https?: boolean;
  content_type?: string | null;
  canonical_other_host?: boolean;
  heading_levels?: number[];
  empty_headings_count?: number;
  list_count?: number;
  has_contact_links?: boolean;
  generic_anchor_count?: number;
  og_type?: string | null;
  schema_entity?: SchemaEntity | null;
}

export const MIN_WORDS_FOR_ANALYSIS = 30;

export function computeTechnicalSignals(p: PageExtraction, extra: { contentType?: string | null } = {}): TechnicalSignals {
  const imagesMissingAlt = p.images.filter((i) => !i.alt).length;
  let canonicalMatches: boolean | null = null;
  let canonicalOtherHost = false;
  if (p.canonical) {
    try {
      const c = new URL(p.canonical, p.final_url);
      const f = new URL(p.final_url);
      canonicalMatches = c.hostname === f.hostname && c.pathname.replace(/\/$/, "") === f.pathname.replace(/\/$/, "");
      canonicalOtherHost = c.hostname.replace(/^www\./, "") !== f.hostname.replace(/^www\./, "");
    } catch { canonicalMatches = false; }
  }
  let isHttps = false;
  try { isHttps = new URL(p.final_url).protocol === "https:"; } catch { /* keep false */ }
  const robotsNoindex = /noindex/i.test(p.robots_meta ?? "");
  const s: TechnicalSignals = {
    http_status: p.http_status,
    redirected: p.requested_url !== p.final_url,
    has_title: !!p.title,
    title_length: p.title?.length ?? 0,
    has_meta_description: !!p.meta_description,
    meta_description_length: p.meta_description?.length ?? 0,
    has_canonical: !!p.canonical,
    canonical_matches_url: canonicalMatches,
    robots_noindex: robotsNoindex,
    has_lang: !!p.lang,
    h1_count: p.h1.length,
    h2_count: p.h2.length,
    h3_count: p.h3.length,
    word_count: p.word_count,
    thin_content: p.word_count < 300,
    internal_links_count: p.internal_links.length,
    external_links_count: p.external_links.length,
    images_count: p.images.length,
    images_missing_alt: imagesMissingAlt,
    alt_text_coverage: p.images.length ? +((p.images.length - imagesMissingAlt) / p.images.length).toFixed(2) : null,
    has_structured_data: p.json_ld.length > 0,
    json_ld_invalid_count: p.json_ld_invalid_count,
    schema_types: p.schema_types,
    has_open_graph: Object.keys(p.open_graph).some((k) => k.startsWith("og:")),
    has_author: !!p.author,
    has_published_date: !!p.published_date,
    has_modified_date: !!p.modified_date,
    issues: [],
    final_url: p.final_url,
    is_https: isHttps,
    content_type: extra.contentType ?? null,
    canonical_other_host: canonicalOtherHost,
    heading_levels: p.heading_levels,
    empty_headings_count: p.empty_headings_count,
    list_count: p.list_count,
    has_contact_links: p.has_contact_links,
    generic_anchor_count: p.generic_anchor_count,
    og_type: p.og_type,
    schema_entity: p.schema_entity,
  };

  const add = (id: string, severity: TechnicalIssue["severity"], message: string) => s.issues.push({ id, severity, message });
  if (!s.has_title) add("missing_title", "alta", "Página sem <title>.");
  else if (s.title_length > 65) add("long_title", "baixa", `Title com ${s.title_length} caracteres (recomendado até ~60).`);
  if (!s.has_meta_description) add("missing_meta_description", "media", "Página sem meta description.");
  if (s.h1_count === 0) add("missing_h1", "alta", "Página sem H1.");
  else if (s.h1_count > 1) add("multiple_h1", "baixa", `Página com ${s.h1_count} H1.`);
  if (!s.has_canonical) add("missing_canonical", "baixa", "Página sem link canonical.");
  else if (s.canonical_matches_url === false) add("canonical_mismatch", "media", "Canonical aponta para outra URL.");
  if (s.robots_noindex) add("robots_noindex", "alta", "Meta robots contém noindex.");
  if (!s.has_lang) add("missing_lang", "baixa", "Atributo lang ausente no <html>.");
  if (!s.has_structured_data) add("missing_structured_data", "media", "Nenhum dado estruturado JSON-LD encontrado.");
  if (s.json_ld_invalid_count > 0) add("invalid_json_ld", "media", `${s.json_ld_invalid_count} bloco(s) JSON-LD inválido(s).`);
  if (s.thin_content) add("thin_content", "media", `Conteúdo curto (${s.word_count} palavras).`);
  if (s.images_missing_alt > 0) add("images_missing_alt", "baixa", `${s.images_missing_alt} imagem(ns) sem texto alternativo.`);
  if (!s.has_open_graph) add("missing_open_graph", "baixa", "Tags OpenGraph ausentes.");
  // Author/date only matter for editorial content (no universal penalty).
  const editorial = /article/i.test(s.og_type ?? "") || s.schema_types.some((t) => /Article|BlogPosting/.test(t));
  if (editorial && !s.has_author) add("missing_author", "baixa", "Autor não identificado.");
  if (editorial && !s.has_published_date && !s.has_modified_date) add("missing_dates", "baixa", "Datas de publicação/atualização ausentes.");
  return s;
}

export function hasEnoughContent(p: PageExtraction): boolean {
  return p.word_count >= MIN_WORDS_FOR_ANALYSIS;
}
