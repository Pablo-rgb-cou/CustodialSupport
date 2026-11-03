"use client";

import { supabase } from "./supabase";
import { withRequestTimeout } from "./with-request-timeout";

// The database queues the event. This only wakes its scoped worker promptly;
// email outages must never turn a successfully saved chat message into an error.
export async function dispatchTicketEmail(ticketId: string): Promise<void> {
  try {
    const { data, error } = await withRequestTimeout(() => supabase.auth.getSession(), { timeoutMs: 4000 });
    if (error || !data.session) return;
    await withRequestTimeout((signal) => fetch("/api/support/email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session!.access_token}` },
      body: JSON.stringify({ ticketId }),
      signal,
    }), { timeoutMs: 20000 });
  } catch {
    // A configured scheduler can retry queued work without the client staying open.
  }
}
