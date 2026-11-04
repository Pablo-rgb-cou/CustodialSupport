"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { create as createQrCode } from "qrcode";
import CryptoAssetIcon from "./CryptoAssetIcon";
import { CopyValue } from "./WithdrawalRecords";

const tokens = ["BTC", "ETH", "USDT", "USDC", "BNB", "XRP", "SOL", "ADA", "DOGE", "TRX"];
const speeds = [
  { name: "Slow", detail: "Lower-priority demo option", amount: 1 },
  { name: "Medium", detail: "Balanced demo option", amount: 2 },
  { name: "Fast", detail: "Higher-priority demo option", amount: 3 },
] as const;
type Stage = "speed" | "token" | "scan" | "pending" | "approved";

// Deliberately not a valid address or payment URI on any supported network.
function demoAddress(token: string) { return `DEMO-ONLY-${token}-NOT-A-WALLET-00000000`; }

function DemoQr({ token }: { token: string }) {
  const titleId = useId();
  const qr = useMemo(() => createQrCode(`CustodialSupport DEMO ONLY; NO PAYMENT; ${demoAddress(token)}`, { errorCorrectionLevel: "M" }), [token]);
  const size = qr.modules.size;
  const path = Array.from(qr.modules.data).flatMap((dark, index) => dark ? [`M${index % size + 4} ${Math.floor(index / size) + 4}h1v1h-1z`] : []).join("");
  return <svg role="img" aria-labelledby={titleId} viewBox={`0 0 ${size + 8} ${size + 8}`} className="mx-auto size-44 rounded-xl bg-white p-1" shapeRendering="crispEdges"><title id={titleId}>Scannable demo text for {token}; no payment destination</title><rect width={size + 8} height={size + 8} fill="white" /><path d={path} fill="#081a2a" /></svg>;
}

