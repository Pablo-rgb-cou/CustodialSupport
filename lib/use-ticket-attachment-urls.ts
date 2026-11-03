"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

type CachedUrl = { url: string | null; expiresAt: number; refreshAt: number };
type PendingUrl = { promise: Promise<void>; resolve: () => void };
const signedUrlLifetimeSeconds = 60 * 60;
const refreshMarginMs = 5 * 60 * 1000;
const signingTimeoutMs = 12000;
const retryDelayMs = 30000;
const batchSize = 12;
const maxConcurrentBatches = 2;

// One instance belongs to one mounted hook and signed-in viewer. URLs stay in
// memory and retain the same token until renewal so the browser can reuse bytes.
class TicketAttachmentUrls {
  private urls = new Map<string, CachedUrl>();
  private pending = new Map<string, PendingUrl>();
  private queue: string[] = [];
  private listeners = new Set<() => void>();
  private lastRetryAt = new Map<string, number>();
  private generation = 0;
  private active = true;
  private running = 0;
  private version = 0;
  constructor(private readonly viewerId: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getVersion = () => this.version;
  private changed() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
  activate() { this.active = true; }
  dispose() {
    this.active = false;
    this.generation += 1;
    this.running = 0;
    this.queue = [];
    for (const request of this.pending.values()) request.resolve();
    this.pending.clear();
    this.urls.clear();
    this.lastRetryAt.clear();
    this.version += 1;
  }
  read(paths: string[]) {
    const result: Record<string, string | null> = {};
    const now = Date.now();
    for (const path of paths) {
      const entry = this.urls.get(path);
      if (entry && entry.expiresAt > now) result[path] = entry.url;
    }
    return result;
  }
  ensure = async (paths: string[]) => {
    if (!this.active || !this.viewerId) return;
    const waiting: Promise<void>[] = [];
    for (const path of paths) {
      const existing = this.pending.get(path);
      if (existing) { waiting.push(existing.promise); continue; }
      const cached = this.urls.get(path);
      if (cached && cached.refreshAt > Date.now()) continue;
      let complete!: () => void;
      const promise = new Promise<void>((resolve) => { complete = resolve; });
      this.pending.set(path, { promise, resolve: complete });
      this.queue.push(path);
      waiting.push(promise);
    }
    this.pump();
    await Promise.all(waiting);
  };
  retry = async (path: string) => {
    if (!this.active || Date.now() - (this.lastRetryAt.get(path) ?? 0) < 10000) return;
    this.lastRetryAt.set(path, Date.now());
    this.urls.delete(path);
    this.changed();
    await this.ensure([path]);
  };
  private pump() {
    while (this.active && this.running < maxConcurrentBatches && this.queue.length) {
      const paths = this.queue.splice(0, batchSize);
      const generation = this.generation;
      this.running += 1;
      void this.sign(paths, generation).finally(() => {
        if (generation !== this.generation) return;
        this.running -= 1;
        for (const path of paths) {
          this.pending.get(path)?.resolve();
          this.pending.delete(path);
        }
        this.pump();
      });
    }
  }
  private async sign(paths: string[], generation: number) {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const isCurrent = () => this.active && generation === this.generation;
    const fail = (path: string) => {
      const now = Date.now();
      const old = this.urls.get(path);
      // A temporary signing failure need not discard a still-valid image URL.
      this.urls.set(path, old?.url && old.expiresAt > now
        ? { ...old, refreshAt: now + retryDelayMs }
        : { url: null, expiresAt: now + retryDelayMs, refreshAt: now + retryDelayMs });
    };
    try {
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Ticket photo signing timed out")), signingTimeoutMs);
      });
      const { data, error } = await Promise.race([
        supabase.storage.from("ticket-attachments").createSignedUrls(paths, signedUrlLifetimeSeconds),
        deadline,
      ]);
      if (!isCurrent()) return;
      if (error) throw new Error(error.message);
      const entries = new Map((data ?? []).map((item) => [item.path, item]));
      const expiresAt = Date.now() + signedUrlLifetimeSeconds * 1000;
      for (const path of paths) {
        const item = entries.get(path);
        if (item?.signedUrl && !item.error) {
          this.urls.set(path, { url: item.signedUrl, expiresAt, refreshAt: expiresAt - refreshMarginMs });
        } else fail(path);
      }
      this.changed();
    } catch (error) {
      if (isCurrent()) {
        for (const path of paths) fail(path);
        this.changed();
        console.warn("Could not load ticket photo links:", error);
      }
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

const getServerVersion = () => 0;

export function useTicketAttachmentUrls(viewerId: string, ticketId: string | null, photoPaths: string[]) {
  const cache = useMemo(() => new TicketAttachmentUrls(viewerId), [viewerId]);
  // The same set of photo paths must not restart signing when text messages or
  // profile information change. Only relative paths within this ticket qualify.
  const pathsKey = JSON.stringify([...new Set(photoPaths.filter((path) =>
    Boolean(ticketId) && path.startsWith(`${ticketId}/`) &&
    !path.split("/").some((part) => part === ".." || part === ".")
  ))]);
  const paths = useMemo(() => JSON.parse(pathsKey) as string[], [pathsKey]);
  useSyncExternalStore(cache.subscribe, cache.getVersion, getServerVersion);
  const urls = viewerId ? cache.read(paths) : {};

  useEffect(() => {
    cache.activate();
    return () => cache.dispose();
  }, [cache]);
  useEffect(() => {
    if (!viewerId || !ticketId || paths.length === 0) return;
    // Newest attachments are queued first, ahead of older off-screen history.
    void cache.ensure([...paths].reverse());
    const renew = () => { if (document.visibilityState === "visible") void cache.ensure([...paths].reverse()); };
    const timer = window.setInterval(renew, 60000);
    window.addEventListener("online", renew);
    document.addEventListener("visibilitychange", renew);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", renew);
      document.removeEventListener("visibilitychange", renew);
    };
  }, [cache, paths, ticketId, viewerId]);
  const retry = useCallback(async (path: string) => {
    if (viewerId && paths.includes(path)) await cache.retry(path);
  }, [cache, paths, viewerId]);
  return { urls, retry };
}
