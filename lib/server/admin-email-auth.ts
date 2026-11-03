import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupportEmailUserClient } from "./support-email";

export class AdminEmailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function emailServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new AdminEmailError(503, "Server email services are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}

export async function authorizeEmailAdmin(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") throw new AdminEmailError(403, "Request origin is not allowed.");
  const token = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) throw new AdminEmailError(401, "Sign in as an administrator first.");
  const verifier = createSupportEmailUserClient(token);
  const { data: { user }, error } = await verifier.auth.getUser(token);
  if (error || !user) throw new AdminEmailError(401, "Your administrator session has expired.");
  const { data: profile, error: roleError } = await verifier.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError) throw new AdminEmailError(503, "Could not verify administrator access.");
  if (profile?.role !== "admin") throw new AdminEmailError(403, "Administrator access is required.");
  return { actorId: user.id, service: emailServiceClient() };
}

export async function readEmailJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new AdminEmailError(415, "Use a JSON request.");
  if (!request.body) throw new AdminEmailError(400, "A message is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, raw = "";
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 24000) { await reader.cancel(); throw new AdminEmailError(413, "The email is too long."); } raw += decoder.decode(value, { stream: true }); }
    raw += decoder.decode();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (error) { if (error instanceof AdminEmailError) throw error; throw new AdminEmailError(400, "Invalid email request."); }
  finally { reader.releaseLock(); }
}