export default function WithdrawalFeeDemo() {
  const [enabled, setEnabled] = useState(["BTC", "ETH", "USDT", "USDC", "BNB"]);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("speed");
  const [speed, setSpeed] = useState(1);
  const [token, setToken] = useState("BTC");
  const [transactionToken, setTransactionToken] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      document.body.style.overflow = bodyOverflow;
      if (focus?.isConnected) focus.focus({ preventScroll: true });
    };
  }, [open]);

  const button = "rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-40";
  return <section className="rounded-2xl border border-dashed border-cyan-200/20 bg-[#081a2a] p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Admin preview · Demo only</p><h3 className="mt-2 text-lg font-semibold text-white">Withdrawal fee flow</h3><p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">Select up to five tokens to preview. No funds are requested, no withdrawal is changed, and nothing is saved.</p></div><button type="button" disabled={!enabled.length} className={button} onClick={() => { setStage("speed"); setToken(enabled[0]); setTransactionToken(""); setOpen(true); }}>Open demo ↗</button></div>
    <fieldset className="mt-5"><legend className="text-xs text-slate-400">Demo tokens ({enabled.length}/5)</legend><div className="mt-3 flex flex-wrap gap-2">{tokens.map((symbol) => <label key={symbol} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${enabled.includes(symbol) ? "border-cyan-200/25 bg-cyan-200/[0.06] text-cyan-100" : "border-white/10 text-slate-400"}`}><input type="checkbox" checked={enabled.includes(symbol)} disabled={enabled.length === 5 && !enabled.includes(symbol)} onChange={() => setEnabled((current) => current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol])} className="accent-cyan-300" /><CryptoAssetIcon symbol={symbol} className="size-5" />{symbol}</label>)}</div></fieldset>
    {open ? <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); setOpen(false); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#081a2a] p-0 text-white shadow-2xl backdrop:bg-[#020711]/85 backdrop:backdrop-blur-md">
      <div className="flex max-h-[90dvh] flex-col"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Demo — no payment</p><h2 id={titleId} className="mt-2 text-xl font-semibold">{stage === "speed" ? "Choose a demo priority" : stage === "token" ? "Select a demo token" : stage === "scan" ? "Scan the demo code" : stage === "pending" ? "Demo submission pending" : "Demo approved"}</h2></div><button type="button" aria-label="Close fee demo" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5" onClick={() => setOpen(false)}>×</button></header>
        <div className="scrollbar-hide min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <p className="mb-5 rounded-xl border border-amber-300/15 bg-amber-300/5 p-3 text-xs leading-5 text-amber-200">Interface simulation only. These addresses cannot receive funds. The QR contains plain demo text. Priority choices do not accelerate a blockchain transaction.</p>
          {stage === "speed" ? <><label className="block text-xs text-slate-400">Demo transaction token (optional)<input value={transactionToken} maxLength={80} onChange={(event) => setTransactionToken(event.target.value)} placeholder="Example: DEMO-TRANSACTION-001" className="mt-2 w-full rounded-xl border border-white/10 bg-[#04101d] px-3 py-3 text-sm text-white outline-none focus:border-cyan-300/40" /></label><div className="mt-5 space-y-2" role="radiogroup" aria-label="Demo priority">{speeds.map((option, index) => <label key={option.name} className={`flex items-center gap-3 rounded-xl border p-4 ${speed === index ? "border-cyan-200/30 bg-cyan-200/5" : "border-white/10"}`}><input type="radio" name="demo-priority" checked={speed === index} onChange={() => setSpeed(index)} className="accent-cyan-300" /><span className="flex-1"><span className="block text-sm font-semibold">{option.name}</span><span className="mt-1 block text-xs text-slate-500">{option.detail}</span></span><span className="text-xs text-cyan-200">{option.amount} demo credits</span></label>)}</div><button type="button" className={`${button} mt-5 w-full`} onClick={() => setStage("token")}>Continue demo →</button></> : null}
          {stage === "token" ? <><p className="mb-4 text-xs text-slate-400">{speeds[speed].name} priority · {speeds[speed].amount} fictional credits (no monetary value)</p><div className="grid grid-cols-2 gap-3">{enabled.map((symbol) => <button type="button" key={symbol} onClick={() => { setToken(symbol); setStage("scan"); }} className={`${button} flex items-center gap-3`}><CryptoAssetIcon symbol={symbol} className="size-7" />{symbol}</button>)}</div><button type="button" className="mt-5 text-xs text-slate-400" onClick={() => setStage("speed")}>← Back to priority</button></> : null}
          {stage === "scan" ? <><DemoQr token={token} /><p className="mt-3 text-center text-xs text-slate-400">Scan test · {token} · No payment URI</p><div className="mt-5 rounded-xl border border-white/10 bg-[#04101d] p-4"><p className="mb-2 text-xs text-slate-500">Fictional demo address</p><CopyValue value={demoAddress(token)} label="Demo address" /></div><button type="button" className={`${button} mt-5 w-full`} onClick={() => setStage("pending")}>Simulate payment submitted</button><button type="button" className="mt-4 text-xs text-slate-400" onClick={() => setStage("token")}>← Change token</button></> : null}
          {stage === "pending" || stage === "approved" ? <div role="status" className="py-5 text-center"><span className={`mx-auto grid size-16 place-items-center rounded-2xl border text-2xl ${stage === "pending" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"}`}>{stage === "pending" ? "◷" : "✓"}</span><p className="mt-5 font-semibold">{stage === "pending" ? "Awaiting simulated admin approval" : "Preview completed"}</p><p className="mt-2 text-xs leading-5 text-slate-400">{token} · {speeds[speed].name} priority{transactionToken ? ` · ${transactionToken}` : ""}<br />No payment was made and no account records were changed.</p>{stage === "pending" ? <button type="button" className={`${button} mt-5 w-full`} onClick={() => setStage("approved")}>Simulate admin approval</button> : <button type="button" className={`${button} mt-5 w-full`} onClick={() => setStage("speed")}>Restart demo</button>}</div> : null}
        </div>
      </div>
    </dialog> : null}
  </section>;
}
