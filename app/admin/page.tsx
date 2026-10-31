"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const sections = [
  {
    title: "Support tickets",
    description:
      "Review open client requests, reply to messages, and manage ticket status.",
    href: "/admin/tickets",
    label: "Manage tickets",
    icon: "▤",
    accent: "from-cyan-300/15 to-blue-400/[0.03]",
  },
  {
    title: "Withdrawals",
    description:
      "Create client withdrawal records and maintain accurate statuses and notices.",
    href: "/admin/withdrawals",
    label: "Manage withdrawals",
    icon: "↗",
    accent: "from-teal-300/15 to-cyan-400/[0.03]",
  },
  {
    title: "Clients",
    description:
      "Find client accounts and review account details relevant to support.",
    href: "/admin/clients",
    label: "View clients",
    icon: "♙",
    accent: "from-violet-300/15 to-blue-400/[0.03]",
  },
  {
    title: "Notifications",
    description:
      "Prepare and review client-facing account and support notifications.",
    href: "/admin/notifications",
    label: "Manage notifications",
    icon: "♧",
    accent: "from-amber-300/10 to-cyan-400/[0.03]",
  },
  {
    title: "Activity log",
    description:
      "Review administrative changes and important support actions.",
    href: "/admin/activity",
    label: "View activity",
    icon: "◷",
    accent: "from-blue-300/15 to-teal-400/[0.03]",
  },
  {
    title: "Admin settings",
    description:
      "Configure administrative preferences and access-related options.",
    href: "/admin/settings",
    label: "Open settings",
    icon: "⚙",
    accent: "from-slate-300/10 to-blue-400/[0.03]",
  },
];

export default function AdminOverviewPage() {
  const [unreadTicketActivity, setUnreadTicketActivity] = useState(0);

  useEffect(() => {
    let active = true;
    let liveEventVersion = 0;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const processedEvents = new Set<string>();

    async function startTicketActivityListener() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active || userError || !user) return;

      const adminId = user.id;
      const storageKey =
        "custodialsupport:admin-ticket-activity-seen:" + adminId;

      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, new Date().toISOString());
      }

      const getLastSeen = () =>
        localStorage.getItem(storageKey) ?? new Date().toISOString();

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
            "Could not load overview ticket activity count:",
            ticketResult.error ?? messageResult.error
          );
          return;
        }

        const databaseCount =
          (ticketResult.count ?? 0) + (messageResult.count ?? 0);

        setUnreadTicketActivity((currentCount) => {
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
        setUnreadTicketActivity((count) => count + 1);
        void loadUnreadCount();
      };

      channel = supabase
        .channel("admin-overview-ticket-activity-" + adminId)
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

            if (row.sender_id !== adminId && row.is_internal !== true) {
              recordActivity(row.id ?? "");
            }
          }
        )
        .subscribe((status, error) => {
          console.log("[admin overview ticket badge] subscription:", status, error);
          if (status === "SUBSCRIBED") void loadUnreadCount();
        });
    }

    void startTicketActivityListener();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-[#0c2a40] via-[#081d30] to-[#071422] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-cyan-200/10" />
        <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-cyan-200/[0.08]" />
        <div className="pointer-events-none absolute right-16 top-12 h-28 w-28 rounded-full bg-cyan-300/[0.06] blur-3xl" />

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-1.5 text-xs text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Administrator workspace
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Manage client support in one place.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Use this workspace to handle support tickets, maintain withdrawal
            records, manage client-facing notices, and review administrative
            activity.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Management tools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose an area to manage.
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
            Admin only
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((section) => (
            <article
              key={section.href}
              className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${section.accent} p-5 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:shadow-[0_14px_40px_rgba(0,0,0,.18)]`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-[#071522]/70 text-xl text-cyan-100">
                  {section.icon}
                </div>

                {section.href === "/admin/tickets" &&
                unreadTicketActivity > 0 ? (
                  <span
                    aria-label={`${unreadTicketActivity} new support activities`}
                    className="inline-flex min-w-6 items-center justify-center rounded-full bg-cyan-300/15 px-2 py-1 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-200/20"
                  >
                    {unreadTicketActivity > 99
                      ? "99+"
                      : unreadTicketActivity}
                  </span>
                ) : (
                  <span className="text-xs text-slate-600">↗</span>
                )}
              </div>

              <h3 className="mt-5 text-base font-semibold text-white">
                {section.title}
              </h3>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-400">
                {section.description}
              </p>

              <Link
                href={section.href}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.05] px-3.5 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/10"
              >
                {section.label}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-600">
        Only use client-facing statuses and notices that accurately reflect the
        current state of the request. This overview intentionally avoids
        fabricated totals; live summary metrics can be added after the ticket,
        client, and notification data sources are connected.
      </p>
    </div>
  );
}
