"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);

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

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Please sign in again to access support tickets.");
      }

      const { data: ownProfile, error: roleError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (roleError || ownProfile?.role !== "admin") {
        throw new Error("Administrator access is required.");
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
      setLoading(false);
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
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedTicket);
  }, [selectedTicket, loadMessages]);

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

      setReply("");
      setNotice("Your reply was saved successfully.");

      await loadMessages(selectedTicket);
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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

          <div className="max-h-[760px] overflow-y-auto">
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
              <div className="divide-y divide-white/[0.06]">
                {filteredTickets.map((ticket) => {
                  const selected = ticket.id === selectedTicketId;

                  return (
                    <button
                      type="button"
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`block w-full p-4 text-left transition hover:bg-white/[0.03] sm:p-5 ${
                        selected ? "bg-cyan-200/[0.06]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {ticket.subject}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {ticket.clientName}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] ${
                            statusStyles[ticket.status]
                          }`}
                        >
                          {statusLabels[ticket.status]}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
                        {ticket.description}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-xs font-medium ${
                            priorityStyles[ticket.priority]
                          }`}
                        >
                          {ticket.priority.toUpperCase()} PRIORITY
                        </span>

                        <span className="text-xs text-slate-500">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071725]/80">
          {!selectedTicket ? (
            <div className="grid min-h-[420px] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-2xl text-slate-400">
                  ↗
                </div>
                <h2 className="mt-4 font-semibold text-white">
                  Ticket details
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">
                  Select a ticket from the list to view its details and
                  conversation.
                </p>
              </div>
            </div>
          ) : (
            <>
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

              <div className="p-5">
                <h3 className="font-semibold text-white">Conversation</h3>

                {loadingMessages ? (
                  <p className="py-8 text-sm text-slate-400">
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="py-8 text-sm leading-6 text-slate-400">
                    No messages have been recorded for this ticket yet.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {messages.map((message) => (
                      <article
                        key={message.id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-cyan-100">
                            {message.senderName}
                            {message.sender_id ===
                              selectedTicket.assigned_admin_id && (
                              <span className="ml-2 text-xs text-slate-500">
                                Assigned admin
                              </span>
                            )}
                          </p>

                          <time className="text-xs text-slate-500">
                            {new Date(
                              message.created_at
                            ).toLocaleString()}
                          </time>
                        </div>

                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                          {message.message}
                        </p>
                      </article>
                    ))}
                  </div>
                )}

                <form onSubmit={sendReply} className="mt-6 space-y-3">
                  <label className="block text-sm font-medium text-white">
                    Reply to client
                  </label>

                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={5}
                    maxLength={10000}
                    required
                    placeholder="Write your response..."
                    className={inputClass}
                  />

                  <p className="text-xs leading-5 text-slate-500">
                    Replies are saved to the ticket conversation. Only
                    send information appropriate for the selected client.
                  </p>

                  <button
                    type="submit"
                    disabled={sendingReply || !reply.trim()}
                    className="w-full rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingReply ? "Sending reply..." : "Send reply"}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}