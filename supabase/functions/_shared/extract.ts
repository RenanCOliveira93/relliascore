// Structured HTML extraction for a single page. Never sends raw HTML to the model.
import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.48/deno-dom-wasm.ts";

export interface ExtractedLink { href: string; text: string }
export interface ExtractedImage { src: string; alt: string | null }
export interface ContentBlock { tag: string; text: string; index: number }

export interface PageExtraction {
  requested_url: string;
  final_url: string;
  http_status: number;
  title: string | null;
  meta_description: string | null;
  canonical: string | null;
  robots_meta: string | null;
  lang: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  main_text: string;
  content_blocks: ContentBlock[];
  internal_links: ExtractedLink[];
  external_links: ExtractedLink[];
  images: ExtractedImage[];
  json_ld: unknown[];
  json_ld_invalid_count: number;
  schema_types: string[];
  open_graph: Record<string, string>;
  author: string | null;
  published_date: string | null;
  modified_date: string | null;
  word_count: number;
  html_truncated: boolean;
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const LIMIT_LINKS = 200;
const LIMIT_IMAGES = 100;

function collectSchemaTypes(node: unknown, out: Set<string>, depth = 0) {
  if (!node || depth > 8) return;
  if (Array.isArray(node)) { node.forEach((n) => collectSchemaTypes(n, out, depth + 1)); return; }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    for (const v of Object.values(o)) if (typeof v === "object") collectSchemaTypes(v, out, depth + 1);
  }
}

function findInJsonLd(nodes: unknown[], key: string): string | null {
  const stack = [...nodes];
  while (stack.length) {
    const n = stack.pop();
    if (Array.isArray(n)) { stack.push(...n); continue; }
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (key === "author" && v && typeof v === "object") {
        const name = (Array.isArray(v) ? v[0] : v) as Record<string, unknown>;
        if (name && typeof name.name === "string") return name.name;
      }
      stack.push(...Object.values(o).filter((x) => typeof x === "object"));
    }
  }
  return null;
}

export function extractPage(html: string, meta: { requestedUrl: string; finalUrl: string; httpStatus: number; htmlTruncated?: boolean }): PageExtraction {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = new URL(meta.finalUrl);
  const empty: PageExtraction = {
    requested_url: meta.requestedUrl, final_url: meta.finalUrl, http_status: meta.httpStatus,
    title: null, meta_description: null, canonical: null, robots_meta: null, lang: null,
    h1: [], h2: [], h3: [], main_text: "", content_blocks: [], internal_links: [], external_links: [],
    images: [], json_ld: [], json_ld_invalid_count: 0, schema_types: [], open_graph: {},
    author: null, published_date: null, modified_date: null, word_count: 0, html_truncated: !!meta.htmlTruncated,
  };
  if (!doc) return empty;

  const metaContent = (sel: string) => clean(doc.querySelector(sel)?.getAttribute("content")) || null;

  // JSON-LD first (before removing scripts)
  const json_ld: unknown[] = [];
  let invalid = 0;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = (s as Element).textContent?.trim();
    if (!raw) continue;
    try { json_ld.push(JSON.parse(raw)); } catch { invalid++; }
  }
  const types = new Set<string>();
  collectSchemaTypes(json_ld, types);

  const open_graph: Record<string, string> = {};
  for (const m of doc.querySelectorAll('meta[property^="og:"], meta[property^="article:"]')) {
    const el = m as Element;
    const p = el.getAttribute("property");
    const c = clean(el.getAttribute("content"));
    if (p && c && Object.keys(open_graph).length < 30) open_graph[p] = c.slice(0, 500);
  }

  const headings = (tag: string) =>
    Array.from(doc.querySelectorAll(tag)).map((h) => clean((h as Element).textContent)).filter(Boolean).slice(0, 50);

  // Links & images (from full document)
  const internal_links: ExtractedLink[] = [];
  const external_links: ExtractedLink[] = [];
  for (const a of doc.querySelectorAll("a[href]")) {
    const el = a as Element;
    const href = el.getAttribute("href") ?? "";
    if (/^(javascript:|mailto:|tel:|#)/i.test(href)) continue;
    let u: URL;
    try { u = new URL(href, base); } catch { continue; }
    const link = { href: u.toString(), text: clean(el.textContent).slice(0, 150) };
    const sameSite = u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
    if (sameSite) { if (internal_links.length < LIMIT_LINKS) internal_links.push(link); }
    else if (external_links.length < LIMIT_LINKS) external_links.push(link);
  }
  const images: ExtractedImage[] = [];
  for (const i of doc.querySelectorAll("img")) {
    if (images.length >= LIMIT_IMAGES) break;
    const el = i as Element;
    const src = el.getAttribute("src") ?? el.getAttribute("data-src") ?? "";
    if (!src) continue;
    let abs = src;
    try { abs = new URL(src, base).toString(); } catch { /* keep raw */ }
    const alt = el.getAttribute("alt");
    images.push({ src: abs.slice(0, 500), alt: alt === null ? null : clean(alt).slice(0, 300) });
  }

  // Main content: strip chrome, prefer semantic container
  for (const sel of ["script", "style", "noscript", "template", "svg", "iframe", "nav", "footer", "header", "aside", "form"]) {
    for (const n of Array.from(doc.querySelectorAll(sel))) (n as Element).remove();
  }
  const root = (doc.querySelector("main") ?? doc.querySelector("article") ?? doc.querySelector('[role="main"]') ?? doc.body) as Element | null;
  const content_blocks: ContentBlock[] = [];
  if (root) {
    let idx = 0;
    for (const n of root.querySelectorAll("h1,h2,h3,h4,p,li,blockquote,td,dd,figcaption")) {
      const el = n as Element;
      // skip li/td that contain nested blocks to avoid duplication
      if ((el.tagName === "LI" || el.tagName === "TD") && el.querySelector("p,li")) continue;
      const text = clean(el.textContent);
      if (text.length < 2) continue;
      content_blocks.push({ tag: el.tagName.toLowerCase(), text, index: idx++ });
    }
    if (content_blocks.length === 0) {
      const t = clean(root.textContent);
      if (t) content_blocks.push({ tag: "div", text: t, index: 0 });
    }
  }
  const main_text = content_blocks.map((b) => b.text).join("\n");
  const word_count = main_text ? main_text.split(/\s+/).filter(Boolean).length : 0;

  return {
    ...empty,
    title: clean(doc.querySelector("title")?.textContent) || null,
    meta_description: metaContent('meta[name="description"]'),
    canonical: clean(doc.querySelector('link[rel="canonical"]')?.getAttribute("href")) || null,
    robots_meta: metaContent('meta[name="robots"]'),
    lang: clean(doc.documentElement?.getAttribute("lang")) || null,
    h1: headings("h1"), h2: headings("h2"), h3: headings("h3"),
    main_text, content_blocks, internal_links, external_links, images,
    json_ld, json_ld_invalid_count: invalid, schema_types: Array.from(types).slice(0, 50), open_graph,
    author: metaContent('meta[name="author"]') ?? findInJsonLd(json_ld, "author"),
    published_date: metaContent('meta[property="article:published_time"]') ?? findInJsonLd(json_ld, "datePublished"),
    modified_date: metaContent('meta[property="article:modified_time"]') ?? findInJsonLd(json_ld, "dateModified"),
    word_count,
  };
}
