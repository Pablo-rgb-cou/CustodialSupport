"use client";

import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AdminChatLayoutContext, useAdminPageScrollLock } from "../admin-chat-layout";
import { supabase } from "@/lib/supabase";
import { useTicketAttachmentUrls } from "@/lib/use-ticket-attachment-urls";
import { removeTypingChannel, waitForTypingChannelLeave } from "@/lib/ticket-typing-channel";

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

function upsertTicketMessage(current: TicketMessage[], message: TicketMessage) {
  const next = current.filter((item) => item.id !== message.id);
  next.push(message);
  return next.sort((left, right) =>
    left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id)
  );
}

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


function TicketConversationIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z"/><path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z"/></svg>;
}

// The parent layout owns the viewport; these safe areas belong to the composer.
const conversationViewportStyles = `
  [data-admin-conversation-open="true"] .admin-chat-composer { padding-bottom: max(12px, env(safe-area-inset-bottom)); }
  @media (max-width: 1023px) {
    [data-admin-conversation-open="true"] .admin-chat-composer {
      padding-left: max(16px, env(safe-area-inset-left));
      padding-right: max(16px, env(safe-area-inset-right));
    }
  }
`;

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [ticketPhotoViewerUrl, setTicketPhotoViewerUrl] = useState<string | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [clientIsTyping, setClientIsTyping] = useState(false);

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
  const conversationReturnScrollRef = useRef(0);
  const deepLinkHandledRef = useRef(false);
  const openConversationId = selectedTicket?.id ?? null;
  const setAdminChatOpen = useContext(AdminChatLayoutContext);
  const selectedTicketDetailsRef = useRef<HTMLDivElement | null>(null);
  const loadMessagesRef = useRef<(ticket: Ticket, silent?: boolean) => Promise<void>>(async () => {});
  const profilesRef = useRef(profiles);
  const messagesRequestRef = useRef(0);
  const messagesRevisionRef = useRef(0);
  const messageEventsRef = useRef(new Map<string, { revision: number; message: TicketMessage | null }>());
  const messagesPanelRef = useRef<HTMLDivElement | null>(null);
  const followMessagesRef = useRef(true);
  useAdminPageScrollLock(Boolean(ticketPhotoViewerUrl));

  useLayoutEffect(() => {
    setAdminChatOpen(Boolean(openConversationId));
    return () => setAdminChatOpen(false);
  }, [openConversationId, setAdminChatOpen]);

  useEffect(() => {
    if (!ticketPhotoViewerUrl) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTicketPhotoViewerUrl(null);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ticketPhotoViewerUrl]);

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

  useEffect(() => {
    if (!openConversationId) return;
    const shell = selectedTicketDetailsRef.current?.closest<HTMLElement>(".admin-shell");
    if (!shell) return;
    const viewport = window.visualViewport;
    const oldHeight = shell.style.getPropertyValue("--admin-chat-viewport-height");
    const oldTop = shell.style.getPropertyValue("--admin-chat-viewport-top");
    const fitViewport = () => {
      shell.style.setProperty("--admin-chat-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      shell.style.setProperty("--admin-chat-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    fitViewport();
    selectedTicketDetailsRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", fitViewport);
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport, { passive: true });
    return () => {
      window.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      if (oldHeight) shell.style.setProperty("--admin-chat-viewport-height", oldHeight); else shell.style.removeProperty("--admin-chat-viewport-height");
      if (oldTop) shell.style.setProperty("--admin-chat-viewport-top", oldTop); else shell.style.removeProperty("--admin-chat-viewport-top");
      if (shell.isConnected) {
        window.scrollTo({ top: conversationReturnScrollRef.current, behavior: "instant" });
        const trigger = document.querySelector<HTMLButtonElement>('[data-admin-ticket-id="' + CSS.escape(openConversationId) + '"]');
        trigger?.focus({ preventScroll: true });
      }
    };
  }, [openConversationId]);

  const openTicket = useCallback((ticketId: string) => {
    conversationReturnScrollRef.current = window.scrollY;
    followMessagesRef.current = true;
    messageEventsRef.current.clear();
    selectedTicketRef.current = tickets.find((ticket) => ticket.id === ticketId) ?? null;
    setSelectedTicketId(ticketId);
    markTicketRead(ticketId);
  }, [markTicketRead, tickets]);

  const closeTicket = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("ticket");
    url.searchParams.delete("ticketId");
    window.history.replaceState(window.history.state, "", url.toString());
    deepLinkHandledRef.current = true;
    setSelectedTicketId(null);
    selectedTicketRef.current = null;
    setMessages([]);
    setReply("");
    setError("");
    setNotice("");
  }, []);

  useEffect(() => {
    if (loading || !currentAdminId) return;
    let active = true;
    const openRequestedTicket = () => {
      if (deepLinkHandledRef.current) return;
      const query = new URLSearchParams(window.location.search);
      const requestedId = query.get("ticket") ?? query.get("ticketId");
      deepLinkHandledRef.current = true;
      if (!requestedId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedId)) return;
      // Resolve only against the authorized list already fetched for this admin.
      if (tickets.some((ticket) => ticket.id === requestedId)) {
        queueMicrotask(() => { if (active) openTicket(requestedId); });
      }
    };
    const onPopState = () => { deepLinkHandledRef.current = false; openRequestedTicket(); };
    openRequestedTicket();
    window.addEventListener("popstate", onPopState);
    return () => { active = false; window.removeEventListener("popstate", onPopState); };
  }, [loading, currentAdminId, tickets, openTicket]);

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
    async (ticket: Ticket, silent = false) => {
      if (selectedTicketRef.current?.id !== ticket.id) return;
      const request = ++messagesRequestRef.current;
      const revision = messagesRevisionRef.current;
      if (!silent) setLoadingMessages(true);
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

        // Replay changes received during the fetch onto the full history.
        if (request === messagesRequestRef.current && selectedTicketRef.current?.id === ticket.id) {
          const snapshot = new Map(mappedMessages.map((message) => [message.id, message]));
          for (const [id, event] of messageEventsRef.current) {
            if (event.revision <= revision) continue;
            if (event.message) snapshot.set(id, event.message);
            else snapshot.delete(id);
          }
          setMessages([...snapshot.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
        }
      } catch (err) {
        if (request === messagesRequestRef.current && selectedTicketRef.current?.id === ticket.id) setError(
          err instanceof Error
            ? err.message
            : "Could not load the conversation."
        );
      } finally {
        if (request === messagesRequestRef.current) setLoadingMessages(false);
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
    profilesRef.current = profiles;
  }, [selectedTicket, loadMessages, profiles]);

  useEffect(() => {
    const panel = messagesPanelRef.current;
    if (panel && followMessagesRef.current) panel.scrollTop = panel.scrollHeight;
  }, [messages, loadingMessages]);

  useEffect(() => {
    if (!selectedTicketId) {
      messagesRequestRef.current += 1;
      messageEventsRef.current.clear();
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    const ticket = selectedTicketRef.current;
    if (ticket) void loadMessagesRef.current(ticket);
  }, [selectedTicketId]);

  const ticketPhotoPaths = messages.flatMap((message) => {
    const content = parseTicketMessage(message.message);
    return content.photoPath ? [content.photoPath] : [];
  });
  const { urls: ticketPhotoUrls, retry: retryTicketPhoto } = useTicketAttachmentUrls(currentAdminId, selectedTicketId, ticketPhotoPaths);

  // Listen only to the selected ticket's private typing topic. The client
  // broadcasts a boolean state only; no draft message content is sent.
  useEffect(() => {
    setClientIsTyping(false);
    if (!selectedTicketId || !currentAdminId) return;

    let active = true;
    let typingTimeout: ReturnType<typeof setTimeout> | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void (async () => {
      // Private Broadcast authorization must use the signed-in user's JWT.
      await waitForTypingChannelLeave(`ticket-typing:${selectedTicketId}`);
      await supabase.realtime.setAuth();
      if (!active) return;
      channel = supabase
        .channel(`ticket-typing:${selectedTicketId}`, { config: { private: true } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (!active || payload?.actor !== "client") return;
          if (payload.clientId && payload.clientId !== selectedTicketRef.current?.client_id) return;
          const isTyping = payload?.isTyping === true;
          setClientIsTyping(isTyping);
          if (typingTimeout) clearTimeout(typingTimeout);
          if (isTyping) {
            typingTimeout = setTimeout(() => {
              if (active) setClientIsTyping(false);
              typingTimeout = null;
            }, 4000);
          }
        })
        .subscribe((status, channelError) => {
          if (!active) return;
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setClientIsTyping(false);
            console.warn("Admin ticket typing connection interrupted:", status, channelError?.message);
          }
        });
    })().catch((channelError: unknown) => {
      if (active) console.warn("Could not join the ticket typing channel:", channelError);
    });

    return () => {
      active = false;
      if (typingTimeout) clearTimeout(typingTimeout);
      if (channel) void removeTypingChannel(channel);
    };
  }, [currentAdminId, selectedTicketId]);

  // Keep one stable list subscription; background updates should not reset loading UI.
  useEffect(() => {
    if (!currentAdminId) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      void loadTickets(true);
      const ticket = selectedTicketRef.current;
      if (ticket) void loadMessagesRef.current(ticket, true);
    };
    const channel = supabase.channel(`admin-support-tickets-live:${currentAdminId}:${crypto.randomUUID()}`)
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
          if (ticket) void loadMessagesRef.current(ticket, true);
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
    if (!selectedTicketId || !currentAdminId) return;
    let active = true;
    let live = false;
    let refreshing = false;
    const reloadSelectedConversation = async () => {
      if (!active || refreshing || document.visibilityState !== "visible") return;
      const ticket = selectedTicketRef.current;
      if (ticket?.id !== selectedTicketId) return;
      refreshing = true;
      try {
        await loadMessagesRef.current(ticket, true);
      } finally {
        refreshing = false;
      }
    };
    const applyMessage = (row: Record<string, unknown>) => {
      if (!active || selectedTicketRef.current?.id !== selectedTicketId || row.ticket_id !== selectedTicketId) return;
      if (typeof row.id !== "string" || typeof row.sender_id !== "string" ||
          typeof row.message !== "string" || typeof row.created_at !== "string") {
        void reloadSelectedConversation();
        return;
      }
      const sender = profilesRef.current.find((profile) => profile.id === row.sender_id);
      const message: TicketMessage = {
        id: row.id,
        ticket_id: selectedTicketId,
        sender_id: row.sender_id,
        message: row.message,
        is_internal: row.is_internal === true,
        created_at: row.created_at,
        senderName: sender?.full_name?.trim() || "Unknown user",
      };
      messagesRevisionRef.current += 1;
      messageEventsRef.current.set(message.id, { revision: messagesRevisionRef.current, message });
      setLoadingMessages(false);
      setMessages((current) => upsertTicketMessage(current, message));
      if (row.sender_id === selectedTicketRef.current.client_id) {
        setClientIsTyping(false);
        markTicketRead(selectedTicketId);
      }
    };
    const channel = supabase.channel(`admin-ticket-messages:${selectedTicketId}:${crypto.randomUUID()}`, {
      config: { postgres_changes_options: { wait: true } },
    })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: "ticket_id=eq." + selectedTicketId }, (payload) => applyMessage(payload.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ticket_messages", filter: "ticket_id=eq." + selectedTicketId }, (payload) => applyMessage(payload.new))
      // Postgres DELETE events cannot be filtered; admins only remove known IDs.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "ticket_messages" }, (payload) => {
        if (!active || selectedTicketRef.current?.id !== selectedTicketId) return;
        const deletedId = payload.old.id;
        if (typeof deletedId !== "string") return;
        messagesRevisionRef.current += 1;
        messageEventsRef.current.set(deletedId, { revision: messagesRevisionRef.current, message: null });
        setMessages((current) => current.filter((item) => item.id !== deletedId));
      })
      .on("system", {}, (payload) => {
        if (active && payload.status === "error") {
          live = false;
          console.warn("Admin ticket replication interrupted:", payload.message);
          void reloadSelectedConversation();
        }
      })
      .subscribe((status, channelError) => {
        if (!active) return;
        live = status === "SUBSCRIBED";
        if (live) void reloadSelectedConversation();
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn("Admin ticket message connection interrupted:", status, channelError?.message);
          void reloadSelectedConversation();
        }
      });
    const recover = () => { void reloadSelectedConversation(); };
    // Keep the open chat usable during a dropped WebSocket, without loading flashes.
    const fallbackTimer = setInterval(() => { if (!live) recover(); }, 4000);
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      active = false;
      clearInterval(fallbackTimer);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      void supabase.removeChannel(channel);
    };
  }, [selectedTicketId, currentAdminId, markTicketRead]);

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

      const { data: savedMessage, error: insertError } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: reply.trim(),
          is_internal: false,
        })
        .select("id, ticket_id, sender_id, message, is_internal, created_at")
        .single();

      if (insertError) {
        throw new Error(
          `Could not send reply: ${insertError.message}`
        );
      }

      if (savedMessage && selectedTicketRef.current?.id === selectedTicket.id) {
        followMessagesRef.current = true;
        messagesRevisionRef.current += 1;
        const message = { ...savedMessage, senderName: "You" };
        messageEventsRef.current.set(message.id, { revision: messagesRevisionRef.current, message });
        setMessages((current) => upsertTicketMessage(current, message));
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

      await Promise.all([loadMessages(selectedTicket, true), loadTickets(true)]);
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
    <div data-admin-chat-open={selectedTicket ? "true" : undefined} className={selectedTicket ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" : "space-y-7"}>
      {selectedTicket ? <style>{conversationViewportStyles}</style> : null}
      <section className={`flex flex-col justify-between gap-4 sm:flex-row sm:items-end ${selectedTicket ? "hidden" : ""}`}>
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

      {notice && !selectedTicket && (
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

      {error && !selectedTicket && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      )}

      <section className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-4 ${selectedTicket ? "hidden" : ""}`}>
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

      <section className={selectedTicket ? "flex min-h-0 flex-1 flex-col" : "space-y-5"}>
        {!selectedTicket && <div className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(145deg,#0c1e31,#071424)] shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
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

          {loading ? <p role="status" className="px-5 py-12 text-center text-sm text-slate-400">Loading support tickets…</p> : filteredTickets.length === 0 ? (
            <div className="px-5 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl border border-sky-300/15 bg-sky-300/[0.07] text-sky-200"><TicketConversationIcon /></span><h3 className="mt-4 text-sm font-semibold text-white">{search || statusFilter !== "all" || priorityFilter !== "all" ? "No matching tickets" : "No tickets yet"}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{search || statusFilter !== "all" || priorityFilter !== "all" ? "Try another client name, ticket number, or filter." : "New client requests will appear here."}</p></div>
          ) : <>
            <div aria-hidden="true" className="hidden grid-cols-[44px_minmax(0,1fr)_130px_80px_100px] items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 lg:grid"><span /><span>Client &amp; ticket</span><span>Status</span><span>Priority</span><span className="text-right">Submitted</span></div>
            <div tabIndex={0} aria-label="Support ticket list, scroll for more tickets" className="scrollbar-hide max-h-[524px] overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/40 sm:max-h-[444px]">
              <ul className="divide-y divide-white/[0.065]">{filteredTickets.map((ticket) => {
                const unreadCount = unreadByTicket[ticket.id] ?? 0;
                return <li key={ticket.id}><button type="button" data-admin-ticket-id={ticket.id} onClick={() => openTicket(ticket.id)} aria-label={"Open " + ticket.subject + " for " + ticket.clientName + ", " + statusLabels[ticket.status] + (unreadCount ? ", " + unreadCount + " unread" : "")} className={"group grid h-[104px] w-full grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2.5 px-3.5 text-left transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:h-[88px] sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:gap-3 sm:px-5 lg:grid-cols-[44px_minmax(0,1fr)_130px_80px_100px] " + (unreadCount ? "bg-sky-300/[0.025]" : "")}>
                  <span className="relative grid size-9 place-items-center rounded-xl border border-sky-300/15 bg-sky-300/[0.08] text-sky-200 sm:size-10"><TicketConversationIcon />{unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-[#0a192b] bg-cyan-200 px-1 text-[10px] font-bold leading-4 text-[#052030]">{unreadCount > 99 ? "99+" : unreadCount}</span>}</span>
                  <span className="min-w-0"><span title={ticket.subject} className="block truncate text-[13px] font-semibold text-slate-100 sm:text-sm">{ticket.subject}</span><span title={ticket.clientName} className="mt-1 block truncate text-xs text-slate-400">{ticket.clientName}</span><span className="mt-1 block truncate font-mono text-[10px] text-slate-500 sm:text-[11px]">#{ticket.id.slice(0, 8)}</span></span>
                  <span className="flex min-w-0 flex-col items-end gap-2 lg:items-start"><span className={"inline-flex max-w-[118px] items-center whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-medium sm:text-[10px] " + statusStyles[ticket.status]}>{statusLabels[ticket.status]}</span><span className="flex items-center gap-1.5 text-[10px] lg:hidden"><span className={"capitalize " + priorityStyles[ticket.priority]}>{ticket.priority}</span><span className="text-slate-600">·</span><time dateTime={ticket.created_at} className="text-slate-500">{new Date(ticket.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></span></span>
                  <span className={"hidden text-xs font-medium capitalize lg:block " + priorityStyles[ticket.priority]}>{ticket.priority}</span><time dateTime={ticket.created_at} className="hidden text-right text-[11px] tabular-nums text-slate-500 lg:block">{new Date(ticket.created_at).toLocaleDateString()}</time>
                </button></li>;
              })}</ul>
            </div>
          </>}
        </div>}

        {selectedTicket && (
          <div
            ref={selectedTicketDetailsRef}
            tabIndex={-1}
            role="region"
            aria-label={"Support conversation with " + selectedTicket.clientName}
            className="admin-ticket-conversation flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#071725]/90"
          >
              {error && <p role="alert" className="shrink-0 border-b border-rose-300/15 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-100">{error}</p>}
              {notice && <p role="status" className="sr-only">{notice}</p>}

              <header className="shrink-0 border-b border-white/[0.07] bg-[#081928]/95 px-3.5 py-3 sm:px-5 sm:py-3.5">
                <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl border border-sky-300/15 bg-sky-300/[0.07] text-sky-200"><TicketConversationIcon /></span><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ticket conversation</p><h2 className="mt-0.5 truncate text-sm font-semibold text-white sm:text-base">{selectedTicket.clientName}</h2></div>
                  <button type="button" onClick={() => void loadMessages(selectedTicket, true)} aria-label="Refresh conversation" title="Refresh conversation" className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/[0.05] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M5.7 7a7 7 0 0 1 11.55-2L20 8M4 16l2.75 3A7 7 0 0 0 18.3 17"/></svg></button>
                  <button type="button" onClick={closeTicket} aria-label="Close ticket conversation" className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-4"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18"/></svg></button>
                </div>
                <div className="mt-2.5 flex min-w-0 items-center gap-2"><label className="min-w-0"><span className="sr-only">Update ticket status</span><select value={selectedTicket.status} disabled={updatingTicket} onChange={(event) => void updateTicketStatus(event.target.value as TicketStatus)} className={"min-h-8 max-w-[155px] rounded-lg border bg-[#091b2b] px-2.5 py-1.5 text-[11px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:opacity-60 " + statusStyles[selectedTicket.status]}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_for_client">Waiting for client</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><span className={"shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 text-[10px] font-medium capitalize " + priorityStyles[selectedTicket.priority]}>{selectedTicket.priority} priority</span><span className="ml-auto hidden font-mono text-[10px] text-slate-500 sm:inline">#{selectedTicket.id.slice(0, 8)}</span></div>
              </header>

              <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={messagesPanelRef}
                  onScroll={(event) => {
                    const panel = event.currentTarget;
                    followMessagesRef.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 96;
                  }}
                  aria-label="Ticket conversation messages"
                  tabIndex={0}
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-cyan-200/30"
                >
              <details className="border-b border-white/[0.07] bg-white/[0.015] px-4 py-2.5 sm:px-5">
                <summary className="cursor-pointer text-xs font-medium text-slate-400">View original request <span className="ml-2 font-mono text-[10px] text-slate-600">#{selectedTicket.id.slice(0, 8)}</span></summary>
                <h3 className="mt-3 break-words text-sm font-semibold text-slate-100">{selectedTicket.subject}</h3>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-sky-200/70">{selectedTicket.category}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{selectedTicket.description}</p>
                <p className="mt-2 text-[10px] text-slate-500">Submitted {new Date(selectedTicket.created_at).toLocaleString()}</p>
              </details>

                {loadingMessages ? (
                  <p className="flex-1 px-4 py-6 text-sm text-slate-400 sm:px-6">
                    Loading conversation...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="flex-1 px-4 py-6 text-sm text-slate-400 sm:px-6">
                    No replies yet. You can send a message to the client below.
                  </p>
                ) : (
                  <div className="space-y-3 px-4 py-4 sm:px-6">
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
                                <button
                                  type="button"
                                  onClick={() => setTicketPhotoViewerUrl(photoUrl)}
                                  className="mt-2 block overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                  aria-label="View attached photo in chat"
                                >
                                  <img
                                    src={photoUrl}
                                    alt={`Photo attached by ${isAdminMessage ? "you" : message.senderName}`}
                                    loading={ticketPhotoPaths.slice(-2).includes(content.photoPath!) ? "eager" : "lazy"}
                                    decoding="async"
                                    onError={() => void retryTicketPhoto(content.photoPath!)}
                                    onLoad={() => { const panel = messagesPanelRef.current; if (panel && followMessagesRef.current) panel.scrollTop = panel.scrollHeight; }}
                                    className="max-h-72 w-auto max-w-full rounded-xl object-contain"
                                  />
                                </button>
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

                </div>

                {clientIsTyping && (
                  <div className="shrink-0 px-4 pb-2 sm:px-6" role="status" aria-live="polite" aria-label="Client is typing">
                    <span className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-[#142536] px-3.5 py-2.5 text-xs font-medium text-slate-300">
                      <span className="mr-2">Client is typing</span>
                      <span className="inline-flex items-center gap-1 align-middle" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-200" />
                      </span>
                    </span>
                  </div>
                )}

                <form onSubmit={sendReply} className="admin-chat-composer shrink-0 border-t border-white/[0.07] bg-gradient-to-b from-[#0a1b2b] to-[#071522] p-3 sm:px-5 sm:py-4">
                  <label htmlFor="admin-ticket-reply" className="sr-only">Write a message to the client</label>
                  <div className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/[0.11] bg-[#17212b] px-3 shadow-inner shadow-black/20 transition focus-within:border-cyan-200/40 focus-within:ring-2 focus-within:ring-cyan-300/10">
                    <textarea
                      id="admin-ticket-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (reply.trim()) event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      rows={1}
                      maxLength={10000}
                      placeholder="Write a message..."
                      className="max-h-28 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-400"
                    />
                    {reply.trim() && (
                      <button type="submit" disabled={sendingReply} aria-label={sendingReply ? "Sending message" : "Send message"} title="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400 text-[#062017] shadow-md shadow-emerald-950/25 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17212b] disabled:cursor-not-allowed disabled:opacity-60">
                        {sendingReply ? <span className="text-xs font-bold">…</span> : (
                          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M3.4 20.7 21 12 3.4 3.3l.1 6.8 12 1.9-12 1.9-.1 6.8Z" /></svg>
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </section>
          </div>
        )}
      </section>
      {ticketPhotoViewerUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTicketPhotoViewerUrl(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Attached ticket photo"
            className="relative flex max-h-[92dvh] w-full max-w-5xl items-center justify-center rounded-2xl border border-white/10 bg-[#071725] p-3 shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-5"
          >
            <button
              type="button"
              onClick={() => setTicketPhotoViewerUrl(null)}
              aria-label="Close photo viewer"
              className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-xl border border-white/15 bg-[#07111f]/90 text-xl text-white hover:bg-white/10"
            >
              ×
            </button>
            <img
              src={ticketPhotoViewerUrl}
              alt="Attached photo from the support conversation"
              className="max-h-[84dvh] max-w-full rounded-xl object-contain"
            />
          </section>
        </div>
      )}
    </div>
  );
}
