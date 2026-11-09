"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { withRequestTimeout } from "./with-request-timeout";
import { defaultIdleTimeoutMs, recordSessionActivity, sessionActivityKey } from "./session-activity";

// Mount only for an authenticated dashboard. Navigation preserves the timestamp;
// a new explicit sign-in records fresh activity before entering the dashboard.
export function useIdleSession(userId: string, onExpired: () => void, { timeoutMs = defaultIdleTimeoutMs, onSignedOut }: { timeoutMs?: number; onSignedOut?: () => void } = {}) {
  const expiredCallback = useRef(onExpired);
  const signedOutCallback = useRef(onSignedOut);
  useEffect(() => { expiredCallback.current = onExpired; }, [onExpired]);
  useEffect(() => { signedOutCallback.current = onSignedOut; }, [onSignedOut]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let expiring = false;
    let lastWrite = 0;
    const key = sessionActivityKey(userId);
    const savedActivity = () => {
      try {
        const saved = Number(window.localStorage.getItem(key));
        return Number.isFinite(saved) && saved > 0 ? Math.min(saved, Date.now()) : null;
      } catch { return null; }
    };
    let lastActive = savedActivity() ?? Date.now();
    const read = () => { const saved = savedActivity(); if (saved !== null) lastActive = Math.max(lastActive, saved); };
    const expire = () => {
      if (!active || expiring) return;
      expiring = true;
      // Hide authenticated UI immediately; the SDK clears/broadcasts its session.
      expiredCallback.current();
      void withRequestTimeout(() => supabase.auth.signOut({ scope: "local" }), { timeoutMs: 5000 }).catch(() => {
        // The expired activity marker still prevents re-entry until a fresh sign-in.
      }).finally(() => signedOutCallback.current?.());
    };
    const check = () => {
      read();
      if (Date.now() - lastActive >= timeoutMs) { expire(); return false; }
      return true;
    };
    const activity = () => {
      if (!active || expiring || !check()) return;
      lastActive = Date.now();
      if (lastActive - lastWrite >= 15000) { recordSessionActivity(userId, lastActive); lastWrite = lastActive; }
    };
    const resume = () => { if (document.visibilityState === "visible" && check()) activity(); };
    const storageChanged = (event: StorageEvent) => { if (event.key === key) check(); };
    if (check()) recordSessionActivity(userId, lastActive);
    for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) window.addEventListener(event, activity, { passive: true });
    window.addEventListener("focus", resume);
    window.addEventListener("storage", storageChanged);
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(check, 30000);
    return () => {
      active = false;
      window.clearInterval(timer);
      for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) window.removeEventListener(event, activity);
      window.removeEventListener("focus", resume);
      window.removeEventListener("storage", storageChanged);
      document.removeEventListener("visibilitychange", resume);
      if (!expiring) { read(); recordSessionActivity(userId, lastActive); }
    };
  }, [userId, timeoutMs]);
}
