"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import CryptoAssetIcon, { getCryptoAssetName } from "./CryptoAssetIcon";

export type WithdrawalRecord = {
  id: string;
  reference: string;
  asset: string | null;
  cryptoAmount: number | null;
  walletAddress: string | null;
  fiatAmount: number;
  currency: string;
  status: "Completed" | "Processing" | "Pending" | "Failed" | "Cancelled";
  date: string;
  createdAtISO: string;
};

const statusTones: Record<WithdrawalRecord["status"], string> = {
  Completed: "text-emerald-300 border-emerald-300/20 bg-emerald-300/[0.08]",
  Processing: "text-sky-300 border-sky-300/20 bg-sky-300/[0.08]",
  Pending: "text-amber-300 border-amber-300/20 bg-amber-300/[0.08]",
  Failed: "text-rose-300 border-rose-300/20 bg-rose-300/[0.08]",
  Cancelled: "text-slate-400 border-slate-300/15 bg-slate-300/[0.05]",
};

function formatFiat(record: WithdrawalRecord) {
  const currency = ["USD", "EUR", "GBP"].includes(record.currency) ? record.currency : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(record.fiatAmount);
}

function hasCryptoAmount(record: WithdrawalRecord) {
  return Boolean(record.asset) && record.cryptoAmount !== null && Number.isFinite(record.cryptoAmount);
}

