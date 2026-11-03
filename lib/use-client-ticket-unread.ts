"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type TicketUnreadMetadata = {
  id: string;
  ticket_id: string;
  client_id: string;
  sender_id: string;
  is_internal: boolean;
  created_at: string;
};
type VisibleMessage = Omit<TicketUnreadMetadata, "client_id">;
type Change = { eventType: string; new?: unknown; old?: unknown };
type Snapshot = { unreadByTicket: Record<string, number>; totalUnread: number; loading: boolean; error: string };
type Page = (clientId: string, offset: number, signal: AbortSignal) => Promise<TicketUnreadMetadata[]>;
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const emptySnapshot: Snapshot = { unreadByTicket: {}, totalUnread: 0, loading: false, error: "" };
const pageSize = 1000;

function validMetadata(value: unknown, clientId: string): value is TicketUnreadMetadata {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<TicketUnreadMetadata>;
  return row.client_id === clientId && row.is_internal === false && row.sender_id !== clientId &&
    typeof row.id === "string" && typeof row.ticket_id === "string" &&
    typeof row.sender_id === "string" && typeof row.created_at === "string";
}

async function fetchPage(clientId: string, offset: number, signal: AbortSignal) {
  const { data, error } = await supabase.from("client_ticket_message_realtime")
    .select("id, ticket_id, client_id, sender_id, is_internal, created_at")
    .eq("client_id", clientId).neq("sender_id", clientId).eq("is_internal", false)
    .order("id", { ascending: true }).range(offset, offset + pageSize - 1).abortSignal(signal);
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketUnreadMetadata[];
}

// The cache stores message IDs and metadata, never chat contents. Read IDs are
// exact, so opening one ticket cannot clear another ticket or a later reply.
export class ClientTicketUnreadCache {
  readonly storageKey: string;
  private rows = new Map<string, TicketUnreadMetadata>();
  private readIds = new Set<string>();
  private events = new Map<string, { revision: number; row: TicketUnreadMetadata | null }>();
  private revision = 0;
  private generation = 0;
  private active = true;
  private request: Promise<void> | null = null;
  private refreshAfterRequest = false;
  private controller: AbortController | null = null;
  private listeners = new Set<() => void>();
  private state = emptySnapshot;

