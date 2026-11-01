"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            // Authenticate using Supabase Auth.
            const { data: authData, error: authError } =
                await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password,
                });

            if (authError) {
                setError("Invalid email or password. Please try again.");
                return;
            }

            if (!authData.user) {
                setError("Unable to verify your account. Please try again.");
                return;
            }

            // Check the authenticated user's actual database role.
            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", authData.user.id)
                .maybeSingle();

            if (profileError) {
                await supabase.auth.signOut();
                console.error("Admin profile lookup failed:", profileError);
                setError(
                    "We couldn't verify your administrator permissions. Please try again."
                );
                return;
            }

            if (!profile || profile.role !== "admin") {
                await supabase.auth.signOut();
                setError(
                    "This account does not have administrator access. Please use your administrator account."
                );
                return;
            }

            // Navigate only after the admin role is verified.
            router.replace("/admin");
            router.refresh();
        } catch (err) {
            console.error("Admin login failed:", err);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }

    }

    return (
        <main className="auth-viewport relative flex items-center justify-center overflow-hidden bg-[#04111f] px-5 py-12 text-white">
            <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

            <section className="auth-card relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1b2b]/95 p-7 shadow-2xl shadow-black/30 sm:p-10">
                <Link
                    href="/"
                    className="mb-9 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
                >
                    <span aria-hidden="true">←</span>
                    Back to website
                </Link>

                <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-2xl text-cyan-300">
                    ◈
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Secure administrator access
                </p>

                <h1 className="text-3xl font-semibold tracking-tight">
                    Admin sign in
                </h1>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                    Sign in with your administrator credentials to access the
                    CustodialSupport dashboard.
                </p>

                <form onSubmit={handleLogin} className="auth-form mt-8 space-y-5">
                    <div>
                        <label
                            htmlFor="admin-email"
                            className="mb-2 block text-sm font-medium text-slate-200"
                        >
                            Administrator email
                        </label>

                        <input
                            id="admin-email"
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="admin@example.com"
                            required
                            disabled={loading}
                            className="w-full rounded-xl border border-white/10 bg-[#061321] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="admin-password"
                            className="mb-2 block text-sm font-medium text-slate-200"
                        >
                            Password
                        </label>

                        <div className="relative">
                            <input
                                id="admin-password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                                className="w-full rounded-xl border border-white/10 bg-[#061321] px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/10 disabled:opacity-60"
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="absolute inset-y-0 right-3 text-xs font-medium text-cyan-300 transition hover:text-cyan-200"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-300"
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 text-sm font-semibold text-[#04111f] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Verifying administrator..." : "Sign in to dashboard"}
                        {!loading && <span aria-hidden="true">→</span>}
                    </button>
                </form>

                <div className="mt-7 border-t border-white/10 pt-5">
                    <p className="text-center text-xs leading-5 text-slate-500">
                        Administrator access is restricted to accounts with an authorized
                        admin role.
                    </p>
                </div>
            </section>
        </main>
    );
}
