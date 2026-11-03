"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useIdleSession } from "@/lib/use-idle-session";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { sessionHasEnded } from "@/lib/session-activity";
import { AdminChatLayoutContext, useAdminPageScrollLock } from "./admin-chat-layout";

const navItems = [
  { label: "Overview", href: "/admin", icon: "home" },
  { label: "Support tickets", href: "/admin/tickets", icon: "tickets" },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: "withdrawals" },
  { label: "Clients", href: "/admin/clients", icon: "clients" },
  { label: "Notifications", href: "/admin/notifications", icon: "notifications" },
  { label: "Emails", href: "/admin/emails", icon: "emails" },
  { label: "Activity log", href: "/admin/activity", icon: "activity" },
  { label: "Settings", href: "/admin/settings", icon: "settings" },
];

const adminNavigationIconTileColors: Record<string, string> = {
  home: "border-cyan-300/20 bg-cyan-300/[0.09] text-cyan-200",
  withdrawals: "border-emerald-300/20 bg-emerald-300/[0.09] text-emerald-200",
  tickets: "border-sky-300/20 bg-sky-300/[0.09] text-sky-200",
  notifications: "border-amber-300/20 bg-amber-300/[0.09] text-amber-200",
  settings: "border-violet-300/20 bg-violet-300/[0.09] text-violet-200",
  clients: "border-fuchsia-300/20 bg-fuchsia-300/[0.08] text-fuchsia-200",
  activity: "border-indigo-300/20 bg-indigo-300/[0.08] text-indigo-200",
  emails: "border-teal-300/20 bg-teal-300/[0.09] text-teal-200",
};