function formatAmount(record: WithdrawalRecord) {
  return hasCryptoAmount(record)
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 12 }).format(record.cryptoAmount!)} ${record.asset}`
    : formatFiat(record);
}

function shorten(value: string) {
  return value.length > 19 ? `${value.slice(0, 7)}…${value.slice(-6)}` : value;
}

function formatDate(value: string, full = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, full
    ? { dateStyle: "medium", timeStyle: "short" }
    : { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function WithdrawalStatus({ status }: { status: WithdrawalRecord["status"] }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTones[status]}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{status}</span>;
}

function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError("");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copy unavailable. Select the text to copy it.");
    }
  };

  return <div className="flex min-w-0 items-start justify-end gap-2">
    <span className="min-w-0 select-text break-all font-mono text-xs leading-6 text-slate-200 sm:text-[13px]">{value}</span>
    <button type="button" onClick={() => void copy()} aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`} title={copied ? "Copied" : `Copy ${label.toLowerCase()}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/[0.06] hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
      {copied ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-4 text-emerald-300"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="size-4"><rect x="8" y="8" width="12" height="12" rx="3"/><path strokeLinecap="round" d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>}
    </button>
    <span role="status" className="sr-only">{copied ? `${label} copied` : error}</span>
  </div>;
}

function WithdrawalDetails({ record, onClose }: { record: WithdrawalRecord; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyPosition = document.body.style.position;
    const bodyTop = document.body.style.top;
    const bodyWidth = document.body.style.width;
    const scrollY = window.scrollY;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
      document.body.style.position = bodyPosition;
      document.body.style.top = bodyTop;
      document.body.style.width = bodyWidth;
      window.scrollTo({ top: scrollY, behavior: "instant" });
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[calc(100dvh-max(12px,env(safe-area-inset-top)))] w-full max-w-none overflow-hidden rounded-t-[1.75rem] border border-white/[0.1] bg-[#0d1a2c] p-0 text-white shadow-[0_30px_100px_rgba(0,0,0,.65)] backdrop:bg-[#020711]/85 backdrop:backdrop-blur-md sm:inset-0 sm:m-auto sm:max-h-[90dvh] sm:max-w-xl sm:rounded-[1.75rem]">
    <div className="flex max-h-[calc(100dvh-max(12px,env(safe-area-inset-top)))] min-h-0 flex-col bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.08),transparent_48%),linear-gradient(160deg,#132438,#0b192b)] sm:max-h-[90dvh]">
      <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-slate-600/60 sm:hidden" />
      <header className="relative flex min-h-[68px] shrink-0 items-center justify-center border-b border-white/[0.06] px-16 py-4 sm:min-h-[76px] sm:py-5">
        <h2 id={titleId} className="text-sm font-semibold tracking-tight sm:text-base">Withdrawal details</h2>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close withdrawal details" className="absolute right-4 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/[0.07] bg-white/[0.05] text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="size-5"><path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="scrollbar-hide min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7">
        <div className="flex items-center gap-3.5 py-6 sm:gap-4 sm:py-7">
          <span className="rounded-full bg-white/[0.035] p-1.5 ring-1 ring-white/[0.06]"><CryptoAssetIcon symbol={record.asset} className="size-12 shrink-0 sm:size-14" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[.14em] text-slate-500">Withdrawal amount</p>
            <p className="mt-1.5 break-words text-[22px] font-semibold leading-tight tracking-tight text-white [overflow-wrap:anywhere] sm:text-[28px]">{formatAmount(record)}</p>
            {hasCryptoAmount(record) ? <p className="mt-1.5 text-sm font-medium tabular-nums text-slate-400">{formatFiat(record)} <span className="ml-1 text-[11px] text-slate-500">{record.currency}</span></p> : null}
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#061323]/40 px-3.5 py-3 sm:px-4">
          <span className="text-xs font-medium text-slate-400">Current status</span><WithdrawalStatus status={record.status} />
        </div>
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">Full recorded details for this withdrawal</caption>
          <tbody className="divide-y divide-white/[0.07]">
            <tr><th scope="row" className="w-[31%] py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Date</th><td className="py-4 text-right text-xs leading-6 text-slate-200 sm:text-sm"><time dateTime={record.createdAtISO}>{formatDate(record.createdAtISO, true)}</time></td></tr>
            <tr><th scope="row" className="py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Asset</th><td className="py-4"><span className="flex items-center justify-end gap-2"><CryptoAssetIcon symbol={record.asset} className="size-6 shrink-0" /><span className="text-right text-xs leading-6 text-slate-200 sm:text-sm">{getCryptoAssetName(record.asset)}{record.asset ? <span className="ml-1.5 text-slate-500">{record.asset}</span> : null}</span></span></td></tr>
            <tr><th scope="row" className="py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Crypto quantity</th><td className="break-words py-4 text-right text-xs leading-6 text-slate-200 [overflow-wrap:anywhere] sm:text-sm">{hasCryptoAmount(record) ? formatAmount(record) : "Not provided"}</td></tr>
            <tr><th scope="row" className="py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Fiat amount</th><td className="py-4 text-right text-xs leading-6 text-slate-200 sm:text-sm">{formatFiat(record)} <span className="text-slate-500">{record.currency}</span></td></tr>
            <tr><th scope="row" className="py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Recipient wallet</th><td className="py-4">{record.walletAddress ? <CopyValue value={record.walletAddress} label="Wallet address" /> : <span className="block text-right text-xs leading-6 text-slate-500">Not provided</span>}</td></tr>
            <tr><th scope="row" className="py-4 pr-3 text-left align-top text-xs font-medium leading-6 text-slate-400">Record ID</th><td className="py-4"><CopyValue value={record.id} label="Record ID" /></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </dialog>;
}

export default function WithdrawalRecords({ records, loading, error }: { records: WithdrawalRecord[]; loading: boolean; error: string }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeDetails = useCallback(() => setSelectedId(null), []);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = records.filter((record) => `${record.reference} ${record.asset ?? ""} ${record.walletAddress ?? ""} ${record.status}`.toLowerCase().includes(query));
    matches.sort((a, b) => (Date.parse(b.createdAtISO) || 0) - (Date.parse(a.createdAtISO) || 0) || a.id.localeCompare(b.id));
    return matches;
  }, [records, search]);

  return <>
    <section aria-labelledby="withdrawal-records-heading" className="overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(145deg,#0c1e31,#071424)] shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-5">
        <div>
          <div className="flex items-center gap-2.5"><h2 id="withdrawal-records-heading" className="text-base font-semibold text-white sm:text-lg">Withdrawal records</h2><span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-400">{records.length}</span></div>
          <p className="mt-1 text-xs leading-5 text-slate-400">Select a withdrawal to view its full details.</p>
        </div>
        <div className="relative w-full sm:max-w-[280px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"><circle cx="10.5" cy="10.5" r="6.5"/><path strokeLinecap="round" d="m16 16 4 4"/></svg>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search withdrawal records" placeholder="Search asset, reference, status…" className="min-h-11 w-full rounded-xl border border-white/[0.08] bg-[#04101e]/65 py-2.5 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10" />
        </div>
      </header>
      <div tabIndex={0} role="region" aria-label="Withdrawal records, scroll to view more" className="scrollbar-hide h-[27.5rem] overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:h-[30rem]">
        {loading ? <div className="grid h-full place-items-center px-5"><p role="status" className="text-center text-sm text-slate-400">Loading your withdrawal records…</p></div> : error ? <div className="grid h-full place-items-center px-5"><p role="alert" className="text-center text-sm text-rose-300">{error}</p></div> : filteredRecords.length === 0 ? <div className="flex h-full flex-col items-center justify-center px-5 text-center"><p className="text-sm font-medium text-slate-200">{search ? "No matching withdrawals" : "No withdrawals yet"}</p><p className="mt-1 text-xs text-slate-500">{search ? "Try a different asset, reference, or status." : "Your withdrawal activity will appear here."}</p></div> : (
          <ul className="min-h-full px-4 sm:px-6">
            {filteredRecords.map((record) => <li key={record.id} className="h-[5.5rem] border-b border-white/[0.075] sm:h-24">
              <button type="button" onClick={() => setSelectedId(record.id)} aria-haspopup="dialog" aria-label={`View ${record.asset ?? record.currency} withdrawal details, ${formatAmount(record)}, ${record.status}, ${formatDate(record.createdAtISO)}`} className="group grid h-full w-full grid-cols-[40px_minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2.5 rounded-lg text-left transition hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/60 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                <span className="relative"><CryptoAssetIcon symbol={record.asset} className="size-10 sm:size-11" /><span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full border-2 border-[#0a192b] bg-[#26384c] text-slate-200"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12 12 4M4 4h8v8" /></svg></span></span>
                <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-white sm:text-sm">{getCryptoAssetName(record.asset)}</span><span className="mt-1 block truncate font-mono text-[10px] text-slate-500 sm:text-[11px]" title={record.walletAddress || record.reference}>{shorten(record.walletAddress || record.reference)}</span><time dateTime={record.createdAtISO} className="mt-1 block truncate text-[10px] text-slate-500">{formatDate(record.createdAtISO)}</time></span>
                <span className="min-w-0 text-right"><span className="block truncate text-[13px] font-semibold leading-5 tabular-nums tracking-tight text-slate-100 sm:text-sm" title={formatAmount(record)}>{formatAmount(record)}</span>{hasCryptoAmount(record) ? <span className="mt-0.5 block truncate text-[10px] tabular-nums text-slate-500 sm:text-[11px]">{formatFiat(record)}</span> : null}<span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium ${statusTones[record.status].split(" ")[0]}`}><span aria-hidden="true" className="size-1 rounded-full bg-current"/>{record.status}</span></span>
              </button>
            </li>)}
          </ul>
        )}
      </div>
    </section>
    {selected ? <WithdrawalDetails key={selected.id} record={selected} onClose={closeDetails} /> : null}
  </>;
}
