import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPrivateIPv6, normalizeUrl, safeFetch, type HostResolver } from "./url-safety.ts";
import { hmacSha256 } from "./webhooks.ts";

const html = (b: string) => new Response(`<html><body>${b}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });

Deno.test("DNS rebinding: public at check, private after connect → fail closed", async () => {
  let n = 0;
  const flip: HostResolver = async () => (n++ === 0 ? ["93.184.216.34"] : ["10.0.0.7"]);
  const r = await safeFetch("https://rebind.test/", { resolver: flip, fetchImpl: async () => html("x") });
  assert(!r.ok);
});
Deno.test("DNS public → private at validation is blocked before fetch", async () => {
  let called = false;
  const r = await safeFetch("https://x.test/", { resolver: async () => ["192.168.1.1"], fetchImpl: async () => { called = true; return html(""); } });
  assert(!r.ok); assert(!called);
});
Deno.test("redirect public → private IP is blocked", async () => {
  const r = await safeFetch("https://a.test/", { resolver: async () => ["93.184.216.34"],
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }) });
  assert(!r.ok);
});
Deno.test("redirect loop / too many redirects", async () => {
  const r = await safeFetch("https://a.test/", { resolver: async () => ["93.184.216.34"], maxRedirects: 3,
    fetchImpl: async () => new Response(null, { status: 301, headers: { location: "https://a.test/" } }) });
  assert(!r.ok);
});
Deno.test("IPv6 and IPv4-mapped IPv6 private are blocked", () => {
  assert(isPrivateIPv6("::1")); assert(isPrivateIPv6("fc00::1")); assert(isPrivateIPv6("fe80::1"));
  assert(!normalizeUrl("http://[::ffff:127.0.0.1]/").ok);
  assert(!normalizeUrl("http://[::1]/").ok);
});
Deno.test("decimal/hex/octal IP forms are blocked", () => {
  for (const u of ["http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/"]) assert(!normalizeUrl(u).ok, u);
});
Deno.test("URL with credentials is rejected", () => assert(!normalizeUrl("https://user:pass@example.com/").ok));
Deno.test("body above 3 MB is truncated", async () => {
  const big = "a".repeat(3_100_000);
  const r = await safeFetch("https://a.test/", { resolver: async () => ["93.184.216.34"], fetchImpl: async () => html(big) });
  assert(r.ok && r.bodyTruncated && r.body.length <= 3_000_000);
});
Deno.test("wrong content-type is rejected", async () => {
  const r = await safeFetch("https://a.test/", { resolver: async () => ["93.184.216.34"],
    fetchImpl: async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }) });
  assert(!r.ok && r.status === "unsupported_content");
});
Deno.test("timeout returns timeout status", async () => {
  const r = await safeFetch("https://a.test/", { resolver: async () => ["93.184.216.34"], timeoutMs: 50,
    fetchImpl: (_u, init) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))) });
  assert(!r.ok && r.status === "timeout");
});
Deno.test("webhook v2 signature binds timestamp", async () => {
  const a = await hmacSha256("s", "1.{}"), b = await hmacSha256("s", "2.{}");
  assert(a !== b); assertEquals(a.length, 64);
});
