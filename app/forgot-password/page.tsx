"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [returnToSettings, setReturnToSettings] = useState(false);

  useEffect(() => {
    setReturnToSettings(
      new URLSearchParams(window.location.search).get("returnTo") === "settings"
    );
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSent(false);
    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password${returnToSettings ? "?returnTo=settings" : ""}`,
        });

      if (resetError) {
        setError("Unable to process your request. Please try again.");
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-5 py-12 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[.04] p-7 sm:p-9">
        <a
          href={returnToSettings ? "/dashboard?section=Settings" : "/login"}
          className="text-sm text-cyan-300 hover:text-cyan-200"
        >
          {returnToSettings ? "← Back to settings" : "← Back to sign in"}
        </a>

        <p className="mt-7 text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
          Account recovery
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Reset your password
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-400">
          Enter the email associated with your account. If an account
          exists, password reset instructions will be sent.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-200">
            Email address

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="Enter your email address"
              className="mt-2 w-full rounded-xl border border-white/15 bg-[#0b1728] px-4 py-3 text-white outline-none focus:border-cyan-400 disabled:opacity-50"
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
          )}

          {sent && (
            <div
              role="status"
              className="space-y-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[.06] p-3 text-sm text-emerald-200"
            >
              <p>
                If an account exists with this email address, you will
                receive password reset instructions.
              </p>
              {returnToSettings && (
                <a
                  href="/dashboard?section=Settings"
                  className="inline-flex font-semibold text-cyan-200 underline-offset-4 hover:underline"
                >
                  Return to settings
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset instructions"}
          </button>
        </form>
      </section>
    </main>
  );
}
