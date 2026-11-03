"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActivityLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

function formatLabel(value: string) {
  return value
    .replace(/[_.-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function detailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function ActivityGlyph() { return <svg viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path fill="none" stroke="#081a2a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 6.5V12h4"/></svg>; }

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#091a2a]/90 p-4 sm:p-5">
      <div className={`mb-4 h-1 w-10 rounded-full ${tone}`} />
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");

    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData.user;
    if (authError || !user) {
      setError("Your admin session could not be verified. Sign in again to view the audit trail.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      setError("Administrator access is required to view activity records.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("activity_logs")
      .select("id,actor_id,action,entity_type,entity_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (queryError) {
      setError(`Could not load activity records: ${queryError.message}`);
    } else {
      setLogs((data ?? []) as ActivityLog[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load(true);

    const channel = supabase
      .channel("admin-activity-live:" + crypto.randomUUID(), { config: { postgres_changes_options: { wait: true } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_logs" },
        () => void load(false),
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setRealtimeConnected(connected);
        if (connected) void load(false);
      });

    const refreshWhenAvailable = () => {
      if (document.visibilityState === "visible") void load(false);
    };

    window.addEventListener("online", refreshWhenAvailable);
    document.addEventListener("visibilitychange", refreshWhenAvailable);

    return () => {
      window.removeEventListener("online", refreshWhenAvailable);
      document.removeEventListener("visibilitychange", refreshWhenAvailable);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const actions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action).filter(Boolean))).sort(),
    [logs],
  );

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const searchable = [
        log.action,
        log.entity_type,
        log.entity_id ?? "",
        log.actor_id ?? "",
        JSON.stringify(log.details ?? {}),
      ].join(" ").toLowerCase();
      return matchesAction && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [actionFilter, logs, query]);

  const todayCount = useMemo(() => {
    const today = new Date();
    return logs.filter((log) => {
      const createdAt = new Date(log.created_at);
      return createdAt.toDateString() === today.toDateString();
    }).length;
  }, [logs]);

  const entityCount = useMemo(
    () => new Set(logs.map((log) => log.entity_type).filter(Boolean)).size,
    [logs],
  );

  const latestEvent = logs[0] ? formatDate(logs[0].created_at) : "No events yet";

  return (
    <section className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-cyan-200/10 bg-gradient-to-br from-[#10283a] via-[#0a1c2c] to-[#071523] p-5 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-cyan-200/[0.08]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-6 -top-14 h-44 w-44 rounded-full border border-cyan-200/[0.07]" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.09] text-cyan-200">
              <ActivityGlyph />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">Audit trail</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Activity log</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300/80">
                Review recorded actions, the affected record, who performed them, and when they happened.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start md:self-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/15 px-3 py-2 text-xs text-slate-300">
              <span className={`h-2 w-2 rounded-full ${realtimeConnected ? "bg-emerald-300" : "bg-slate-500"}`} />
              {realtimeConnected ? "Live updates on" : "Connecting live updates"}
            </span>
            <button
              type="button"
              onClick={() => { setRefreshing(true); void load(false); }}
              disabled={refreshing}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-slate-200 transition hover:border-cyan-200/20 hover:bg-white/[0.07] disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true">
                <path d="M20 7v5h-5M4.8 9a7.5 7.5 0 0 1 12.6-2L20 9M4 17v-5h5m10.2 3a7.5 7.5 0 0 1-12.6 2L4 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recorded events" value={String(logs.length)} detail="Latest 200 records" tone="bg-cyan-300" />
        <StatCard label="Today" value={String(todayCount)} detail="Events recorded today" tone="bg-emerald-300" />
        <StatCard label="Record categories" value={String(entityCount)} detail="Different affected record types" tone="bg-violet-300" />
        <StatCard label="Most recent" value={logs[0] ? "Latest event" : "—"} detail={latestEvent} tone="bg-amber-300" />
      </div>

      <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#081a2a]" aria-label="Recorded activity">
        <div className="border-b border-white/[0.07] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Latest events</h3>
              <p className="mt-1 text-sm text-slate-400">Showing {visibleLogs.length} of {logs.length} loaded records</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(180px,220px)_minmax(240px,360px)]">
              <label className="sr-only" htmlFor="activity-action-filter">Filter by action</label>
              <select
                id="activity-action-filter"
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="min-h-11 rounded-xl border border-white/10 bg-[#04101d] px-3.5 text-sm text-slate-200 outline-none focus:border-cyan-300/50"
              >
                <option value="all">All actions</option>
                {actions.map((action) => <option key={action} value={action}>{formatLabel(action)}</option>)}
              </select>
              <label className="sr-only" htmlFor="activity-search">Search activity</label>
              <input
                id="activity-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search action, actor, record, or details"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#04101d] px-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
              />
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="m-4 flex flex-col gap-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] p-4 sm:m-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-rose-100">{error}</p>
            <button type="button" onClick={() => void load(true)} className="shrink-0 rounded-xl border border-rose-200/15 px-3 py-2 text-sm text-rose-100 hover:bg-rose-200/[0.06]">Try again</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 p-4 sm:p-5" aria-label="Loading activity records">
            {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]" />)}
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="px-5 py-12 text-center sm:py-16">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-200/80"><ActivityGlyph /></span>
            <h4 className="mt-4 text-base font-semibold text-white">{logs.length === 0 ? "No activity recorded yet" : "No matching activity"}</h4>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
              {logs.length === 0
                ? "When application workflows write audit events, they will appear here with the action, affected record, actor, and timestamp."
                : "Try another search or action filter to find the event you need."}
            </p>
            {(query || actionFilter !== "all") && (
              <button type="button" onClick={() => { setQuery(""); setActionFilter("all"); }} className="mt-4 rounded-xl border border-cyan-200/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/[0.06]">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {visibleLogs.map((log) => {
              const details = Object.entries(log.details ?? {});
              return (
                <article key={log.id} className="group grid gap-4 px-4 py-5 transition hover:bg-white/[0.018] sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.42fr)] lg:gap-8">
                  <div className="flex min-w-0 gap-3.5">
                    <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-200">
                      <ActivityGlyph />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-white">{formatLabel(log.action || "Activity")}</h4>
                        <span className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.05] px-2.5 py-1 text-[11px] font-medium text-cyan-100">{formatLabel(log.entity_type || "Record")}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Record ID</p>
                      <p className="mt-0.5 break-all font-mono text-xs text-slate-300">{log.entity_id || "Not provided"}</p>
                      {details.length > 0 ? (
                        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                          {details.map(([key, value]) => (
                            <div key={key} className="min-w-0 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2">
                              <dt className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{formatLabel(key)}</dt>
                              <dd className="mt-1 break-words text-xs leading-5 text-slate-300">{detailValue(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-3 text-xs text-slate-500">No additional details were recorded.</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-3 text-xs lg:flex-col lg:items-end lg:justify-start lg:border-0 lg:pt-1">
                    <div className="lg:text-right">
                      <p className="text-slate-500">Performed by</p>
                      <p className="mt-1 break-all font-mono text-slate-300">{log.actor_id || "System / unavailable"}</p>
                    </div>
                    <time className="whitespace-nowrap text-slate-400">{formatDate(log.created_at)}</time>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
