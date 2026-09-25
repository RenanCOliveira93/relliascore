import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPrivateIPv4, isPrivateIPv6, isBlockedHostname, normalizeUrl, safeFetch, type HostResolver } from "./url-safety.ts";
import { extractPage } from "./extract.ts";
import { computeTechnicalSignals, hasEnoughContent } from "./signals.ts";
import { budgetBlocks } from "./content-budget.ts";
import { extractToolArguments, validateRelevanceResult } from "./model-parse.ts";

const publicResolver: HostResolver = async (h) => (h === "evil-rebind.test" ? ["10.0.0.5"] : ["93.184.216.34"]);
const html = (body: string, head = "") => `<!doctype html><html lang="pt-BR"><head>${head}</head><body>${body}</body></html>`;
const mkRes = (status: number, body: string, headers: Record<string, string> = { "content-type": "text/html; charset=utf-8" }) =>
  new Response(body, { status, headers });

// ---------- URL validation ----------
Deno.test("normal URL is accepted and normalized", () => {
  const r = normalizeUrl("  Example.com/servicos#top ");
  assert(r.ok);
  if (r.ok) assertEquals(r.url.toString(), "https://example.com/servicos");
});
Deno.test("localhost / 127.0.0.1 / ::1 are rejected", () => {
  for (const u of ["http://localhost", "http://127.0.0.1", "http://[::1]/", "http://app.local", "http://x.internal", "http://2130706433"]) {
    assertEquals(normalizeUrl(u).ok, false, u);
  }
});
Deno.test("credentials and non-http protocols are rejected", () => {
  assertEquals(normalizeUrl("https://user:pass@example.com").ok, false);
  assertEquals(normalizeUrl("ftp://example.com").ok, false);
  assertEquals(normalizeUrl("file:///etc/passwd").ok, false);
});
Deno.test("private IP detection", () => {
  for (const ip of ["10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "127.0.0.1", "0.0.0.0", "100.64.0.1"]) assert(isPrivateIPv4(ip), ip);
  assertEquals(isPrivateIPv4("8.8.8.8"), false);
  for (const ip of ["::1", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) assert(isPrivateIPv6(ip), ip);
  assertEquals(isPrivateIPv6("2606:4700::1111"), false);
  assert(isBlockedHostname("[::1]"));
});

// ---------- safeFetch ----------
Deno.test("public URL redirecting to private is blocked", async () => {
  const fetchImpl = (async () => mkRes(302, "", { location: "http://127.0.0.1/admin" })) as typeof fetch;
  const r = await safeFetch("https://example.com", { fetchImpl, resolver: publicResolver });
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.status, "crawl_failed");
});
Deno.test("domain resolving to private IP is blocked", async () => {
  const r = await safeFetch("https://evil-rebind.test", { fetchImpl: (async () => mkRes(200, "x")) as typeof fetch, resolver: publicResolver });
  assertEquals(r.ok, false);
});
Deno.test("valid redirect is followed and final URL reported", async () => {
  let n = 0;
  const fetchImpl = (async () => (n++ === 0 ? mkRes(301, "", { location: "/novo" }) : mkRes(200, html("<p>ok</p>")))) as typeof fetch;
  const r = await safeFetch("https://example.com/antigo", { fetchImpl, resolver: publicResolver });
  assert(r.ok);
  if (r.ok) { assertEquals(r.finalUrl, "https://example.com/novo"); assertEquals(r.redirects, 1); }
});
Deno.test("too many redirects fails", async () => {
  const fetchImpl = (async () => mkRes(302, "", { location: "https://example.com/loop" })) as typeof fetch;
  const r = await safeFetch("https://example.com", { fetchImpl, resolver: publicResolver, maxRedirects: 3 });
  assertEquals(r.ok, false);
});
Deno.test("non-HTML response is unsupported_content", async () => {
  const fetchImpl = (async () => mkRes(200, "{}", { "content-type": "application/json" })) as typeof fetch;
  const r = await safeFetch("https://example.com/api", { fetchImpl, resolver: publicResolver });
  assertEquals(r.ok ? "ok" : r.status, "unsupported_content");
});
Deno.test("timeout returns timeout status", async () => {
  const fetchImpl = ((_u: string, init?: RequestInit) =>
    new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))))) as typeof fetch;
  const r = await safeFetch("https://example.com", { fetchImpl, resolver: publicResolver, timeoutMs: 50 });
  assertEquals(r.ok ? "ok" : r.status, "timeout");
});
Deno.test("HTTP error returns crawl_failed with status", async () => {
  const r = await safeFetch("https://example.com", { fetchImpl: (async () => mkRes(404, "nf")) as typeof fetch, resolver: publicResolver });
  assert(!r.ok && r.status === "crawl_failed" && r.httpStatus === 404);
});
Deno.test("large HTML is capped at maxBytes", async () => {
  const big = html("<p>" + "a ".repeat(100_000) + "</p>");
  const r = await safeFetch("https://example.com", { fetchImpl: (async () => mkRes(200, big)) as typeof fetch, resolver: publicResolver, maxBytes: 10_000 });
  assert(r.ok && r.bodyTruncated && r.body.length <= 10_000);
});