function AdminNavigationIcon({ icon }: { icon: string }) {
  const common = { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": true as const };
  if (icon === "emails") return <svg {...common}><path d="M3 4.5h18a1.5 1.5 0 0 1 1.5 1.5v.5L12 13 1.5 6.5V6A1.5 1.5 0 0 1 3 4.5Zm-1.5 4L12 15l10.5-6.5V18a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 18V8.5Z" /></svg>;

  if (icon === "home") {
    return <svg {...common}><path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" /><path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" /></svg>;
  }
  if (icon === "withdrawals") {
    return <svg {...common}><path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" /><path fillRule="evenodd" clipRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" /></svg>;
  }
  if (icon === "tickets") {
    return <svg {...common}><path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" /><path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" /></svg>;
  }
  if (icon === "notifications") {
    return <svg {...common}><path fillRule="evenodd" clipRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" /></svg>;
  }
  if (icon === "settings") {
    return <svg {...common}><path fillRule="evenodd" clipRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 0 1-.517.608 7.45 7.45 0 0 0-.478.198.798.798 0 0 1-.796-.064l-.453-.324a1.875 1.875 0 0 0-2.416.2l-.243.243a1.875 1.875 0 0 0-.2 2.416l.324.453a.798.798 0 0 1 .064.796 7.448 7.448 0 0 0-.198.478.798.798 0 0 1-.608.517l-.55.092a1.875 1.875 0 0 0-1.566 1.849v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 0 1-.064.796l-.324.453a1.875 1.875 0 0 0 .2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 0 1 .796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 0 1 .517-.608 7.52 7.52 0 0 0 .478-.198.798.798 0 0 1 .796.064l.453.324a1.875 1.875 0 0 0 2.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 0 1-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.091a1.875 1.875 0 0 0 1.566-1.85v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 0 1-.608-.517 7.507 7.507 0 0 0-.198-.478.798.798 0 0 1 .064-.796l.324-.453a1.875 1.875 0 0 0-.2-2.416l-.243-.243a1.875 1.875 0 0 0-2.416-.2l-.453.324a.798.798 0 0 1-.796.064 7.462 7.462 0 0 0-.478-.198.798.798 0 0 1-.517-.608l-.091-.55a1.875 1.875 0 0 0-1.85-1.566h-.344ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" /></svg>;
  }
  if (icon === "clients") return <svg {...common}><path d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"/><path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z"/></svg>;
  if (icon === "activity") return <svg {...common}><circle cx="12" cy="12" r="9.5"/><path fill="none" stroke="#081a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5V12h4"/></svg>;
  return null;
}

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
  const [authRetry, setAuthRetry] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  useAdminPageScrollLock(chatOpen || menuOpen);

  const expireAdminSession = useCallback(() => {
    setAuthorized(false);
    setChecking(true);
    setAdminId("");
    setMenuOpen(false);
    router.replace("/admin/login?reason=session-expired");
  }, [router]);
  useIdleSession(authorized && !isLoginPage ? adminId : "", expireAdminSession);

  useEffect(() => {
    if (!menuOpen) return;

    const desktopViewport = window.matchMedia("(min-width: 1024px)");
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMenuOpen(false);
      }
    };

    desktopViewport.addEventListener("change", handleViewportChange);

    return () => {
      desktopViewport.removeEventListener("change", handleViewportChange);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "SIGNED_OUT") {
        active = false;
        setAuthorized(false);
        setChecking(true);
        setAdminId("");
        setMenuOpen(false);
        router.replace("/admin/login");
      }
    });

    async function checkAdmin() {
      setChecking(true);
      setAuthError("");
      setAuthorized(false);

      const {
        data: { user },
        error: userError,
      } = await withRequestTimeout(() => supabase.auth.getUser());

      if (!active) return;

      if (userError) {
        if (sessionHasEnded(userError)) router.replace("/admin/login?reason=session-expired");
        else { setAuthError("We couldn't verify your session just now. Please try again."); setChecking(false); }
        return;
      }
      if (!user) { router.replace("/admin/login"); return; }

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

    void checkAdmin().catch(() => {
      if (active) { setAuthError("We couldn't verify your session just now. Please try again."); setChecking(false); }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, router, authRetry]);

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
      if (!active || !id || processedEvents.has(id)) return;

      processedEvents.add(id);
      liveEventVersion += 1;

      // Update the badge immediately, then refresh the count from Supabase.
      setUnreadTicketActivity((count) => count + 1);
      void loadUnreadCount();
    };

    const channel = supabase
      .channel("admin-ticket-activity-badge-" + adminId + ":" + crypto.randomUUID(), { config: { postgres_changes_options: { wait: true } } })
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

          <button type="button" onClick={() => setAuthRetry((count) => count + 1)} className="mt-5 mr-3 inline-flex rounded-xl bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950">Try again</button>
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
    <AdminChatLayoutContext.Provider value={setChatOpen}>
    <div data-admin-conversation-open={chatOpen ? "true" : undefined} className={`admin-shell bg-[#04101d] text-slate-100 ${chatOpen ? "fixed inset-x-0 flex min-h-0 overflow-hidden" : "min-h-screen lg:flex"}`} style={chatOpen ? { top: "var(--admin-chat-viewport-top, 0px)", height: "var(--admin-chat-viewport-height, 100vh)" } : undefined}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_70%_0%,rgba(14,165,233,0.08),transparent_42%),radial-gradient(ellipse_at_5%_65%,rgba(20,184,166,0.045),transparent_34%)]" aria-hidden="true" />

      {menuOpen && (
        <button
          aria-label="Close navigation menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        style={chatOpen ? { top: "var(--admin-chat-viewport-top, 0px)", height: "var(--admin-chat-viewport-height, 100vh)" } : undefined}
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
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                  active
                    ? "border-cyan-200/15 bg-gradient-to-r from-cyan-300/15 to-teal-300/[0.04] text-cyan-100 shadow-[inset_2px_0_0_rgba(103,232,249,.8)]"
                    : "border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-lg shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${adminNavigationIconTileColors[item.icon] ?? "border-slate-300/20 bg-slate-300/[0.07] text-slate-300"}`}
                >
                  <AdminNavigationIcon icon={item.icon} />
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

      <div className={`admin-shell-column relative min-w-0 flex-1 lg:ml-[260px] ${chatOpen ? "flex h-full min-h-0 flex-col overflow-hidden" : ""}`}>
        <header className={`admin-shell-header z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#04101d]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8 ${chatOpen ? "relative shrink-0 [--admin-header-padding:16px] sm:[--admin-header-padding:24px] lg:[--admin-header-padding:32px]" : "sticky top-0 h-[68px]"}`} style={chatOpen ? { height: "calc(68px + env(safe-area-inset-top))", paddingTop: "env(safe-area-inset-top)", paddingLeft: "max(var(--admin-header-padding), env(safe-area-inset-left))", paddingRight: "max(var(--admin-header-padding), env(safe-area-inset-right))" } : undefined}>
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

        <main className={`admin-shell-main w-full ${chatOpen ? "flex min-h-0 flex-1 overflow-hidden" : "mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8"}`}>
          {children}
        </main>
      </div>
    </div>
    </AdminChatLayoutContext.Provider>
  );
}
