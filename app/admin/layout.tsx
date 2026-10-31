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
  const [adminId, setAdminId] = useState("");
  const [unreadTicketActivity, setUnreadTicketActivity] = useState(0);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!menuOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const restorePageScroll = () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        restorePageScroll();
        setMenuOpen(false);
      } else {
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
      }
    };

    if (!desktopViewport.matches) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    desktopViewport.addEventListener("change", handleViewportChange);

    return () => {
      desktopViewport.removeEventListener("change", handleViewportChange);
      restorePageScroll();
    };
  }, [menuOpen]);

  useEffect(() => {
    let active = true;

    // Keep the admin login page accessible before authentication.
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
      setAdminId(user.id);
      setAuthorized(true);
      setChecking(false);
    }

    void checkAdmin();

    return () => {
      active = false;
    };
  }, [isLoginPage, router]);

  // Count new tickets and public replies sent by clients.
  useEffect(() => {
    if (!authorized || !adminId || isLoginPage) return;

    let active = true;
    let liveEventVersion = 0;

    const storageKey =
      "custodialsupport:admin-ticket-activity-seen:" + adminId;

    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, new Date().toISOString());
    }

    const getLastSeen = () =>
      localStorage.getItem(storageKey) ?? new Date().toISOString();

    const processedEvents = new Set<string>();

    const loadUnreadCount = async () => {
      const lastSeen = getLastSeen();
      const versionAtStart = liveEventVersion;

      const [ticketResult, messageResult] = await Promise.all([
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .gt("created_at", lastSeen),

        supabase
          .from("ticket_messages")
          .select("id", { count: "exact", head: true })
          .eq("is_internal", false)
          .neq("sender_id", adminId)
          .gt("created_at", lastSeen),
      ]);

      if (!active || getLastSeen() !== lastSeen) return;

      if (ticketResult.error || messageResult.error) {
        console.error(
          "Could not load unread support activity counts:",
          ticketResult.error ?? messageResult.error
        );
        return;
      }

      const databaseCount =
        (ticketResult.count ?? 0) + (messageResult.count ?? 0);

      setUnreadTicketActivity((currentCount) => {
        // Keep a live update if this query started before that event arrived.
        if (liveEventVersion !== versionAtStart) {
          return Math.max(currentCount, databaseCount);
        }

        return databaseCount;
      });
    };

    const recordActivity = (id: string) => {
      if (!id || processedEvents.has(id)) return;

      processedEvents.add(id);
      liveEventVersion += 1;

      // Update the badge immediately, then refresh the count from Supabase.
      setUnreadTicketActivity((count) => count + 1);
      void loadUnreadCount();
    };

    const channel = supabase
      .channel("admin-ticket-activity-badge-" + adminId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_tickets",
        },
        (payload) => {
          const row = payload.new as { id?: string };
          recordActivity(row.id ?? "");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
        },
        (payload) => {
          const row = payload.new as {
            id?: string;
            sender_id?: string;
            is_internal?: boolean | null;
          };

          // Count client messages, but ignore admin replies and internal notes.
          if (row.sender_id !== adminId && row.is_internal !== true) {
            recordActivity(row.id ?? "");
          }
        }
      )
      .subscribe((status, error) => {
        console.log("[admin ticket badge] subscription:", status, error);

        if (status === "SUBSCRIBED") {
          void loadUnreadCount();
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [authorized, adminId, isLoginPage]);

  // Mark activity as seen when navigating to Support tickets.
  useEffect(() => {
    if (!adminId || !pathname.startsWith("/admin/tickets")) return;

    const seenKey = "custodialsupport:admin-ticket-activity-seen:" + adminId;
    const previousSeenKey =
      "custodialsupport:admin-ticket-activity-previous-seen:" + adminId;
    const now = new Date().toISOString();
    localStorage.setItem(
      previousSeenKey,
      localStorage.getItem(seenKey) ?? now
    );
    localStorage.setItem(seenKey, now);
    setUnreadTicketActivity(0);
  }, [pathname, adminId]);

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
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[260px] flex-col overflow-hidden border-r border-cyan-200/10 bg-[#061523]/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
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
          className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3"
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

                <span className="flex-1">{item.label}</span>

                {item.href === "/admin/tickets" &&
                  unreadTicketActivity > 0 && (
                    <span
                      aria-label={`${unreadTicketActivity} unread support activities`}
                      className="inline-flex min-w-6 items-center justify-center rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs font-semibold text-cyan-100"
                    >
                      {unreadTicketActivity > 99
                        ? "99+"
                        : unreadTicketActivity}
                    </span>
                  )}
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
