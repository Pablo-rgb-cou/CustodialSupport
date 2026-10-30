"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
        session
      ) {
        setSessionReady(true);
        setVerifying(false);
        setError("");
      }
    });

    async function verifyRecoverySession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!active) return;

      if (sessionError) {
        setError(
          "Your password reset link could not be verified. Please request a new one."
        );
        setVerifying(false);
        return;
      }

      if (session) {
        setSessionReady(true);
        setVerifying(false);
        return;
      }

      // Allow Supabase time to process the recovery callback.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!active) return;

      const {
        data: { session: refreshedSession },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (refreshedSession) {
        setSessionReady(true);
      } else {
        setError(
          "Your password reset link is invalid or has expired. Please request a new one."
        );
      }

      setVerifying(false);
    }

    void verifyRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (!sessionReady) {
      setError("Your recovery session is invalid. Request a new reset link.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(
        "Your password has been updated successfully. You can now sign in."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/admin/login");
      }, 2000);
    } catch (err) {
      console.error("Password reset error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#04111f] text-white">
        <p className="text-sm text-slate-300">
          Verifying your password reset link...
        </p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#04111f] px-5 py-12 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1b2b]/95 p-7 shadow-2xl shadow-black/30 sm:p-10">
        <Link
          href="/admin/login"
          className="mb-9 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
        >
          ← Back to administrator login
        </Link>

        <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-2xl text-cyan-300">
          ◈
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Account recovery
        </p>

        <h1 className="text-3xl font-semibold tracking-tight">
          Create new password
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Choose a new secure password for your account.
        </p>

        {sessionReady ? (
          <form onSubmit={handleReset} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                New password
              </label>

              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={loading || !!success}
                  className="w-full rounded-xl border border-white/10 bg-[#061321] px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 text-xs font-medium text-cyan-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-medium text-slate-200"
              >
                Confirm new password
              </label>

              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                autoComplete="new-password"
                required
                disabled={loading || !!success}
                className="w-full rounded-xl border border-white/10 bg-[#061321] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-300"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-300"
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !!success}
              className="flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-[#04111f] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        ) : (
          <div className="mt-8 space-y-5">
            <div
              role="alert"
              className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-300"
            >
              {error}
            </div>

            <Link
              href="/forgot-password"
              className="flex w-full justify-center rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-[#04111f] transition hover:bg-cyan-300"
            >
              Request another reset link
            </Link>
          </div>
        )}

        <div className="mt-7 border-t border-white/10 pt-5">
          <p className="text-center text-xs leading-5 text-slate-500">
            Use a password you have not used on another website.
          </p>
        </div>
      </section>
    </main>
  );
}