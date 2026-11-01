"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");
const [showPassword, setShowPassword] = useState(false);

async function handleLogin(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

setError("");
setLoading(true);

try {
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (loginError) {
    if (
      loginError.message.toLowerCase().includes("email not confirmed")
    ) {
      throw new Error(
        "Please verify your email using the confirmation link we sent you before signing in."
      );
    }

    throw new Error("Invalid email or password. Please try again.");
  }

  router.replace("/dashboard");
  router.refresh();
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : "Something went wrong. Please try again."
  );
} finally {
  setLoading(false);
}

}

return (
<main className="auth-viewport relative flex items-center justify-center overflow-hidden bg-[#07111f] px-5 py-12 text-white">
{/* Decorative background */}
<div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />

  <div
    aria-hidden="true"
    className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
  />

  <div className="auth-content relative z-10 w-full max-w-md">
    {/* Back to homepage */}
    <Link
      href="/"
      className="mb-8 inline-flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200"
    >
      <span aria-hidden="true">←</span>
      Back to home
    </Link>

    {/* Login card */}
    <div className="auth-card rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-9">
      {/* Brand */}
      <div className="mb-8">
        <Link href="/" className="mb-7 inline-flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-[#07111f]">
            C
          </span>

          <span className="text-lg font-bold tracking-tight">
            Custodial<span className="text-cyan-300">Support</span>
          </span>
        </Link>

        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Welcome back
        </p>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sign in to your account
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Access your dashboard and manage your trade conversations.
        </p>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} className="auth-form space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-200"
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
            className="w-full rounded-lg border border-white/15 bg-[#0b1728] px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <Link
              href="/forgot-password"
              className="text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-white/15 bg-[#0b1728] px-4 py-3 pr-20 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
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
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm leading-5 text-red-300"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-cyan-400 px-4 py-3.5 font-semibold text-[#07111f] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Signup link */}
      <p className="mt-7 text-center text-sm text-slate-300">
        Don't have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-cyan-300 transition hover:text-cyan-200"
        >
          Create an account
        </Link>
      </p>
    </div>

    <p className="auth-footer mt-6 text-center text-xs leading-5 text-slate-500">
      Keep your password private. Never share your login credentials or
      verification codes with anyone.
    </p>
  </div>
</main>

);
}
