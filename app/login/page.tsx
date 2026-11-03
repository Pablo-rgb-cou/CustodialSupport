"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthFrame from "@/app/components/AuthFrame";
import { supabase } from "@/lib/supabase";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { clearPendingVerification, normaliseEmail, savePendingVerification, verificationResendSeconds } from "@/lib/email-verification";
import { recordSessionActivity } from "@/lib/session-activity";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(""); setNeedsVerification(false); setLoading(true);
    try {
      const { data, error } = await withRequestTimeout(() => supabase.auth.signInWithPassword({ email: normaliseEmail(email), password }));
      if (error) {
        if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message)) {
          setNeedsVerification(true);
          throw new Error("Verify your email with the six-digit code before signing in.");
        }
        if (error.code === "invalid_credentials") throw new Error("The email or password is incorrect. Please try again.");
        throw error;
      }
      if (!data.session || !data.user) throw new Error("We couldn't complete sign-in. Please try again.");
      clearPendingVerification(); recordSessionActivity(data.user.id);
      router.replace("/dashboard");
    } catch (error) { setError(error instanceof Error ? error.message : "We couldn't sign you in. Please try again."); }
    finally { setLoading(false); }
  }
  const inputClass = "w-full rounded-xl border border-white/10 bg-[#071321] px-3.5 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60";
  return (
    <AuthFrame eyebrow="Welcome back" title="Sign in to your account" description="Access your account and continue your support conversations.">
      <form onSubmit={handleLogin} className="auth-form space-y-4">
        <label className="block text-sm font-medium text-slate-200" htmlFor="email">Email address<input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={`${inputClass} mt-1.5`} /></label>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3"><label className="text-sm font-medium text-slate-200" htmlFor="password">Password</label><Link href="/forgot-password" className="text-xs font-medium text-cyan-200 hover:text-cyan-100">Forgot password?</Link></div>
          <div className="relative"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className={`${inputClass} pr-20`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-3 px-1 text-xs font-semibold text-cyan-200">{showPassword ? "Hide" : "Show"}</button></div>
        </div>
        {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm leading-5 text-rose-200"><p>{error}</p>{needsVerification && <Link href="/verify-email" onClick={() => savePendingVerification({ email: normaliseEmail(email), sentAt: Date.now() - verificationResendSeconds * 1000 })} className="mt-2 inline-flex font-semibold text-cyan-200 underline underline-offset-4">Enter verification code</Link>}</div>}
        <button type="submit" disabled={loading} className="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:opacity-50">{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-400">Don&apos;t have an account? <Link href="/signup" className="font-semibold text-cyan-200 hover:text-cyan-100">Create an account</Link></p>
    </AuthFrame>
  );
}
