"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { WithdrawalRecord } from "../app/components/WithdrawalRecords";

const labels: Record<string, WithdrawalRecord["status"]> = {
  pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed", cancelled: "Cancelled",
};

export function useWithdrawalPreviewStatuses(recordIds: string[], refreshVersion = 0) {
  const key = JSON.stringify([...new Set(recordIds)].sort());
  const [statuses, setStatuses] = useState<Record<string, WithdrawalRecord["status"]>>({});
  useEffect(() => {
    const ids: string[] = JSON.parse(key);
    if (!ids.length) return;
    let active = true;
    let request = 0;
    const allowed = new Set(ids);
    async function refresh() {
      const sequence = ++request;
      try {
        const { data, error } = await supabase.from("withdrawal_demo_tokens")
          .select("withdrawal_id,demo_status").in("withdrawal_id", ids);
        if (!active || sequence !== request || error) return;
        const next: Record<string, WithdrawalRecord["status"]> = {};
        for (const row of data ?? []) {
          if (allowed.has(row.withdrawal_id) && Object.prototype.hasOwnProperty.call(labels, row.demo_status)) next[row.withdrawal_id] = labels[row.demo_status];
        }
        setStatuses(next);
      } catch { /* Preserve the last confirmed preview during a transient outage. */ }
    }
    // Postgres Changes IN filters accept up to 100 values. RLS still enforces ownership.
    const channel = supabase.channel(`withdrawal-previews:${crypto.randomUUID()}`);
    for (let offset = 0; offset < ids.length; offset += 100) {
      channel.on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_demo_tokens", filter: `withdrawal_id=in.(${ids.slice(offset, offset + 100).join(",")})` }, payload => {
        if (!active) return;
        ++request; // A late snapshot cannot overwrite the event that just arrived.
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as { withdrawal_id?: string; demo_status?: string | null };
        const id = row.withdrawal_id;
        if (id && allowed.has(id)) setStatuses(current => {
          const next = { ...current };
          if (payload.eventType !== "DELETE" && row.demo_status && Object.prototype.hasOwnProperty.call(labels, row.demo_status)) next[id] = labels[row.demo_status];
          else delete next[id];
          return next;
        });
        void refresh();
      });
    }
    channel.subscribe(status => { if (active && status === "SUBSCRIBED") void refresh(); });
    const recover = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      active = false;
      void supabase.removeChannel(channel);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [key, refreshVersion]);
  // Never carry preview statuses into a different account's record set.
  return Object.fromEntries(recordIds.filter(id => statuses[id]).map(id => [id, statuses[id]]));
}
