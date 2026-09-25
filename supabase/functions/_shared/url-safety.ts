// Centralized SSRF-safe URL validation and fetching.
// All external page fetches MUST go through safeFetch().

export type FetchFailureStatus = "invalid_url" | "timeout" | "crawl_failed" | "unsupported_content";

export interface SafeFetchSuccess {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  body: string;
  bodyTruncated: boolean;
  redirects: number;
}

export interface SafeFetchFailure {
  ok: false;
  status: FetchFailureStatus;
  reason: string; // safe, user-friendly (pt-BR)
  httpStatus?: number;
  requestedUrl?: string;
}

export type SafeFetchResult = SafeFetchSuccess | SafeFetchFailure;

export type HostResolver = (hostname: string) => Promise<string[]>;

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  resolver?: HostResolver;
  userAgent?: string;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

export function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true; // malformed → block
  if (a === 0) return true; // "this" network
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && Number(m[3]) === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function expandIPv6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // IPv4-mapped tail
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4) {
    const p = v4[1].split(".").map(Number);
    s = s.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array(fill).fill("0"), ...tail];
  if (all.length !== 8) return null;
  const nums = all.map((h) => parseInt(h, 16));
  if (nums.some((n) => isNaN(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

export function isIPv6(host: string): boolean {
  return host.replace(/^\[|\]$/g, "").includes(":");
}

export function isPrivateIPv6(ip: string): boolean {
  const n = expandIPv6(ip);
  if (!n) return true; // unparsable → block
  if (n.every((x) => x === 0)) return true; // ::
  if (n.slice(0, 7).every((x) => x === 0) && n[7] === 1) return true; // ::1
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible
  if (n.slice(0, 5).every((x) => x === 0) && (n[5] === 0xffff || n[5] === 0)) {
    const v4 = `${n[6] >> 8}.${n[6] & 255}.${n[7] >> 8}.${n[7] & 255}`;
    return isPrivateIPv4(v4);
  }
  if ((n[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((n[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((n[0] & 0xffc0) === 0xfec0) return true; // deprecated site-local
  if ((n[0] & 0xff00) === 0xff00) return true; // multicast
  if (n[0] === 0x2001 && n[1] === 0x0db8) return true; // documentation
  if (n[0] === 0x0064 && n[1] === 0xff9b) return true; // NAT64 (could embed private v4)
  return false;
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || isIPv6(host);
}

export function isPrivateIp(ip: string): boolean {
  return isIPv6(ip) ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (BLOCKED_SUFFIXES.some((s) => h.endsWith(s))) return true;
  if (isIpLiteral(h)) return isPrivateIp(h);
  // Decimal/hex/octal integer hosts like http://2130706433 or 0x7f000001
  if (/^(0x[0-9a-f]+|\d+)$/i.test(h)) return true;
  if (!h.includes(".")) return true; // single-label intranet names
  return false;
}

export type NormalizeResult = { ok: true; url: URL } | { ok: false; reason: string };

export function normalizeUrl(raw: unknown): NormalizeResult {
  if (typeof raw !== "string") return { ok: false, reason: "URL inválida." };
  let s = raw.trim();
  if (!s || s.length > 2048) return { ok: false, reason: "URL inválida." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, reason: "URL inválida." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "Apenas URLs http(s) são permitidas." };
  if (url.username || url.password) return { ok: false, reason: "URLs com credenciais embutidas não são permitidas." };
  if (url.port && !["80", "443", "8080", "8443"].includes(url.port)) return { ok: false, reason: "Porta não permitida." };
  if (isBlockedHostname(url.hostname)) return { ok: false, reason: "Este endereço não pode ser analisado (rede privada ou interna)." };
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return { ok: true, url };
}

export const defaultResolver: HostResolver = async (hostname) => {
  const out: string[] = [];
  const tries: Array<"A" | "AAAA"> = ["A", "AAAA"];
  await Promise.all(
    tries.map(async (t) => {
      try {
        const r = await Deno.resolveDns(hostname, t);
        out.push(...(r as string[]));
      } catch { /* no record of this type */ }
    }),
  );
  return out;
};

/** Validates both the hostname and every resolved address. */
export async function assertPublicHost(url: URL, resolver: HostResolver): Promise<string | null> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) return "Este endereço não pode ser analisado (rede privada ou interna).";
  if (isIpLiteral(host)) return null;
  const ips = await resolver(host);
  if (ips.length === 0) return "Não foi possível resolver o domínio informado.";
  if (ips.some(isPrivateIp)) return "Este domínio aponta para uma rede privada e não pode ser analisado.";
  return null;
}

const HTML_TYPES = ["text/html", "application/xhtml+xml"];

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 3_000_000;
  const maxRedirects = opts.maxRedirects ?? 5;
  const doFetch = opts.fetchImpl ?? fetch;
  const resolver = opts.resolver ?? defaultResolver;

  const norm = normalizeUrl(rawUrl);
  if (!norm.ok) return { ok: false, status: "invalid_url", reason: norm.reason };
  const requestedUrl = norm.url.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = norm.url;
    let redirects = 0;
    while (true) {
      const hostErr = await assertPublicHost(current, resolver);
      if (hostErr) return { ok: false, status: redirects ? "crawl_failed" : "invalid_url", reason: hostErr, requestedUrl };

      const res = await doFetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": opts.userAgent ?? "Mozilla/5.0 (compatible; RelliaAnalyzer/1.0; +https://relliascore.lovable.app)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        },
      });

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        if (++redirects > maxRedirects) return { ok: false, status: "crawl_failed", reason: "A página redirecionou vezes demais.", requestedUrl };
        const next = normalizeUrl(new URL(res.headers.get("location")!, current).toString());
        if (!next.ok) return { ok: false, status: "crawl_failed", reason: "A página redirecionou para um endereço não permitido.", requestedUrl };
        current = next.url;
        continue;
      }

      if (!res.ok) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        return { ok: false, status: "crawl_failed", reason: `A página respondeu com erro HTTP ${res.status}.`, httpStatus: res.status, requestedUrl };
      }

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!HTML_TYPES.some((t) => contentType.includes(t))) {
        try { await res.body?.cancel(); } catch { /* ignore */ }
        return { ok: false, status: "unsupported_content", reason: "O endereço não retornou uma página HTML.", httpStatus: res.status, requestedUrl };
      }

      const { text, truncated } = await readLimited(res, maxBytes);
      return { ok: true, requestedUrl, finalUrl: current.toString(), httpStatus: res.status, contentType, body: text, bodyTruncated: truncated, redirects };
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { ok: false, status: "timeout", reason: "A página demorou demais para responder.", requestedUrl };
    return { ok: false, status: "crawl_failed", reason: "Não foi possível acessar a página.", requestedUrl };
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.length > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      total = maxBytes;
      truncated = true;
      try { await reader.cancel(); } catch { /* ignore */ }
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(buf), truncated };
}
