"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type ClientTicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

type Snapshot = {
  messages: ClientTicketMessage[];
  loading: boolean;
  error: string;
  reconnecting: boolean;
  loaded: boolean;
};
type Entry = {
  snapshot: Snapshot;
  revision: number;
  events: Map<string, { revision: number; message: ClientTicketMessage | null }>;
  request: Promise<void> | null;
  controller: AbortController | null;
  reloadAfterRequest: boolean;
  fetchedAt: number;
};
const emptySnapshot: Snapshot = {
  messages: [], loading: false, error: "", reconnecting: false, loaded: false,
};
const requestTimeoutMs = 12000;

function orderMessages(messages: ClientTicketMessage[]) {
  return messages.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

function isPublicMessage(value: unknown, ticketId: string): value is ClientTicketMessage {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ClientTicketMessage>;
  return row.ticket_id === ticketId && row.is_internal === false &&
    typeof row.id === "string" && typeof row.sender_id === "string" &&
    typeof row.message === "string" && typeof row.created_at === "string";
}

// Each hook instance owns its cache. A change of authenticated user creates a new
// instance, and cleanup aborts and clears the old user's requests and messages.
class ConversationCache {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private generation = 0;
  private active = true;
  readonly clientId: string;

  constructor(clientId: string) { this.clientId = clientId; }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  snapshot = (ticketId: string | null) => ticketId ? this.entries.get(ticketId)?.snapshot ?? emptySnapshot : emptySnapshot;
  private entry(ticketId: string) {
    let entry = this.entries.get(ticketId);
    if (!entry) {
      entry = { snapshot: emptySnapshot, revision: 0, events: new Map(), request: null,
        controller: null, reloadAfterRequest: false, fetchedAt: 0 };
      this.entries.set(ticketId, entry);
    }
    return entry;
  }
  private update(entry: Entry, next: Partial<Snapshot>) {
    entry.snapshot = { ...entry.snapshot, ...next };
    for (const listener of this.listeners) listener();
  }
  activate() { this.active = true; }
  dispose() {
    this.active = false;
    this.generation += 1;
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear();
  }
  setReconnecting(ticketId: string, reconnecting: boolean) {
    if (this.active) this.update(this.entry(ticketId), { reconnecting });
  }
  upsert(ticketId: string, row: ClientTicketMessage) {
    if (!this.active || !isPublicMessage(row, ticketId)) return;
    const entry = this.entry(ticketId);
    entry.events.set(row.id, { revision: ++entry.revision, message: row });
    this.update(entry, {
      messages: orderMessages([...entry.snapshot.messages.filter((item) => item.id !== row.id), row]),
      loading: false,
    });
  }
  remove(ticketId: string, id: unknown) {
    if (!this.active || typeof id !== "string") return;
    const entry = this.entry(ticketId);
    entry.events.set(id, { revision: ++entry.revision, message: null });
    this.update(entry, { messages: entry.snapshot.messages.filter((item) => item.id !== id) });
  }
  prefetch = async (ticketId: string) => {
    const entry = this.entry(ticketId);
    if (entry.snapshot.loaded && Date.now() - entry.fetchedAt < 15000) return;
    await this.reload(ticketId);
  };
  reload = (ticketId: string, afterCurrent = false): Promise<void> => {
    if (!this.active || !this.clientId || !ticketId) return Promise.resolve();
    const entry = this.entry(ticketId);
    if (entry.request) {
      // Only the replication-ready handshake needs a follow-up snapshot. Timers
      // and repeated clicks reuse the current request without making a queue.
      entry.reloadAfterRequest ||= afterCurrent;
      return entry.request;
    }
    const generation = this.generation;
    const revision = entry.revision;
    const controller = new AbortController();
    entry.controller = controller;
    this.update(entry, { loading: !entry.snapshot.loaded && entry.snapshot.messages.length === 0, error: "" });
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("Conversation request timed out"));
      }, requestTimeoutMs);
    });
    let fetched = false;
    entry.request = Promise.resolve().then(async () => {
      try {
        // Start REST immediately; a WebSocket join or typing authorization must
        // never hold the conversation's initial history behind its own readiness.
        const query = supabase.from("ticket_messages")
          .select("id, ticket_id, sender_id, message, is_internal, created_at")
          .eq("ticket_id", ticketId).eq("is_internal", false)
          .order("created_at", { ascending: true }).order("id", { ascending: true })
          .abortSignal(controller.signal);
        // The deadline includes SDK token acquisition, which can happen before
        // fetch itself begins and therefore is not always interrupted by abort.
        const { data, error } = await Promise.race([Promise.resolve(query), deadline]);
        if (!this.active || generation !== this.generation) return;
        if (error) throw new Error(error.message);
        const snapshot = new Map<string, ClientTicketMessage>();
        for (const row of data ?? []) if (isPublicMessage(row, ticketId)) snapshot.set(row.id, row);
        for (const [id, event] of entry.events) {
          if (event.revision <= revision) continue;
          if (event.message) snapshot.set(id, event.message);
          else snapshot.delete(id);
        }
        entry.fetchedAt = Date.now();
        fetched = true;
        this.update(entry, { messages: orderMessages([...snapshot.values()]), loaded: true, error: "" });
      } catch (fetchError) {
        if (this.active && generation === this.generation) {
          this.update(entry, { error: entry.snapshot.loaded
            ? "Couldn't refresh this conversation. Your loaded messages are still available."
            : "Messages are taking longer than expected. Use Refresh conversation to retry." });
          console.warn("Client conversation fetch failed:", fetchError);
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        if (generation === this.generation) {
          entry.request = null;
          entry.controller = null;
          const again = entry.reloadAfterRequest;
          entry.reloadAfterRequest = false;
          if (this.active) {
            this.update(entry, { loading: false });
            if (again && fetched) void this.reload(ticketId);
          }
        }
      }
    });
    return entry.request;
  };
}

