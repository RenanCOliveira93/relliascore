// robots.txt reading (single file, same origin as the analyzed page). NOT a crawler.
// Reports only what the observed rules allow/block for the analyzed path.
// Allowing a bot does NOT guarantee indexing, training, citation or recommendation.
import { safeFetch, type SafeFetchOptions } from "./url-safety.ts";

export type CrawlerCategory = "search" | "training" | "unknown";

/**
 * Registry of known user-agents. Categories follow each operator's public documentation as understood
 * when this file was written; it is static data and MUST be reviewed periodically (operators change bots).
 */
export const KNOWN_CRAWLERS: { token: string; operator: string; category: CrawlerCategory }[] = [
  { token: "Googlebot", operator: "Google", category: "search" },
  { token: "Bingbot", operator: "Microsoft", category: "search" },
  { token: "OAI-SearchBot", operator: "OpenAI", category: "search" },
  { token: "GPTBot", operator: "OpenAI", category: "training" },
  { token: "PerplexityBot", operator: "Perplexity", category: "search" },
  { token: "ClaudeBot", operator: "Anthropic", category: "training" },
  { token: "Claude-SearchBot", operator: "Anthropic", category: "search" },
  { token: "Google-Extended", operator: "Google", category: "training" },
  { token: "CCBot", operator: "Common Crawl", category: "unknown" },
];
export const CRAWLER_REGISTRY_VERSION = "2026-09";

export type RobotsVerdict = "allowed" | "blocked" | "no_rule";
export interface CrawlerAccess { token: string; operator: string; category: CrawlerCategory; verdict: RobotsVerdict; matched_rule: string | null; group: string | null }
export interface RobotsResult {
  status: "fetched" | "not_found" | "unavailable";
  url: string | null;
  path: string | null;
  crawlers: CrawlerAccess[];
  registry_version: string;
  note: string;
}

interface Group { agents: string[]; rules: { allow: boolean; path: string }[] }

export function parseRobots(txt: string): Group[] {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/).slice(0, 5000)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === "disallow" && val === "") continue; // empty disallow = allow all
      cur.rules.push({ allow: key === "allow", path: val });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function patternToRegex(p: string): RegExp {
  const anchored = p.endsWith("$");
  const body = (anchored ? p.slice(0, -1) : p).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp("^" + body + (anchored ? "$" : ""));
}

/** RFC 9309: most specific group (exact token match, else "*"), longest matching rule wins, allow wins ties. */
export function evaluate(groups: Group[], token: string, path: string): { verdict: RobotsVerdict; rule: string | null; group: string | null } {
  const t = token.toLowerCase();
  let selected = groups.filter((g) => g.agents.includes(t));
  let groupName: string | null = token;
  if (!selected.length) { selected = groups.filter((g) => g.agents.includes("*")); groupName = selected.length ? "*" : null; }
  if (!selected.length) return { verdict: "no_rule", rule: null, group: null };
  let best: { allow: boolean; path: string } | null = null;
  for (const r of selected.flatMap((g) => g.rules)) {
    if (!patternToRegex(r.path).test(path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  if (!best) return { verdict: "no_rule", rule: null, group: groupName };
  return { verdict: best.allow ? "allowed" : "blocked", rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}`, group: groupName };
}

export function crawlerAccessFrom(txt: string, path: string): CrawlerAccess[] {
  const groups = parseRobots(txt);
  return KNOWN_CRAWLERS.map((c) => {
    const e = evaluate(groups, c.token, path);
    return { ...c, verdict: e.verdict, matched_rule: e.rule, group: e.group };
  });
}

const NOTE = "Mostra apenas o que o robots.txt permite ou bloqueia para este caminho. Permitir um robô não garante indexação, treinamento, citação ou recomendação.";

/** Fetches /robots.txt of the page origin through the SSRF-safe fetcher (short timeout, small cap). Never throws. */
export async function fetchRobots(pageUrl: string, opts: SafeFetchOptions = {}): Promise<RobotsResult> {
  let origin: URL, path: string;
  try { const u = new URL(pageUrl); origin = new URL("/robots.txt", u.origin); path = u.pathname + u.search; }
  catch { return { status: "unavailable", url: null, path: null, crawlers: [], registry_version: CRAWLER_REGISTRY_VERSION, note: NOTE }; }
  const r = await safeFetch(origin.toString(), { timeoutMs: 4000, maxBytes: 500_000, maxRedirects: 3, acceptTypes: ["text/plain", "text/html", "application/octet-stream", ""], ...opts });
  if (!r.ok) {
    // 4xx robots.txt = no restrictions (RFC 9309); other failures = unknown.
    if (r.httpStatus && r.httpStatus >= 400 && r.httpStatus < 500) {
      return { status: "not_found", url: origin.toString(), path, crawlers: KNOWN_CRAWLERS.map((c) => ({ ...c, verdict: "no_rule", matched_rule: null, group: null })), registry_version: CRAWLER_REGISTRY_VERSION, note: NOTE };
    }
    return { status: "unavailable", url: origin.toString(), path, crawlers: [], registry_version: CRAWLER_REGISTRY_VERSION, note: NOTE };
  }
  // An HTML body means the server answered with a page, not a robots file → treat as unknown.
  if (/<html|<!doctype/i.test(r.body.slice(0, 500))) {
    return { status: "unavailable", url: origin.toString(), path, crawlers: [], registry_version: CRAWLER_REGISTRY_VERSION, note: NOTE };
  }
  return { status: "fetched", url: origin.toString(), path, crawlers: crawlerAccessFrom(r.body, path), registry_version: CRAWLER_REGISTRY_VERSION, note: NOTE };
}
