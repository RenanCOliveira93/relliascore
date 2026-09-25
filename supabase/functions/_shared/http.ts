// CORS, structured logging, auth, workspace ownership and persistent rate limiting.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ---------- CORS ----------
const PROJECT_ID = "ff116910-3522-4e55-8a6e-9bcc6dca6983";
const TRUSTED_ORIGINS = [
  /^https:\/\/relliascore\.lovable\.app$/,
  new RegExp(`^https:\\/\\/([a-z0-9-]+--)?${PROJECT_ID}(-dev)?\\.(lovable\\.app|lovableproject\\.com)$`),
  new RegExp(`^https:\\/\\/id-preview(-[a-z0-9]+)?--${PROJECT_ID}\\.lovable\\.app$`),
  /^http:\/\/localhost:(8080|5173|3000)$/,
];

export function isTrustedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const extra = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin) || TRUSTED_ORIGINS.some((r) => r.test(origin));
}

const BASE_HEADERS = "authorization, x-client-info, apikey, content-type";

/** Private endpoints: only reflect trusted origins. */
export function privateCors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": `${BASE_HEADERS}, x-request-id`,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && isTrustedOrigin(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

/** Explicitly public endpoint (API-key authenticated, no cookies). */
export function publicCors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": `${BASE_HEADERS}, x-api-key`,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export const jsonResponse = (cors: Record<string, string>, status: number, body: unknown, requestId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", ...(requestId ? { "X-Request-Id": requestId } : {}) },
  });

// ---------- Logging ----------
export type Logger = (stage: string, fields?: Record<string, unknown>) => void;
const REDACT = /(authorization|token|secret|password|api[_-]?key|apikey|service)/i;

export function createLogger(fn: string, requestId: string): Logger {
  return (stage, fields = {}) => {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) safe[k] = REDACT.test(k) ? "[redacted]" : v;
    console.log(JSON.stringify({ ts: new Date().toISOString(), fn, request_id: requestId, stage, ...safe }));
  };
}

export function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// ---------- Auth ----------
export function adminClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export type AuthContext =
  | { kind: "user"; userId: string }
  | { kind: "internal"; userId: string | null; workspaceId: string | null }; // called by public-api after API-key validation

export async function authenticate(req: Request): Promise<AuthContext | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && timingSafeEqual(token, serviceKey)) {
    return {
      kind: "internal",
      userId: req.headers.get("x-rellia-user-id"),
      workspaceId: req.headers.get("x-rellia-workspace-id"),
    };
  }
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return { kind: "user", userId: data.user.id };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the verified workspace id (or null when none was requested). Throws "forbidden" when not owned. */
export async function verifyWorkspace(admin: SupabaseClient, userId: string, workspaceId: unknown): Promise<string | null> {
  if (workspaceId === null || workspaceId === undefined || workspaceId === "") return null;
  if (typeof workspaceId !== "string" || !UUID_RE.test(workspaceId)) throw new Error("forbidden");
  const { data, error } = await admin.from("workspaces").select("id").eq("id", workspaceId).eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("forbidden");
  return data.id as string;
}

// ---------- Persistent rate limiting (abuse protection, NOT plan quota) ----------
export interface RateRule { key: string; max: number; windowSeconds: number }

export async function checkRateLimits(admin: SupabaseClient, endpoint: string, rules: RateRule[], log?: Logger): Promise<boolean> {
  for (const r of rules) {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: r.key, p_endpoint: endpoint, p_max: r.max, p_window_seconds: r.windowSeconds,
    });
    if (error) { log?.("rate_limit_error", { code: error.code }); continue; } // fail-open on infra error
    if (data === false) { log?.("rate_limited", { rule: r.key.split(":")[0] }); return false; }
  }
  return true;
}

export async function refundUsage(admin: SupabaseClient, userId: string | null, log?: Logger) {
  if (!userId) return;
  const { error } = await admin.rpc("refund_analysis_usage", { p_user_id: userId });
  log?.("usage_refund", { ok: !error });
}