const getServerSnapshot = () => emptySnapshot;

// Clients receive only the public-message mirror. Cache is memory-only and is
// isolated to this hook instance and authenticated client, never browser storage.
export function useClientTicketConversation(clientId: string, ticketId: string | null) {
  const cache = useMemo(() => new ConversationCache(clientId), [clientId]);
  const getSnapshot = useCallback(() => cache.snapshot(ticketId), [cache, ticketId]);
  const snapshot = useSyncExternalStore(cache.subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    cache.activate();
    return () => cache.dispose();
  }, [cache]);

  useEffect(() => {
    if (!clientId || !ticketId) return;
    let active = true;
    let subscribed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Request history first, even if Realtime setup subsequently fails.
    void cache.reload(ticketId);
    try {
      channel = supabase.channel(`client-ticket-conversation:${clientId}:${ticketId}:${crypto.randomUUID()}`, {
        config: { postgres_changes_options: { wait: true } },
      }).on("postgres_changes", {
        event: "*", schema: "public", table: "client_ticket_message_realtime",
        filter: `ticket_id=eq.${ticketId}`,
      }, (payload) => {
        if (!active) return;
        if (payload.eventType === "DELETE") cache.remove(ticketId, payload.old.id);
        else {
          const row = payload.new as ClientTicketMessage & { client_id: string };
          if (row.client_id === clientId) cache.upsert(ticketId, row);
        }
      }).on("system", {}, (payload) => {
        if (!active || payload.status !== "error") return;
        subscribed = false;
        cache.setReconnecting(ticketId, true);
        console.warn("Client conversation replication failed:", payload.message);
        void cache.reload(ticketId);
      }).subscribe((status, subscriptionError) => {
        if (!active) return;
        subscribed = status === "SUBSCRIBED";
        cache.setReconnecting(ticketId, !subscribed);
        if (subscribed) void cache.reload(ticketId, true);
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Client conversation subscription failed:", subscriptionError?.message ?? status);
          void cache.reload(ticketId);
        }
      });
    } catch (subscriptionError) {
      cache.setReconnecting(ticketId, true);
      console.warn("Client conversation subscription setup failed:", subscriptionError);
    }
    const recover = () => { if (document.visibilityState === "visible") void cache.reload(ticketId); };
    const fallback = window.setInterval(() => {
      if (!subscribed && document.visibilityState === "visible") void cache.reload(ticketId);
    }, 5000);
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      active = false;
      window.clearInterval(fallback);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [cache, clientId, ticketId]);

  const reload = useCallback(async () => { if (ticketId) await cache.reload(ticketId); }, [cache, ticketId]);
  const addMessage = useCallback((row: ClientTicketMessage) => { cache.upsert(row.ticket_id, row); }, [cache]);
  const prefetch = useCallback(async (nextTicketId: string) => { if (clientId) await cache.prefetch(nextTicketId); }, [cache, clientId]);
  return { messages: snapshot.messages,
    loading: snapshot.loading || Boolean(clientId && ticketId && snapshot === emptySnapshot), error: snapshot.error,
    reconnecting: snapshot.reconnecting, reload, addMessage, prefetch };
}