// ---------- Extraction & signals ----------
const META = { requestedUrl: "https://example.com/p", finalUrl: "https://example.com/p", httpStatus: 200 };
Deno.test("extracts metadata, headings, links, images and JSON-LD", () => {
  const page = extractPage(html(
    `<nav><a href="/menu">Menu</a></nav><main><h1>Consultoria GEO</h1><h2>Serviços</h2><p>Texto principal sobre otimização.</p>
     <a href="/contato">Contato</a><a href="https://other.com">Fora</a><img src="/a.png" alt="Logo"><img src="/b.png"></main>`,
    `<title>Título</title><meta name="description" content="Desc"><link rel="canonical" href="https://example.com/p">
     <meta property="og:title" content="OG"><meta name="author" content="Ana">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"X"}</script>
     <script type="application/ld+json">{invalid</script>`,
  ), META);
  assertEquals(page.title, "Título");
  assertEquals(page.meta_description, "Desc");
  assertEquals(page.lang, "pt-BR");
  assertEquals(page.h1, ["Consultoria GEO"]);
  assertEquals(page.schema_types, ["Organization"]);
  assertEquals(page.json_ld_invalid_count, 1);
  assertEquals(page.author, "Ana");
  assert(page.internal_links.some((l) => l.href.endsWith("/contato")));
  assertEquals(page.external_links.length, 1);
  assert(!page.main_text.includes("Menu"));
  const s = computeTechnicalSignals(page);
  assert(s.has_structured_data && s.has_canonical && s.canonical_matches_url === true);
  assertEquals(s.images_missing_alt, 1);
  assert(s.issues.some((i) => i.id === "invalid_json_ld"));
});
Deno.test("page without title flags missing_title; empty page is not analyzable", () => {
  const page = extractPage(html("<div id='root'></div>"), META);
  const s = computeTechnicalSignals(page);
  assert(s.issues.some((i) => i.id === "missing_title"));
  assertEquals(hasEnoughContent(page), false);
});

// ---------- Content budget ----------
Deno.test("budget keeps headings, flags truncation, preserves order", () => {
  const blocks = [{ tag: "h1", text: "Título", index: 0 }, ...Array.from({ length: 200 }, (_, i) => ({ tag: "p", text: `bloco ${i} ` + "x".repeat(200), index: i + 1 }))];
  const p = budgetBlocks(blocks, "geo", 3000);
  assert(p.content_truncated);
  assert(p.text.startsWith("Título"));
  assert(p.sent_chars <= 3000);
  assertEquals(budgetBlocks(blocks.slice(0, 3), "geo").content_truncated, false);
});

// ---------- Model parsing ----------
const good = {
  score: 120, summary: "ok", strengths: ["a"], improvements: [],
  sub_scores: { relevancia_tematica: 50, qualidade_conteudo: 60, autoridade_percebida: 40, otimizacao_llm: 30, clareza_proposta_valor: 70 },
  compatibility_diagnostic: { conteudo_atual: "a", conteudo_ideal: "b", gap_analysis: [], compatibility_percentage: 40 },
  action_plan: [
    { priority: "alta", action: "Adicionar H1", impact: "x", category: "tecnico", basis: "signal", signal_ref: "missing_h1", confidence: 1.4 },
    { priority: "media", action: "Y", impact: "y", category: "conteudo", basis: "signal", signal_ref: "made_up" },
  ],
  keywords_analysis: { found: [], missing: [], suggested: [] }, ideal_example: "",
};
Deno.test("valid model output is parsed, clamped and evidence validated", () => {
  const args = extractToolArguments({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(good) } }] } }] });
  assert(args.ok);
  const v = args.ok ? validateRelevanceResult(args.value, ["missing_h1"]) : args;
  assert(v.ok);
  if (v.ok) {
    const r = v.value as any;
    assertEquals(r.score, 100);
    assertEquals(r.action_plan[0].confidence, 1);
    assertEquals(r.action_plan[0].basis, "signal");
    assertEquals(r.action_plan[1].basis, "inference"); // unknown signal_ref downgraded
  }
});
Deno.test("invalid model responses fail (no fabricated score)", () => {
  assertEquals(extractToolArguments({}).ok, false);
  assertEquals(extractToolArguments({ choices: [{ message: { content: "not json" } }] }).ok, false);
  assertEquals(validateRelevanceResult({ summary: "x" }).ok, false);
  assertEquals(validateRelevanceResult({ ...good, sub_scores: { relevancia_tematica: 1 } }).ok, false);
});
