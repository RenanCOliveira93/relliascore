// Shared utility to dispatch outgoing webhooks for a workspace.
// Uses service role to read webhook configs and record delivery results.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function dispatchWebhooks(
  workspaceId: string | null | undefined,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!workspaceId) return;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: webhooks, error } = await admin
    .from("workspace_webhooks")
    .select("id, url, secret, events, is_active")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (error || !webhooks || webhooks.length === 0) return;

  const body = JSON.stringify({
    event,
    workspace_id: workspaceId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.all(
    webhooks
      .filter((w: any) => Array.isArray(w.events) && w.events.includes(event))
      .map(async (w: any) => {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "RELLIA-Webhook/1.0",
            "X-Rellia-Event": event,
          };
          if (w.secret) {
            const sig = await hmacSha256(w.secret, body);
            headers["X-Rellia-Signature"] = `sha256=${sig}`;
          }

          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const res = await fetch(w.url, {
            method: "POST",
            headers,
            body,
            signal: controller.signal,
          });
          clearTimeout(t);

          await admin.rpc("record_webhook_delivery", {
            p_webhook_id: w.id,
            p_success: res.ok,
            p_error: res.ok ? null : `HTTP ${res.status}`,
          });
        } catch (e) {
          await admin.rpc("record_webhook_delivery", {
            p_webhook_id: w.id,
            p_success: false,
            p_error: (e as Error).message?.substring(0, 200) ?? "unknown",
          });
        }
      }),
  );
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
