// Server-side ownership resolution for Brand Brain persistence. Never trusts browser IDs without re-checking.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const hostMatches = (empresaUrl: string, domain: string): boolean => {
  try {
    const h = new URL(/^https?:\/\//i.test(empresaUrl) ? empresaUrl : `https://${empresaUrl}`).hostname.replace(/^www\./, "").toLowerCase();
    return h === domain.toLowerCase();
  } catch { return false; }
};

/** Explicit empresaId (verified against user+workspace) or, failing that, the workspace company whose URL host equals the analysed site. */
export async function resolveEmpresa(admin: SupabaseClient, userId: string, workspaceId: string, empresaId: unknown, domain: string | null): Promise<string | null> {
  if (typeof empresaId === "string" && UUID_RE.test(empresaId)) {
    const { data } = await admin.from("empresas").select("id").eq("id", empresaId).eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    return (data?.id as string) ?? null;
  }
  if (!domain) return null;
  const { data } = await admin.from("empresas").select("id,url").eq("workspace_id", workspaceId).eq("user_id", userId);
  const matches = (data ?? []).filter((e: { url: string }) => hostMatches(e.url, domain));
  return matches.length === 1 ? (matches[0].id as string) : null; // ambiguous → do not guess
}
