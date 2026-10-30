"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
{ label: "Overview", href: "/admin", icon: "⌂" },
{ label: "Support tickets", href: "/admin/tickets", icon: "▤" },
{ label: "Withdrawals", href: "/admin/withdrawals", icon: "↗" },
{ label: "Clients", href: "/admin/clients", icon: "♙" },
{ label: "Notifications", href: "/admin/notifications", icon: "♧" },
{ label: "Activity log", href: "/admin/activity", icon: "◷" },
{ label: "Settings", href: "/admin/settings", icon: "⚙" },
];

export default function AdminLayout({
children,
}: {
children: ReactNode;
}) {
const router = useRouter();
const pathname = usePathname();

const isLoginPage = pathname === "/admin/login";

const [checking, setChecking] = useState(!isLoginPage);
const [authorized, setAuthorized] = useState(false);
const [menuOpen, setMenuOpen] = useState(false);
const [adminEmail, setAdminEmail] = useState("");
const [authError, setAuthError] = useState("");

useEffect(() => {
let active = true;

// The admin login page must be accessible before authentication.
if (isLoginPage) {
  setChecking(false);
  setAuthorized(false);
  setAuthError("");
  return () => {
    active = false;
  };
}

async function checkAdmin() {
  setChecking(true);
  setAuthError("");
  setAuthorized(false);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!active) return;

  if (userError || !user) {
    router.replace("/admin/login");
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!active) return;

  if (profileError) {
    console.error("Admin profile query failed:", profileError);
    setAuthError(
      "We couldn't verify your administrator permissions. Please try again."
    );
    setChecking(false);
    return;
  }

  if (!profile || profile.role !== "admin") {
    setAuthError(
      "This account does not have administrator access. Please sign in with an authorized administrator account."
    );
    setChecking(false);
    return;
  }

  setAdminEmail(user.email ?? "Administrator");
  setAuthorized(true);
  setChecking(false);
}

void checkAdmin();

return () => {
  active = false;
};

}, [isLoginPage, router]);

async function signOut() {
await supabase.auth.signOut();
router.replace("/admin/login");
router.refresh();
}

// Render the login page without the admin sidebar or access check.
if (isLoginPage) {
return <>{children}</>;
}

if (checking) {
return (
<main className="grid min-h-screen place-items-center bg-[#04101d] text-slate-200">
<div className="rounded-2xl border border-cyan-300/15 bg-[#081a2a] px-6 py-5 text-sm text-slate-300">
Checking administrator access…
</div>
</main>
);
}

if (!authorized) {
return (
<main className="grid min-h-screen place-items-center bg-[#04101d] p-6 text-slate-200">
<div className="max-w-md rounded-2xl border border-rose-300/20 bg-[#081a2a] p-6">
<h1 className="text-lg font-semibold text-white">
Access restricted
</h1>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {authError ||
          "This page is only available to authorized administrators."}
      </p>

      <Link
        href="/admin/login"
        className="mt-5 inline-flex rounded-xl border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
      >
        Go to administrator login
      </Link>
    </div>
  </main>
);

}

return (
<div className="min-h-screen bg-[#04101d] text-slate-100 lg:flex">
<div
className="pointer-events-none fixed inset-0 opacity-[0.13]"
aria-hidden="true"
style={{
backgroundImage:
"linear-gradient(rgba(69,160,194,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(69,160,194,.14) 1px, transparent 1px)",
backgroundSize: "36px 36px",
}}
/>

  {menuOpen && (
    <button
      aria-label="Close navigation menu"
      onClick={() => setMenuOpen(false)}
      className="fixed inset-0 z-40 bg-black/60 lg:hidden"
    />
  )}

  <aside
    className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-cyan-200/10 bg-[#061523]/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
      menuOpen ? "translate-x-0" : "-translate-x-full"
    }`}
  >
    <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-lg font-bold text-cyan-200">
        C
      </div>

      <div>
        <p className="font-semibold tracking-wide text-white">
          CustodialSupport
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-cyan-200/60">
          Admin workspace
        </p>
      </div>

      <button
        onClick={() => setMenuOpen(false)}
        className="ml-auto rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 lg:hidden"
        aria-label="Close menu"
      >
        ×
      </button>
    </div>

    <div className="px-4 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
      Management
    </div>

    <nav
      className="flex-1 space-y-1 px-3"
      aria-label="Admin navigation"
    >
      {navItems.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
              active
                ? "border-cyan-200/15 bg-gradient-to-r from-cyan-300/15 to-teal-300/[0.04] text-cyan-100 shadow-[inset_2px_0_0_rgba(103,232,249,.8)]"
                : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-lg text-lg ${
                active
                  ? "bg-cyan-200/10 text-cyan-200"
                  : "bg-white/[0.035] text-slate-400 group-hover:text-slate-200"
              }`}
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>

    <div className="m-3 rounded-2xl border border-cyan-200/10 bg-gradient-to-br from-cyan-300/[0.08] to-blue-400/[0.03] p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-300" />
        <span className="text-xs font-medium text-emerald-200">
          Admin session active
        </span>
      </div>

      <p className="mt-2 break-all text-xs leading-5 text-slate-400">
        {adminEmail}
      </p>

      <button
        onClick={signOut}
        className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-slate-300 transition hover:border-rose-300/25 hover:bg-rose-300/[0.06] hover:text-rose-200"
      >
        Sign out
      </button>
    </div>
  </aside>

  <div className="relative min-w-0 flex-1 lg:ml-[260px]">
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-white/[0.07] bg-[#04101d]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={() => setMenuOpen(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-lg text-slate-200 hover:bg-white/[0.07] lg:hidden"
          aria-label="Open navigation menu"
        >
          ☰
        </button>

        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">
            Admin workspace
          </p>
          <h1 className="truncate text-sm font-semibold text-white sm:text-base">
            {navItems.find((item) =>
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)
            )?.label ?? "Management"}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden max-w-[220px] truncate text-xs text-slate-500 sm:block">
          {adminEmail}
        </span>
        <div className="grid h-9 w-9 place-items-center rounded-full border border-cyan-200/20 bg-cyan-200/10 text-xs font-semibold text-cyan-100">
          AD
        </div>
      </div>
    </header>

    <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
      {children}
    </main>
  </div>
</div>
);
}
