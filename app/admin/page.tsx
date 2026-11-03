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
    icon: "tickets",
    accent: "from-cyan-300/15 to-blue-400/[0.03]",
  },
  {
    title: "Withdrawals",
    description:
      "Create client withdrawal records and maintain accurate statuses and notices.",
    href: "/admin/withdrawals",
    label: "Manage withdrawals",
    icon: "withdrawals",
    accent: "from-teal-300/15 to-cyan-400/[0.03]",
  },
  {
    title: "Clients",
    description:
      "Find client accounts and review account details relevant to support.",
    href: "/admin/clients",
    label: "View clients",
    icon: "clients",
    accent: "from-violet-300/15 to-blue-400/[0.03]",
  },
  {
    title: "Notifications",
    description:
      "Prepare and review client-facing account and support notifications.",
    href: "/admin/notifications",
    label: "Manage notifications",
    icon: "notifications",
    accent: "from-amber-300/10 to-cyan-400/[0.03]",
  },
  {
    title: "Activity log",
    description:
      "Review administrative changes and important support actions.",
    href: "/admin/activity",
    label: "View activity",
    icon: "activity",
    accent: "from-blue-300/15 to-teal-400/[0.03]",
  },
  {
    title: "Admin settings",
    description:
      "Configure administrative preferences and access-related options.",
    href: "/admin/settings",
    label: "Open settings",
    icon: "settings",
    accent: "from-slate-300/10 to-blue-400/[0.03]",
  },
];

function AdminSectionIcon({ icon }: { icon: string }) {
  const common = { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": true as const };

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


function ActionArrowIcon() { return <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4"><path fillRule="evenodd" clipRule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z"/></svg>; }

const sectionTileTones: Record<string, string> = { tickets: "border-sky-300/20 bg-sky-300/[0.08] text-sky-200", withdrawals: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200", clients: "border-fuchsia-300/20 bg-fuchsia-300/[0.08] text-fuchsia-200", notifications: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200", activity: "border-indigo-300/20 bg-indigo-300/[0.08] text-indigo-200", settings: "border-violet-300/20 bg-violet-300/[0.08] text-violet-200" };

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
        if (!active || !id || processedEvents.has(id)) return;

        processedEvents.add(id);
        liveEventVersion += 1;
        setUnreadTicketActivity((count) => count + 1);
        void loadUnreadCount();
      };

      channel = supabase
        .channel("admin-overview-ticket-activity-" + adminId + ":" + crypto.randomUUID(), { config: { postgres_changes_options: { wait: true } } })
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
                <div className={"grid h-11 w-11 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,.04)] " + sectionTileTones[section.icon]}>
                  <AdminSectionIcon icon={section.icon} />
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
                  <span className="text-slate-600"><ActionArrowIcon /></span>
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
                <ActionArrowIcon />
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