  constructor(readonly clientId: string, private page: Page = fetchPage, private storage?: Storage) {
    this.storageKey = `custodialsupport:client-ticket-read:v1:${clientId}`;
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private publish(update: Partial<Snapshot> = {}) {
    const unreadByTicket: Record<string, number> = {};
    let totalUnread = 0;
    for (const row of this.rows.values()) if (!this.readIds.has(row.id)) {
      unreadByTicket[row.ticket_id] = (unreadByTicket[row.ticket_id] ?? 0) + 1;
      totalUnread += 1;
    }
    this.state = { ...this.state, ...update, unreadByTicket, totalUnread };
    for (const listener of this.listeners) listener();
  }
  private readStorage() {
    try {
      const value = JSON.parse(this.storage?.getItem(this.storageKey) ?? "null") as { version?: unknown; ids?: unknown } | null;
      if (value?.version === 1 && Array.isArray(value.ids)) {
        for (const id of value.ids) if (typeof id === "string") this.readIds.add(id);
      }
    } catch { /* Reading still works when storage is unavailable or corrupted. */ }
  }
  private persist() {
    try { this.storage?.setItem(this.storageKey, JSON.stringify({ version: 1, ids: [...this.readIds] })); }
    catch { /* Keep exact read tracking in memory if the browser storage is full. */ }
  }
  activate() { this.active = true; this.readStorage(); this.publish(); }
  dispose() {
    this.active = false;
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
    this.request = null;
    this.refreshAfterRequest = false;
    this.rows.clear(); this.readIds.clear(); this.events.clear();
    this.state = emptySnapshot;
  }
  syncStorage = () => { if (this.active) { this.readStorage(); this.publish(); } };
  applyEvent = (change: Change) => {
    if (!this.active || !this.clientId) return;
    if (change.eventType === "DELETE") {
      const id = (change.old as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string") return;
      this.rows.delete(id);
      this.readIds.delete(id);
      this.events.set(id, { revision: ++this.revision, row: null });
    } else {
      if (!validMetadata(change.new, this.clientId)) {
        // An existing public reply may have been made internal or reassigned.
        const row = change.new as Partial<TicketUnreadMetadata> | undefined;
        if (row?.client_id !== this.clientId || typeof row.id !== "string") return;
        this.rows.delete(row.id);
        this.events.set(row.id, { revision: ++this.revision, row: null });
      } else {
        const row = change.new;
        this.rows.set(row.id, row);
        this.events.set(row.id, { revision: ++this.revision, row });
      }
    }
    this.publish();
  };
  markRead = (ticketId: string, actuallyVisibleMessages: readonly VisibleMessage[]) => {
    if (!this.active || !this.clientId) return;
    const previousReads = this.readIds.size;
    this.readStorage(); // Merge reads performed in another tab before persisting.
    let changed = previousReads !== this.readIds.size;
    for (const message of actuallyVisibleMessages) {
      const row = { ...message, client_id: this.clientId };
      if (row.ticket_id === ticketId && validMetadata(row, this.clientId) && !this.readIds.has(row.id)) {
        changed = true;
        this.readIds.add(row.id);
        this.rows.set(row.id, row);
        this.events.set(row.id, { revision: ++this.revision, row });
      }
    }
    if (!changed) return;
    this.persist(); this.publish();
  };
  refresh = (afterCurrent = false): Promise<void> => {
    if (!this.active || !this.clientId) return Promise.resolve();
    if (this.request) { this.refreshAfterRequest ||= afterCurrent; return this.request; }
    const generation = this.generation;
    const revision = this.revision;
    const controller = new AbortController();
    this.controller = controller;
    this.publish({ loading: true, error: "" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Unread messages request timed out")); }, 12000);
    });
    const fetchAll = async () => {
      const rows = new Map<string, TicketUnreadMetadata>();
      for (let offset = 0; ; offset += pageSize) {
        const page = await this.page(this.clientId, offset, controller.signal);
        if (!this.active || generation !== this.generation || controller.signal.aborted) return rows;
        for (const row of page) if (validMetadata(row, this.clientId)) rows.set(row.id, row);
        if (page.length < pageSize) return rows;
      }
    };
    let fetched = false;
    this.request = Promise.race([fetchAll(), deadline]).then((rows) => {
      if (!this.active || generation !== this.generation) return;
      for (const [id, event] of this.events) if (event.revision > revision) {
        if (event.row) rows.set(id, event.row); else rows.delete(id);
      }
      this.rows = rows;
      for (const [id, event] of this.events) if (event.revision <= revision) this.events.delete(id);
      // Prune only after the entire authoritative snapshot is loaded. This bounds
      // stored IDs to extant support replies without dropping unread exceptions.
      this.readIds = new Set([...this.readIds].filter((id) => rows.has(id)));
      this.persist();
      fetched = true;
    }).catch(() => {
      if (this.active && generation === this.generation) this.publish({ error: "Could not refresh unread support replies." });
    }).finally(() => {
      if (timer) clearTimeout(timer);
      if (this.active && generation === this.generation) {
        this.request = null; this.controller = null;
        this.publish({ loading: false });
        const again = this.refreshAfterRequest;
        this.refreshAfterRequest = false;
        if (again && fetched) void this.refresh();
      }
    });
    return this.request;
  };
}

const getServerSnapshot = () => emptySnapshot;
function browserStorage() {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function useClientTicketUnread(clientId: string) {
  const cache = useMemo(() => new ClientTicketUnreadCache(clientId, fetchPage, browserStorage()), [clientId]);
  const snapshot = useSyncExternalStore(cache.subscribe, cache.snapshot, getServerSnapshot);
  useEffect(() => {
    cache.activate();
    void cache.refresh();
    const storageChanged = (event: StorageEvent) => { if (event.key === cache.storageKey) cache.syncStorage(); };
    window.addEventListener("storage", storageChanged);
    return () => { window.removeEventListener("storage", storageChanged); cache.dispose(); };
  }, [cache]);
  return { ...snapshot, markRead: cache.markRead, applyEvent: cache.applyEvent, refresh: cache.refresh };
}
