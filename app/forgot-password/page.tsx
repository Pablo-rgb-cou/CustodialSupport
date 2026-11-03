"use client";

import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import AuthFrame from "@/app/components/AuthFrame";
import { supabase } from "@/lib/supabase";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { normaliseEmail, verificationCooldown } from "@/lib/email-verification";

function subscribeToReturnLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function returnLocationSnapshot() {
  return new URLSearchParams(window.location.search).get("returnTo") === "settings";
}

function noSettingsReturn() { return false; }

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const returnToSettings = useSyncExternalStore(subscribeToReturnLocation, returnLocationSnapshot, noSettingsReturn);
  useEffect(() => {
    if (returnToSettings) {
      let active = true;
      void withRequestTimeout(() => supabase.auth.getSession(), { timeoutMs: 4000 }).then(({ data }) => { if (active) setEmail((current) => current || data.session?.user.email || ""); }).catch(() => {});
      return () => { active = false; };
    }
  }, [returnToSettings]);
  useEffect(() => {
    if (!sentAt) return;
    const update = () => setCooldown(verificationCooldown(sentAt));
    update(); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || (sentAt && verificationCooldown(sentAt) > 0)) return;
    setError(""); setLoading(true); setSentAt(Date.now());
    try {
      const { error } = await withRequestTimeout(() => supabase.auth.resetPasswordForEmail(normaliseEmail(email), {
        redirectTo: `${window.location.origin}/reset-password${returnToSettings ? "?returnTo=settings" : ""}`,
      }));
      if (error) throw error;
      setSent(true);
    } catch { setError("We couldn't send the reset instructions. Please wait a moment and try again."); }
    finally { setLoading(false); }
  }

  return (
    <AuthFrame eyebrow="Account recovery" title="Reset your password" description="Enter your account email and we’ll send a secure reset link." backHref={returnToSettings ? "/dashboard?section=Settings" : "/login"} backLabel={returnToSettings ? "Back to settings" : "Back to sign in"}>
      <form onSubmit={submit} className="auth-form space-y-4">
        <label htmlFor="reset-email" className="block text-sm font-medium text-slate-200">Email address<input id="reset-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#071321] px-3.5 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60" /></label>
        {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200">{error}</p>}
        {sent && <div role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-3 text-sm leading-6 text-emerald-200"><p>If an account exists with this email, you’ll receive reset instructions. Check your inbox and spam folder.</p>{returnToSettings && <Link href="/dashboard?section=Settings" className="mt-2 inline-flex font-semibold text-cyan-200 underline underline-offset-4">Return to settings</Link>}</div>}
        <button type="submit" disabled={loading || cooldown > 0} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:opacity-50">{loading ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : sent ? "Send another reset link" : "Send reset instructions"}</button>
      </form>
    </AuthFrame>
  );
}
