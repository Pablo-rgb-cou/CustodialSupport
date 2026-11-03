"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import AuthFrame from "@/app/components/AuthFrame";
import { supabase } from "@/lib/supabase";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { recordSessionActivity } from "@/lib/session-activity";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [returnToSettings, setReturnToSettings] = useState(false);
  const [verificationAttempt, setVerificationAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    setReturnToSettings(query.get("returnTo") === "settings");
    setVerifying(true); setError("");
    if (query.has("error") || fragment.has("error")) {
      setError("This reset link is invalid or has expired. Request a new reset link."); setSessionReady(false); setVerifying(false); return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Do not await another Auth call inside this callback: the SDK holds its
      // session lock until the callback completes.
      if (active && event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true); setVerifying(false); setError("");
      }
      if (active && event === "SIGNED_OUT") { setSessionReady(false); setError("Your session has ended. Request another reset link."); }
    });
    void withRequestTimeout(() => supabase.auth.getUser(), { signal: controller.signal }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) { setSessionReady(false); setError("This reset link could not be verified. Request a new one or try again."); }
      else { setSessionReady(true); recordSessionActivity(data.user.id); }
    }).catch(() => { if (active) setError("We couldn't verify the reset link just now. Please try again."); }).finally(() => { if (active) setVerifying(false); });
    return () => { active = false; controller.abort(); subscription.unsubscribe(); };
  }, [verificationAttempt]);

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || success || !sessionReady) return;
    setError("");
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (password !== confirmation) { setError("Your passwords do not match."); return; }
    setLoading(true);
    try {
      const { data, error } = await withRequestTimeout(() => supabase.auth.updateUser({ password }));
      if (error) throw error;
      setPassword(""); setConfirmation(""); setSuccess(true);
      if (data.user) recordSessionActivity(data.user.id);
      // Sending/resetting a password is not a sign-out action. Preserve the
      // recovery or current account session when returning to Settings.
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't update your password. Please try again."); }
    finally { setLoading(false); }
  }
  const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-[#071321] px-3.5 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60";
  return (
    <AuthFrame eyebrow="Account recovery" title={success ? "Password updated" : "Create a new password"} description={success ? "Your new password is ready. You can continue using your account." : "Choose a strong password you haven’t used elsewhere."} backHref={returnToSettings ? "/dashboard?section=Settings" : "/login"} backLabel={returnToSettings ? "Back to settings" : "Back to sign in"}>
      {verifying ? <p role="status" className="py-6 text-center text-sm text-slate-400">Verifying your reset link…</p> : success ? <div className="space-y-4"><p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-3 text-sm text-emerald-200">Your password has been changed successfully.</p><Link href={returnToSettings ? "/dashboard?section=Settings" : "/dashboard"} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950">{returnToSettings ? "Return to settings" : "Continue to your account"}</Link></div> : sessionReady ? (
        <form onSubmit={handleReset} className="auth-form space-y-4">
          <div><label htmlFor="new-password" className="block text-sm font-medium text-slate-200">New password</label><div className="relative"><input id="new-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={`${inputClass} pr-20`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-3 pt-1.5 text-xs font-semibold text-cyan-200">{showPassword ? "Hide" : "Show"}</button></div></div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-200">Confirm password<input id="confirm-password" name="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} disabled={loading} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter your new password again" className={inputClass} /></label>
          {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{loading ? "Updating…" : "Update password"}</button>
        </form>
      ) : <div className="space-y-4"><p role="alert" className="rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-3 text-sm text-amber-100">{error || "Open the reset link from your email to continue."}</p><button type="button" onClick={() => setVerificationAttempt((value) => value + 1)} className="min-h-10 rounded-xl border border-white/10 px-4 py-2 text-sm text-cyan-200">Try verification again</button><Link href={returnToSettings ? "/forgot-password?returnTo=settings" : "/forgot-password"} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950">Request another reset link</Link></div>}
    </AuthFrame>
  );
}
