
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (signupError) {
        throw signupError;
      }

      if (data.session) {
        setMessage(
          "Your account has been created successfully. You can now continue to sign in."
        );
      } else {
        setMessage(
          "Registration successful! Check your email and click the confirmation link before signing in."
        );
      }

      setFullName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't create your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-viewport relative flex items-center justify-center overflow-hidden bg-[#07111f] px-5 py-3 text-white sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
      />

      <div className="auth-content relative z-10 w-full max-w-md">
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-2 text-xs text-cyan-300 transition hover:text-cyan-200 sm:mb-8 sm:text-sm"
        >
          <span aria-hidden="true">←</span>
          Back to home
        </Link>

        <div className="auth-card rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
          <div className="mb-4 sm:mb-8">
            <Link href="/" className="mb-3 inline-flex items-center gap-2 sm:mb-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-[#07111f] sm:h-10 sm:w-10">
                C
              </span>

              <span className="text-lg font-bold tracking-tight">
                Custodial<span className="text-cyan-300">Support</span>
              </span>
            </Link>

            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300 sm:mb-3 sm:text-sm">
              Get started
            </p>

            <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
              Create your account
            </h1>

            <p className="mt-1.5 text-xs leading-5 text-slate-300 sm:mt-3 sm:text-sm sm:leading-6">
              Register to access your account and manage your trade conversations.
            </p>
          </div>

          <form onSubmit={handleSignup} className="auth-form space-y-2.5 sm:space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="mb-1 block text-xs font-medium text-slate-200 sm:mb-2 sm:text-sm"
              >
                Full name
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-white/15 bg-[#0b1728] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 sm:py-3 sm:text-base"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-medium text-slate-200 sm:mb-2 sm:text-sm"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/15 bg-[#0b1728] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 sm:py-3 sm:text-base"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-xs font-medium text-slate-200 sm:mb-2 sm:text-sm"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-white/15 bg-[#0b1728] px-4 py-2.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 sm:py-3 sm:text-base"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-3 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <p className="mt-1 text-[10px] leading-3.5 text-slate-400 sm:mt-2 sm:text-xs sm:leading-normal">
                Use at least 8 characters and choose a password you haven&apos;t used elsewhere.
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm leading-5 text-red-300"
              >
                {error}
              </p>
            )}

            {message && (
              <div
                role="status"
                className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm leading-5 text-emerald-300"
              >
                {message}

              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5 sm:text-base"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-300 sm:mt-7 sm:text-sm">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="auth-footer mt-3 text-center text-[10px] leading-4 text-slate-500 sm:mt-6 sm:text-xs sm:leading-5">
          Keep your password private. Never share your password or email verification link with anyone.
        </p>
      </div>
    </main>
  );
}
