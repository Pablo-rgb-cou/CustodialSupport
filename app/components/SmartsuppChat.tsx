"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { leaveClientDashboard, mountSmartsupp, setSmartsuppConsent, setSmartsuppVisibility } from "@/lib/smartsupp-lifecycle";

/** Mounted only after getUser() and the client's protected profile role check. */
export default function SmartsuppChat({ userId, hidden, profileName }: { userId: string; hidden: boolean; profileName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [identify, setIdentify] = useState(false);
  const [sharedName, setSharedName] = useState(false);
  function save(reject = false) {
    const share = !reject && identify;
    setSmartsuppConsent(!reject && analytics, !reject && marketing, share ? profileName : undefined);
    if (sharedName && !share) {
      // A new visitor context avoids retaining a previously shared name.
      leaveClientDashboard(window.location.href, () => window.location.reload());
      return;
    }
    if (reject) { setAnalytics(false); setMarketing(false); setIdentify(false); }
    setSharedName(share);
    setOpen(false);
  }
  useEffect(() => {
    if (pathname !== "/dashboard" || !userId) return;
    return mountSmartsupp(userId);
  }, [pathname, userId]);
  useEffect(() => {
    setSmartsuppVisibility(pathname === "/dashboard" && !hidden);
  }, [pathname, hidden, userId]);
  if (hidden || pathname !== "/dashboard") return null;
  return <aside aria-label="Live chat privacy" className="fixed bottom-4 left-4 z-[10000001] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-cyan-200/20 bg-[#081b2b] p-3 text-sm text-slate-200 shadow-xl lg:left-[286px]">
    {open ? <div className="w-80 max-w-full space-y-3">
      <p className="font-semibold text-white">Live chat privacy</p>
      <p className="text-xs leading-5 text-slate-400">Chat works without optional tracking. Choose what Smartsupp may use for this page session. Choices reset on refresh or sign-out.</p>
      <label className="flex items-start gap-2"><input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />Optional analytics and page-visit tracking</label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />Optional marketing and visit-count tracking</label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={identify} onChange={e => setIdentify(e.target.checked)} />Share my profile name with support agents</label>
      <p className="text-xs text-slate-400">Previously shared names/messages may remain in support history. Never send passwords, codes, private keys or wallet recovery phrases.</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => save(true)} className="rounded-lg border border-white/20 px-3 py-2">Reject optional</button><button type="button" onClick={() => save()} className="rounded-lg bg-teal-300 px-3 py-2 font-semibold text-slate-950">Save choices</button></div>
    </div> : <button type="button" onClick={() => setOpen(true)} className="text-xs text-cyan-200">Chat privacy choices</button>}
  </aside>;
}
