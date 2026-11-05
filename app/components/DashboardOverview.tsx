"use client";

import { useSyncExternalStore } from "react";

type Section = "Withdrawals" | "Support tickets" | "Notifications" | "Settings";
type Activity = { id: string; kind: "notification" | "withdrawal" | "message" | "ticket"; title: string; detail: string; createdAt: string; section: string };
type IconName = "sun" | "moon" | "ticket" | "notification" | "withdrawal" | "shield" | "arrow" | "activity";

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, string> = {
    sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
    moon: "M20.7 13A8.7 8.7 0 0 1 11 3.3 8.8 8.8 0 1 0 20.7 13Z",
    ticket: "M8 10h8m-8 4h5M5 4h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-6 3V6a2 2 0 0 1 2-2Z",
    notification: "M9 18h6m-5 3h4M5 16c2-2 2-4 2-7a5 5 0 0 1 10 0c0 3 0 5 2 7H5Z",
    withdrawal: "M3 8h18M6 15h4M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    shield: "m12 3 8 3v6c0 5-5 8-8 10-3-2-8-5-8-10V6l8-3Zm-4 9 3 3 5-6",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    activity: "M3 12h4l3-7 4 14 3-7h4",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}

function subscribeToDeviceTime(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function getDevicePeriod() {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

export function DashboardWelcome({ name, unreadCount, onOpenTicket, onViewUpdates }: { name: string; unreadCount: number; onOpenTicket: () => void; onViewUpdates: () => void }) {
  // A stable server snapshot avoids using the server's timezone during hydration.
  const period = useSyncExternalStore(subscribeToDeviceTime, getDevicePeriod, () => "welcome");
  const greeting = period === "welcome" ? "Hello" : `Good ${period}`;
  return (
    <section aria-labelledby="dashboard-greeting" className="relative isolate mb-7 overflow-hidden rounded-[1.75rem] border border-cyan-100/15 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.16),transparent_55%),linear-gradient(120deg,#123048,#0c2135_55%,#0a1a2a)] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-8 lg:p-10">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-24 -top-24 size-80 rounded-full border border-cyan-100/10 sm:size-[28rem]" />
        <div className="absolute -bottom-32 -right-10 size-80 rounded-full border border-cyan-100/[0.06]" />
        <span className="absolute right-12 top-12 size-1.5 rounded-full bg-teal-200/60" />
      </div>
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-100/85 sm:text-xs"><span aria-hidden="true" className="size-1.5 rounded-full bg-teal-300" /> Your day, a little clearer</p>
          <h2 id="dashboard-greeting" className="mt-4 break-words text-[1.7rem] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-4xl">{greeting}, <span className="text-cyan-200">{name}</span><span className="text-teal-300">.</span></h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">Your requests, conversations, and account updates. Everything you need to find your next step.</p>
        </div>
        <div className="hidden shrink-0 rounded-full border border-cyan-100/15 bg-cyan-100/[0.04] p-5 text-teal-200 shadow-[0_0_50px_rgba(45,212,191,0.1)] sm:block"><Icon name={period === "evening" ? "moon" : "sun"} className="size-10" /></div>
      </div>
      <div className="relative mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={onOpenTicket} className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-5 py-3 text-sm font-semibold text-[#061720] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"><Icon name="ticket" />Open support ticket<Icon name="arrow" className="size-4" /></button>
        <button type="button" onClick={onViewUpdates} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-100/15 bg-[#081927]/40 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"><Icon name="notification" />{unreadCount > 0 ? `${unreadCount} unread ${unreadCount === 1 ? "update" : "updates"}` : "View account updates"}</button>
      </div>
    </section>
  );
}

const toolkit = [
  { title: "Follow a withdrawal", description: "Check the recorded status, asset, and destination details together.", action: "Review withdrawals", section: "Withdrawals", icon: "withdrawal", tone: "text-teal-200 bg-teal-200/[0.07] border-teal-200/15" },
  { title: "Keep the conversation going", description: "Have more context? Reply in your existing ticket to keep it all in one place.", action: "Open your tickets", section: "Support tickets", icon: "ticket", tone: "text-sky-200 bg-sky-200/[0.07] border-sky-200/15" },
  { title: "Keep your account private", description: "Review your account details and find the password reset option in settings.", action: "Account settings", section: "Settings", icon: "shield", tone: "text-violet-200 bg-violet-200/[0.07] border-violet-200/15" },
] as const;

export function SupportToolkit({ onNavigate }: { onNavigate: (section: Section) => void }) {
  return (
    <section aria-labelledby="support-toolkit-title" className="mt-8">
      <div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="h-6 w-1 rounded-full bg-teal-300" /><div><h3 id="support-toolkit-title" className="text-lg font-semibold text-white">Make the most of your support account</h3><p className="mt-1 text-sm text-slate-400">A few useful places to start.</p></div></div>
      <div className="grid gap-3 md:grid-cols-3">
        {toolkit.map((item) => (
          <article key={item.title} className="flex min-w-0 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#102438] to-[#0a1827] p-5 sm:p-6">
            <span className={`mb-5 grid size-11 place-items-center rounded-xl border ${item.tone}`}><Icon name={item.icon} className="size-5" /></span>
            <h4 className="text-base font-semibold text-white">{item.title}</h4>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
            <button type="button" onClick={() => onNavigate(item.section)} className="mt-auto inline-flex min-h-10 items-center justify-between gap-3 rounded-lg border-t border-white/[0.07] pt-4 text-left text-sm font-medium text-cyan-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200">{item.action}<Icon name="arrow" className="size-4" /></button>
          </article>
        ))}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><Icon name="shield" className="mt-0.5 size-4 shrink-0" />Keep recovery phrases, private keys, passwords, and verification codes out of support messages.</p>
    </section>
  );
}

export function RecentAccountActivity({ items, onNavigate }: { items: Activity[]; onNavigate: (section: string) => void }) {
  return (
    <section aria-labelledby="recent-activity-title" className="mt-8 overflow-hidden rounded-[1.5rem] border border-cyan-100/10 bg-gradient-to-br from-[#10263a] to-[#081624] shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] p-5 sm:px-7 sm:py-6">
        <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-200"><Icon name="activity" /></span><div><h3 id="recent-activity-title" className="text-lg font-semibold text-white">Recent activity</h3><p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm">Your account story, in one place.</p></div></div>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300">{items.length} {items.length === 1 ? "update" : "updates"}</span>
      </header>
      {items.length > 0 ? (
        <div tabIndex={0} role="region" aria-label="Recent account activity, scroll for more updates" data-recent-activity-scroll className="scrollbar-hide max-h-[360px] overflow-y-auto overscroll-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200">
          <ol className="divide-y divide-white/[0.06] px-5 sm:px-7">
            {items.map((item) => {
              const icon = item.kind === "notification" ? "notification" : item.kind === "withdrawal" ? "withdrawal" : "ticket";
              const tone = item.kind === "notification" ? "text-amber-200 border-amber-200/15 bg-amber-200/[0.06]" : item.kind === "withdrawal" ? "text-teal-200 border-teal-200/15 bg-teal-200/[0.06]" : "text-sky-200 border-sky-200/15 bg-sky-200/[0.06]";
              return <li key={item.id}><button type="button" onClick={() => onNavigate(item.section)} className="group flex min-h-[112px] w-full items-start gap-3 rounded-lg py-5 text-left transition hover:bg-white/[0.025] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-200 sm:items-center sm:gap-4">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${tone}`}><Icon name={icon} className="size-5" /></span>
                <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-5">
                  <span className="break-words text-sm font-semibold text-slate-100">{item.title}</span>
                  <time dateTime={item.createdAt} className="text-[11px] leading-5 text-slate-500 sm:col-start-2 sm:row-start-1">{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                  <span className="line-clamp-2 break-words text-xs leading-5 text-slate-400 sm:col-span-2 sm:text-sm">{item.detail}</span>
                </span>
                <span className="mt-1 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-200"><Icon name="arrow" className="size-4" /></span>
              </button></li>;
            })}
          </ol>
        </div>
      ) : <div className="px-6 py-10 text-center"><p className="text-sm font-medium text-slate-200">A fresh start</p><p className="mt-2 text-sm text-slate-400">Your requests, replies, and account updates will appear here.</p></div>}
      <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-slate-500 sm:px-7">Select an update to visit its section{items.length > 3 ? " · Scroll to see more" : ""}</div>
    </section>
  );
}
