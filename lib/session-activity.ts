export const defaultIdleTimeoutMs = 60 * 60 * 1000;
export function sessionActivityKey(userId: string) { return `custodialsupport:last-active:v1:${userId}`; }
export function recordSessionActivity(userId: string, timestamp = Date.now()) {
  if (!userId) return;
  try { window.localStorage.setItem(sessionActivityKey(userId), String(timestamp)); } catch { /* The mounted session guard also tracks activity in memory. */ }
}
export function sessionHasEnded(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { name?: string; code?: string; status?: number };
  // Access-token expiry alone is refreshable; network failures never prove logout.
  return value.name === "AuthSessionMissingError" || ["session_not_found", "session_expired", "user_not_found", "refresh_token_not_found", "refresh_token_already_used", "invalid_grant"].includes(value.code ?? "");
}
