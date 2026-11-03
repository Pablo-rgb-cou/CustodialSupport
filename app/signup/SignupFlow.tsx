"use client";

import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthFrame from "@/app/components/AuthFrame";
import { supabase } from "@/lib/supabase";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { clearPendingVerification, normaliseEmail, normaliseVerificationCode, readPendingVerification, savePendingVerification, validVerificationCode, validVerificationEmail, verificationCooldown, type PendingEmailVerification } from "@/lib/email-verification";
import { recordSessionActivity } from "@/lib/session-activity";

const inputClass = "w-full rounded-xl border border-white/10 bg-[#071321] px-3.5 py-3 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-60";
const submitClass = "flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";

function subscribeToSavedVerification(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function savedVerificationSnapshot() {
  const saved = readPendingVerification();
  // A primitive snapshot stays stable until the saved email or timestamp changes.
  return saved ? JSON.stringify(saved) : null;
}

function noSavedVerification() { return null; }

export default function SignupFlow({ verificationOnly = false }: { verificationOnly?: boolean }) {
  const router = useRouter();
  const savedSnapshot = useSyncExternalStore(subscribeToSavedVerification, verificationOnly ? savedVerificationSnapshot : noSavedVerification, noSavedVerification);
  const restoredPending = useMemo(() => savedSnapshot ? JSON.parse(savedSnapshot) as PendingEmailVerification : null, [savedSnapshot]);
  const [fullName, setFullName] = useState("");
  const [emailInput, setEmail] = useState<string | undefined>(undefined);
  const email = emailInput ?? restoredPending?.email ?? "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pendingSelection, setPending] = useState<PendingEmailVerification | null | undefined>(undefined);
  const pending = pendingSelection === undefined ? restoredPending : pendingSelection;
  const isVerifying = verificationOnly || Boolean(pending);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!pending || pending.email !== normaliseEmail(email)) return;
    const update = () => setCooldown(verificationCooldown(pending.sentAt));
    update(); const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [email, pending]);

  const resendCooldown = pending?.email === normaliseEmail(email) ? cooldown : 0;

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(""); setMessage("");
    if (!fullName.trim()) { setError("Enter your full name."); return; }
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    setLoading(true);
    try {
      const address = normaliseEmail(email);
      if (!validVerificationEmail(address)) { setError("Enter a valid email address."); return; }
      const { data, error } = await withRequestTimeout(() => supabase.auth.signUp({
        email: address, password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` },
      }));
      if (error) throw error;
      setPassword("");
      if (data.session && data.user) {
        // Environments with email auto-confirmation can already have a verified
        // session. Hosted production confirmation settings enforce the OTP step.
        clearPendingVerification(); recordSessionActivity(data.user.id); router.replace("/dashboard"); return;
      }
      const next = { email: address, sentAt: Date.now() };
      savePendingVerification(next); setPending(next); setCode("");
      router.replace("/verify-email", { scroll: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn't create your account. Please try again.");
    } finally { setLoading(false); }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || resending) return;
    setError(""); setMessage("");
    const address = normaliseEmail(email);
    if (!validVerificationEmail(address)) { setError("Enter the email address used to create your account."); return; }
    if (!validVerificationCode(code)) { setError("Enter the six-digit code from your email."); return; }
    setLoading(true);
    try {
      const { data, error } = await withRequestTimeout(() => supabase.auth.verifyOtp({ email: address, token: code, type: "email" }));
      if (error) throw error;
      if (!data.session || !data.user) throw new Error("The code could not be verified. Request another code and try again.");
      clearPendingVerification(); setCode(""); recordSessionActivity(data.user.id);
      router.replace("/dashboard");
    } catch { setError("That code is invalid or has expired. Check the latest email or request a new code."); }
    finally { setLoading(false); }
  }

  async function resendCode() {
    if (resending || loading) return;
    const address = normaliseEmail(email);
    if (!validVerificationEmail(address)) { setError("Enter the email address used to create your account."); return; }
    if (pending?.email === address && verificationCooldown(pending.sentAt) > 0) return;
    setError(""); setMessage(""); setResending(true);
    // Apply the cooldown to attempts too, so retrying an error cannot flood Auth.
    const next = { email: address, sentAt: Date.now() };
    savePendingVerification(next); setPending(next);
    try {
      const { error } = await withRequestTimeout(() => supabase.auth.resend({ type: "signup", email: address, options: { emailRedirectTo: `${window.location.origin}/dashboard` } }));
      if (error) throw error;
      setMessage("A new verification code has been requested. Check your inbox and spam folder.");
    } catch { setError("We couldn't resend the code. Please wait a moment and try again."); }
    finally { setResending(false); }
  }

  return (
    <AuthFrame eyebrow={isVerifying ? "Email verification" : "Get started"} title={isVerifying ? "Verify your email" : "Create your account"} description={isVerifying ? "Enter the email you registered with and the six-digit code from your inbox to continue." : "Create your account to follow requests and talk to our support team."}>
      {isVerifying ? (
        <form onSubmit={verifyEmail} className="auth-form space-y-4">
          <label htmlFor="verification-email" className="block text-sm font-medium text-slate-200">Registered email address<input id="verification-email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={loading || resending} value={email} onChange={(event) => { setEmail(event.target.value); setCode(""); setError(""); setMessage(""); }} placeholder="you@example.com" className={`${inputClass} mt-1.5`} /></label>
          <label htmlFor="verification-code" className="block text-sm font-medium text-slate-200">Verification code</label>
          <input id="verification-code" name="verification-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(normaliseVerificationCode(event.target.value))} disabled={loading || resending} placeholder="000000" aria-describedby="verification-help" className={`${inputClass} auth-code-input text-center text-2xl font-semibold tracking-[.45em]`} />
          <p id="verification-help" className="text-xs leading-5 text-slate-400">Use the newest code within ten minutes. You can paste all six digits at once.</p>
          {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-3 text-sm text-emerald-200">{message}</p>}
          <button type="submit" disabled={loading || resending || code.length !== 6} className={submitClass}>{loading ? "Verifying…" : "Verify email and continue"}</button>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <button type="button" disabled={loading || resending || resendCooldown > 0 || !validVerificationEmail(normaliseEmail(email))} onClick={() => void resendCode()} className="min-h-9 font-semibold text-cyan-200 transition hover:text-cyan-100 disabled:text-slate-500">{resending ? "Sending…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}</button>
            <button type="button" disabled={loading || resending} onClick={() => { clearPendingVerification(); setPending(null); setCode(""); setError(""); setMessage(""); router.replace("/signup", { scroll: false }); }} className="min-h-9 text-slate-400 transition hover:text-slate-200">Create an account</button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="auth-form space-y-3.5">
          <label className="block text-sm font-medium text-slate-200" htmlFor="fullName">Full name<input id="fullName" name="fullName" autoComplete="name" required maxLength={100} disabled={loading} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" className={`${inputClass} mt-1.5`} /></label>
          <label className="block text-sm font-medium text-slate-200" htmlFor="email">Email address<input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={loading} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={`${inputClass} mt-1.5`} /></label>
          <div><label className="block text-sm font-medium text-slate-200" htmlFor="password">Password</label><div className="relative mt-1.5"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required disabled={loading} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className={`${inputClass} pr-20`} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-3 px-1 text-xs font-semibold text-cyan-200">{showPassword ? "Hide" : "Show"}</button></div></div>
          {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200">{error}</p>}
          <button type="submit" disabled={loading} className={submitClass}>{loading ? "Creating account…" : "Create account"}</button>
        </form>
      )}
      <p className="mt-5 text-center text-xs text-slate-400">Already have an account? <Link href="/login" className="font-semibold text-cyan-200 hover:text-cyan-100">Sign in</Link></p>
    </AuthFrame>
  );
}
