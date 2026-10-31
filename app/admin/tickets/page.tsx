"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_for_client"
  | "resolved"
  | "closed";

type TicketPriority = "low" | "normal" | "high" | "urgent";

type Profile = {
  id: string;
  full_name: string | null;
};

type Ticket = {
  id: string;
  client_id: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_admin_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  clientName: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  senderName: string;
};

type ParsedTicketMessage = { text: string; photoPath?: string };
const ticketPhotoPrefix = "CS_TICKET_PHOTO_V1:";

function parseTicketMessage(value: string): ParsedTicketMessage {
  if (!value.startsWith(ticketPhotoPrefix)) return { text: value };

  try {
    const parsed = JSON.parse(value.slice(ticketPhotoPrefix.length)) as {
      version?: unknown;
      text?: unknown;
      photoPath?: unknown;
    };
    if (
      parsed.version === 1 &&
      typeof parsed.text === "string" &&
      typeof parsed.photoPath === "string"
    ) {
      return { text: parsed.text, photoPath: parsed.photoPath };
    }
  } catch {
    // Keep malformed or legacy content readable as ordinary message text.
  }

  return { text: value };
}

const statusLabels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_for_client: "Waiting for client",
  resolved: "Resolved",
  closed: "Closed",
};

const statusStyles: Record<TicketStatus, string> = {
  open: "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  in_progress:
    "border-blue-300/20 bg-blue-300/10 text-blue-200",
  waiting_for_client:
    "border-amber-300/20 bg-amber-300/10 text-amber-200",
  resolved:
    "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  closed: "border-slate-300/20 bg-slate-300/10 text-slate-300",
};

const priorityStyles: Record<TicketPriority, string> = {
  low: "text-slate-400",
  normal: "text-cyan-200",
  high: "text-amber-200",
  urgent: "text-rose-300",
};

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40";

