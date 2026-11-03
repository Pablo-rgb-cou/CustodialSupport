export type PendingEmailVerification = { email: string; sentAt: number };
const storageKey = "custodialsupport:pending-email-verification:v1";
export const verificationResendSeconds = 60;

export function normaliseEmail(value: string) { return value.trim().toLowerCase(); }
export function validVerificationEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
export function normaliseVerificationCode(value: string) { return value.replace(/\D/g, "").slice(0, 6); }
export function validVerificationCode(value: string) { return /^\d{6}$/.test(value); }
export function verificationCooldown(sentAt: number, now = Date.now()) {
  return Math.max(0, Math.min(verificationResendSeconds, Math.ceil((sentAt + verificationResendSeconds * 1000 - now) / 1000)));
}
export function savePendingVerification(value: PendingEmailVerification) {
  try { window.sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, ...value })); } catch { /* The current form remains usable without browser storage. */ }
}
export function readPendingVerification(): PendingEmailVerification | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(storageKey) ?? "null") as { version?: unknown; email?: unknown; sentAt?: unknown } | null;
    if (value?.version !== 1 || typeof value.email !== "string" || !validVerificationEmail(normaliseEmail(value.email)) || typeof value.sentAt !== "number" || !Number.isFinite(value.sentAt)) return null;
    if (Date.now() - value.sentAt > 24 * 60 * 60 * 1000 || value.sentAt > Date.now() + 60000) return null;
    return { email: normaliseEmail(value.email), sentAt: value.sentAt };
  } catch { return null; }
}
export function clearPendingVerification() {
  try { window.sessionStorage.removeItem(storageKey); } catch { /* No stored password or code needs clearing. */ }
}