function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [ticketPhotoUrls, setTicketPhotoUrls] = useState<Record<string, string | null>>({});
  const [currentAdminId, setCurrentAdminId] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingTicket, setUpdatingTicket] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedTicket =
    tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const selectedTicketRef = useRef<Ticket | null>(null);
  const selectedTicketDetailsRef = useRef<HTMLDivElement | null>(null);
  const loadMessagesRef = useRef<(ticket: Ticket) => Promise<void>>(async () => {});

  const markTicketRead = useCallback((ticketId: string) => {
    if (!currentAdminId) return;
    try {
      localStorage.setItem(
        `custodialsupport:admin-ticket-read:${currentAdminId}:${ticketId}`,
        new Date().toISOString()
      );
    } catch {
      // The selected ticket still opens if browser storage is unavailable.
    }
    setUnreadByTicket((current) => {
      if (!current[ticketId]) return current;
      const next = { ...current };
      delete next[ticketId];
      return next;
    });
  }, [currentAdminId]);

  const openTicket = useCallback((ticketId: string) => {
    selectedTicketRef.current = tickets.find((ticket) => ticket.id === ticketId) ?? null;
    setSelectedTicketId(ticketId);
    markTicketRead(ticketId);
  }, [markTicketRead, tickets]);

  const loadTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please sign in again to access support tickets.");
      }

      setCurrentAdminId(user.id);

      const { data: ownProfile, error: roleError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (roleError || ownProfile?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const baselineKey = `custodialsupport:admin-ticket-activity-previous-seen:${user.id}`;
      let unreadBaseline = "";
      try {
        unreadBaseline =
          localStorage.getItem(baselineKey) ??
          localStorage.getItem(`custodialsupport:admin-ticket-activity-seen:${user.id}`) ??
          new Date().toISOString();
      } catch {
        unreadBaseline = new Date().toISOString();
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name", { ascending: true });

      if (profileError) {
        throw new Error(
          `Could not load profiles: ${profileError.message}`
        );
      }

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select(
          "id, client_id, subject, description, category, priority, status, assigned_admin_id, created_at, updated_at, resolved_at"
        )
        .order("created_at", { ascending: false });

      if (ticketError) {
        throw new Error(
          `Could not load tickets: ${ticketError.message}`
        );
      }

      const profileList = (profileData ?? []) as Profile[];

      const names = new Map(
        profileList.map((profile) => [
          profile.id,
          profile.full_name?.trim() || "Unnamed client",
        ])
      );

      const ticketList = (ticketData ?? []).map((ticket) => ({
        ...ticket,
        priority: ticket.priority as TicketPriority,
        status: ticket.status as TicketStatus,
        clientName: names.get(ticket.client_id) ?? "Unknown client",
      })) as Ticket[];

      const { data: activityRows, error: activityError } = await supabase
        .from("ticket_messages")
        .select("ticket_id, sender_id, is_internal, created_at")
        .eq("is_internal", false)
        .neq("sender_id", user.id);

      if (activityError) {
        console.warn("Could not load per-client unread ticket activity:", activityError.message);
      } else {
        const unreadCounts: Record<string, number> = {};
        const clientMessages = activityRows ?? [];

        for (const ticket of ticketList) {
          let lastReadAt: string | null = null;
          try {
            lastReadAt = localStorage.getItem(
              `custodialsupport:admin-ticket-read:${user.id}:${ticket.id}`
            );
          } catch {
            // Fall back to the initial baseline if storage is unavailable.
          }

          const cutoff = lastReadAt ?? unreadBaseline;
          let unreadCount =
            !lastReadAt &&
            new Date(ticket.created_at).getTime() > new Date(unreadBaseline).getTime()
              ? 1
              : 0;

          for (const message of clientMessages) {
            if (
              message.ticket_id === ticket.id &&
              message.sender_id !== user.id &&
              !message.is_internal &&
              new Date(message.created_at).getTime() > new Date(cutoff).getTime()
            ) {
              unreadCount += 1;
            }
          }

          if (unreadCount > 0) unreadCounts[ticket.id] = unreadCount;
        }

        setUnreadByTicket(unreadCounts);
      }

      setProfiles(profileList);
      setTickets(ticketList);

      setSelectedTicketId((current) => {
        if (current && ticketList.some((ticket) => ticket.id === current)) {
          return current;
        }

        return null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred."
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (ticket: Ticket) => {
      setLoadingMessages(true);
      setError("");

      try {
        const { data, error: messageError } = await supabase
          .from("ticket_messages")
          .select(
            "id, ticket_id, sender_id, message, is_internal, created_at"
          )
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: true });

        if (messageError) {
          throw new Error(
            `Could not load the conversation: ${messageError.message}`
          );
        }

        const nameMap = new Map(
          profiles.map((profile) => [
            profile.id,
            profile.full_name?.trim() || "Unnamed user",
          ])
        );

        const mappedMessages = (data ?? []).map((message) => ({
          ...message,
          senderName:
            nameMap.get(message.sender_id) ?? "Unknown user",
        })) as TicketMessage[];

        setMessages(mappedMessages);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load the conversation."
        );
      } finally {
        setLoadingMessages(false);
      }
    },
    [profiles]
  );

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
    loadMessagesRef.current = loadMessages;
  }, [selectedTicket, loadMessages]);

  useEffect(() => {
    if (!selectedTicketId) { setMessages([]); return; }
    const ticket = selectedTicketRef.current;
    if (ticket) void loadMessagesRef.current(ticket);
  }, [selectedTicketId]);

  useEffect(() => {
    let active = true;
    const photoPaths = Array.from(
      new Set(
        messages.flatMap((message) => {
          const parsed = parseTicketMessage(message.message);
          return parsed.photoPath?.startsWith(`${message.ticket_id}/`)
            ? [parsed.photoPath]
            : [];
        })
      )
    );

    if (photoPaths.length === 0) {
      setTicketPhotoUrls({});
      return () => {
        active = false;
      };
    }

    void Promise.all(
      photoPaths.map(async (path) => {
        try {
          const { data, error } = await supabase.storage
            .from("ticket-attachments")
            .createSignedUrl(path, 60 * 60);
          if (error) console.error("Could not create ticket photo link:", error.message);
          return [path, error ? null : data?.signedUrl ?? null] as const;
        } catch (error) {
          console.error("Could not create ticket photo link:", error);
          return [path, null] as const;
        }
      })
    ).then((entries) => {
      if (active) setTicketPhotoUrls(Object.fromEntries(entries));
    });

    return () => {
      active = false;
    };
  }, [messages]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const frame = window.requestAnimationFrame(() => {
      selectedTicketDetailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedTicketId]);

  // Keep one stable list subscription; background updates should not reset loading UI.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadTickets(true);
      const ticket = selectedTicketRef.current;
      if (ticket) void loadMessagesRef.current(ticket);
    };
    const channel = supabase.channel("admin-support-tickets-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, refresh)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        (payload) => {
          const row = payload.new as Partial<TicketMessage>;
          if (!row.ticket_id || row.sender_id === currentAdminId || row.is_internal) return;

          if (selectedTicketRef.current?.id === row.ticket_id) {
            markTicketRead(row.ticket_id);
          }
          void loadTickets(true);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void loadTickets(true);
          const ticket = selectedTicketRef.current;
          if (ticket) void loadMessagesRef.current(ticket);
        }
      });
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [currentAdminId, loadTickets, markTicketRead]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const reloadSelectedConversation = () => {
      const ticket = selectedTicketRef.current;
      if (ticket?.id === selectedTicketId) void loadMessagesRef.current(ticket);
    };
    const channel = supabase.channel("admin-ticket-messages-" + selectedTicketId)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_messages", filter: "ticket_id=eq." + selectedTicketId }, reloadSelectedConversation)
      .subscribe((status) => { if (status === "SUBSCRIBED") reloadSelectedConversation(); });
    return () => { void supabase.removeChannel(channel); };
  }, [selectedTicketId]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(query) ||
        ticket.clientName.toLowerCase().includes(query) ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  async function updateTicketStatus(nextStatus: TicketStatus) {
    if (!selectedTicket) return;

    setUpdatingTicket(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: profile, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleError || profile?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          status: nextStatus,
          resolved_at:
            nextStatus === "resolved" || nextStatus === "closed"
              ? new Date().toISOString()
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedTicket.id);

      if (updateError) {
        throw new Error(
          `Could not update ticket status: ${updateError.message}`
        );
      }

      setNotice(
        `Ticket status updated to ${statusLabels[nextStatus]}.`
      );

      await loadTickets();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update ticket status."
      );
    } finally {
      setUpdatingTicket(false);
    }
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTicket || !reply.trim()) return;

    setSendingReply(true);
    setError("");
    setNotice("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: profile, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleError || profile?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      // Insert a message as the currently authenticated administrator.
      // Internal notes are disabled here until a separate secure
      // server-side operation is implemented.
      if (internalNote) {
        throw new Error(
          "Internal notes are not enabled in this version."
        );
      }

      const { error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: reply.trim(),
          is_internal: false,
        });

      if (insertError) {
        throw new Error(
          `Could not send reply: ${insertError.message}`
        );
      }

      const { error: touchTicketError } = await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      if (touchTicketError) {
        console.warn("Reply saved, but ticket timestamp was not updated:", touchTicketError.message);
      }

      setReply("");
      setNotice("Your reply was saved successfully.");

      await Promise.all([loadMessages(selectedTicket), loadTickets()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your reply."
      );
    } finally {
      setSendingReply(false);
    }
  }

  const countByStatus = (status: TicketStatus) =>
    tickets.filter((ticket) => ticket.status === status).length;

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.05] px-3 py-1.5 text-xs text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Support workspace
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Support Tickets
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Review client requests, manage ticket statuses, and respond
            to support conversations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTickets()}
          disabled={loading}
          className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
        >
          Refresh tickets
        </button>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-3 underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total tickets",
            value: tickets.length,
            tone: "text-white",
          },
          {
            label: "Open",
            value: countByStatus("open"),
            tone: "text-cyan-200",
          },
          {
            label: "In progress",
            value: countByStatus("in_progress"),
            tone: "text-blue-200",
          },
          {
            label: "Resolved",
            value: countByStatus("resolved"),
            tone: "text-emerald-200",
          },
        ].map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5"
          >
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${stat.tone}`}>
              {loading ? "—" : stat.value}
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071725]/80">
          <div className="space-y-4 border-b border-white/[0.07] p-4 sm:p-5">
            <div>
              <h2 className="font-semibold text-white">All tickets</h2>
              <p className="mt-1 text-xs text-slate-500">
                {loading
                  ? "Loading tickets..."
                  : `${filteredTickets.length} matching ticket${
                      filteredTickets.length === 1 ? "" : "s"
                    }`}
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search subject, client or ticket ID"
              className={inputClass}
              aria-label="Search tickets"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className={inputClass}
                aria-label="Filter by ticket status"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="waiting_for_client">
                  Waiting for client
                </option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className={inputClass}
                aria-label="Filter by ticket priority"
              >
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="max-h-[560px] overflow-auto scrollbar-hide">
            {loading ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                Loading tickets from Supabase...
              </p>
            ) : filteredTickets.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl text-slate-400">
                  ✉
                </div>
                <h3 className="mt-4 font-medium text-white">
                  {search ||
                  statusFilter !== "all" ||
                  priorityFilter !== "all"
                    ? "No matching tickets"
                    : "No tickets yet"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {search ||
                  statusFilter !== "all" ||
                  priorityFilter !== "all"
                    ? "Try changing your search or filters."
                    : "Client support tickets will appear here when they are created."}
                </p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-white/[0.06] sm:hidden">
                  {filteredTickets.map((ticket) => {
                    const selected = ticket.id === selectedTicketId;
                    const unreadCount = unreadByTicket[ticket.id] ?? 0;

                    return (
                      <button
                        type="button"
                        key={ticket.id}
                        onClick={() => openTicket(ticket.id)}
                        aria-pressed={selected}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.035] ${
                          selected ? "bg-cyan-200/[0.07]" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">
                            {ticket.subject}
                          </span>
                          <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-400">
                            <span className="max-w-[150px] truncate">{ticket.clientName}</span>
                            {unreadCount > 0 && (
                              <span
                                title={`${unreadCount} new support ${unreadCount === 1 ? "activity" : "activities"} for ${ticket.clientName}`}
                                aria-label={`${unreadCount} new support ${unreadCount === 1 ? "activity" : "activities"} for ${ticket.clientName}`}
                                className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100"
                              >
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                            <span className="text-slate-600">·</span>
                            <time className="shrink-0 text-slate-500">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </time>
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${statusStyles[ticket.status]}`}
                        >
                          {statusLabels[ticket.status]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <div className="min-w-[760px]">
                    <div className="sticky top-0 z-10 grid grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_minmax(125px,.9fr)_minmax(90px,.7fr)_minmax(100px,.7fr)] gap-4 border-b border-white/[0.07] bg-[#081a2a] px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Ticket</span>
                      <span>Client</span>
                      <span>Status</span>
                      <span>Priority</span>
                      <span>Submitted</span>
                    </div>
                    <div className="divide-y divide-white/[0.06]">
                      {filteredTickets.map((ticket) => {
                        const selected = ticket.id === selectedTicketId;
                        const unreadCount = unreadByTicket[ticket.id] ?? 0;

                        return (
                          <button
                            type="button"
                            key={ticket.id}
                            onClick={() => openTicket(ticket.id)}
                            aria-pressed={selected}
                            className={`grid w-full grid-cols-[minmax(220px,2fr)_minmax(130px,1fr)_minmax(125px,.9fr)_minmax(90px,.7fr)_minmax(100px,.7fr)] items-center gap-4 px-5 py-4 text-left transition hover:bg-white/[0.035] ${selected ? "bg-cyan-200/[0.07]" : ""}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-white">
                                {ticket.subject}
                              </span>
                              <span className="mt-1 block truncate text-[11px] text-slate-500">
                                {ticket.category} · {ticket.id.slice(0, 8)}
                              </span>
                            </span>
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm text-slate-300">
                                {ticket.clientName}
                              </span>
                              {unreadCount > 0 && (
                                <span
                                  title={`${unreadCount} new support ${unreadCount === 1 ? "activity" : "activities"} for ${ticket.clientName}`}
                                  aria-label={`${unreadCount} new support ${unreadCount === 1 ? "activity" : "activities"} for ${ticket.clientName}`}
                                  className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100"
                                >
                                  {unreadCount > 99 ? "99+" : unreadCount}
                                </span>
                              )}
                            </span>
                            <span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] ${statusStyles[ticket.status]}`}>
                                {statusLabels[ticket.status]}
                              </span>
                            </span>
                            <span className={`text-xs font-medium ${priorityStyles[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                            <span className="text-xs text-slate-500">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedTicket && (
          <div
            ref={selectedTicketDetailsRef}
            className="min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[#071725]/90 shadow-xl shadow-black/20"
          >
              <div className="space-y-4 border-b border-white/[0.07] p-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-cyan-200">
                    Ticket details
                  </p>
                  <h2 className="mt-2 break-words text-lg font-semibold text-white">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {selectedTicket.clientName}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      statusStyles[selectedTicket.status]
                    }`}
                  >
                    {statusLabels[selectedTicket.status]}
                  </span>

                  <span
                    className={`rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs ${
                      priorityStyles[selectedTicket.priority]
                    }`}
                  >
                    {selectedTicket.priority} priority
                  </span>

                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
                    {selectedTicket.category}
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-slate-400">
                    Update status
                  </label>
                  <select
                    value={selectedTicket.status}
                    disabled={updatingTicket}
                    onChange={(event) =>
                      void updateTicketStatus(
                        event.target.value as TicketStatus
                      )
                    }
                    className={inputClass}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="waiting_for_client">
                      Waiting for client
                    </option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="border-b border-white/[0.07] p-5">
                <h3 className="text-sm font-semibold text-white">
                  Original request
                </h3>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">
                  {selectedTicket.description}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Submitted{" "}
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </p>
              </div>

              <section className="m-5 rounded-xl border border-cyan-300/15 bg-[#071725]/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">Ticket conversation</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {selectedTicket.subject}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadMessages(selectedTicket)}
                    className="text-xs text-cyan-200 hover:text-cyan-100"
                  >
                    Refresh conversation
                  </button>
                </div>

                {loadingMessages ? (
                  <p className="py-6 text-sm text-slate-400">
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-6 text-sm text-slate-400">
                    No replies yet. You can send a message to the client below.
                  </p>
                ) : (
                  <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto scrollbar-hide">
                    {messages.map((message) => {
                      const isAdminMessage = message.sender_id === currentAdminId;
                      const content = parseTicketMessage(message.message);
                      const photoBelongsToTicket = content.photoPath?.startsWith(
                        `${message.ticket_id}/`
                      ) ?? false;
                      const photoUrl = content.photoPath
                        ? ticketPhotoUrls[content.photoPath]
                        : undefined;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isAdminMessage ? "justify-end" : "justify-start"}`}
                        >
                          <article
                            className={`w-fit max-w-[96%] rounded-2xl border px-3.5 pb-2.5 pt-2 shadow-sm sm:max-w-[42rem] ${
                              isAdminMessage
                                ? "rounded-br-md border-sky-300/20 bg-[#24527a]"
                                : "rounded-bl-md border-white/[0.07] bg-[#142334]"
                            }`}
                          >
                            <div className="mb-0.5 flex items-center justify-between gap-4">
                              <p className={`text-[10px] font-semibold ${isAdminMessage ? "text-sky-200" : "text-emerald-200"}`}>
                                {isAdminMessage ? "You" : message.senderName}
                                {message.sender_id === selectedTicket.assigned_admin_id &&
                                  !isAdminMessage && (
                                    <span className="ml-2 text-xs text-slate-500">
                                      Assigned admin
                                    </span>
                                  )}
                              </p>
                            </div>
                            {content.text && (
                              <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-100 [overflow-wrap:anywhere]">
                                {content.text}
                                {!content.photoPath && (
                                  <time className="float-right ml-2 mt-1 whitespace-nowrap text-[10px] leading-4 text-slate-300/70">
                                    {formatChatTime(message.created_at)}
                                  </time>
                                )}
                              </p>
                            )}
                            {content.photoPath && (
                              !photoBelongsToTicket ? (
                                <p className="mt-2 text-xs text-slate-400">
                                  This photo is unavailable.
                                </p>
                              ) : photoUrl ? (
                                <a
                                  href={photoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 block overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                  aria-label="Open attached photo in a new tab"
                                >
                                  <img
                                    src={photoUrl}
                                    alt={`Photo attached by ${isAdminMessage ? "you" : message.senderName}`}
                                    loading="lazy"
                                    className="max-h-72 w-auto max-w-full rounded-xl object-contain"
                                  />
                                </a>
                              ) : content.photoPath in ticketPhotoUrls ? (
                                <p className="mt-2 text-xs text-slate-400">
                                  This photo is unavailable.
                                </p>
                              ) : (
                                <p className="mt-2 text-xs text-slate-400">
                                  Loading attached photo…
                                </p>
                              )
                            )}
                            {(!content.text || content.photoPath) && (
                              <time className="mt-1 block whitespace-nowrap text-right text-[10px] leading-4 text-slate-300/70">
                                {formatChatTime(message.created_at)}
                              </time>
                            )}
                          </article>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form onSubmit={sendReply} className="mt-5 space-y-3 border-t border-white/[0.07] pt-5">
                  <label className="block text-sm font-medium text-white">
                    Reply to client
                  </label>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={4}
                    maxLength={10000}
                    required
                    placeholder="Write your message..."
                    className={`${inputClass} resize-y leading-6`}
                  />
                  <button
                    type="submit"
                    disabled={sendingReply || !reply.trim()}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3 text-sm font-semibold text-[#06111d] transition hover:from-cyan-200 hover:to-teal-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingReply ? "Sending..." : "Send reply"}
                  </button>
                </form>
              </section>
          </div>
        )}
      </section>
    </div>
  );
}
