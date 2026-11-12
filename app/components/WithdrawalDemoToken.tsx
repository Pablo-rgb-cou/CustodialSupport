"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { copyText } from "../../lib/copy-text";

// Keep the stored hash format compatible with previously issued codes.
const displayCode = (value: string) => value.replace(/^DEMO-/i, "");
const completeCode = (value: string) => value.trim().length >= (value.trim().toUpperCase().startsWith("DEMO-") ? 37 : 32);

type DemoState = { generation: string; enabled: boolean; consumed_at: string | null; expires_at: string | null; auto_advance?: boolean; demo_status?: string | null };
const statusLabels = { pending: "Pending", processing: "Processing", completed: "Completed", failed: "Failed", cancelled: "Cancelled" } as const;
const statusBarTones: Record<string, string> = {
  pending: "border-amber-300/30 from-amber-300/15 via-amber-200/5 to-amber-300/10 text-amber-100 shadow-[0_0_18px_rgba(252,211,77,0.10),inset_0_1px_0_rgba(252,211,77,0.12)]",
  processing: "border-sky-300/35 from-sky-300/15 via-cyan-200/5 to-blue-300/10 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.13),inset_0_1px_0_rgba(125,211,252,0.15)]",
  completed: "border-emerald-300/35 from-emerald-300/15 via-teal-200/5 to-emerald-300/10 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.13),inset_0_1px_0_rgba(110,231,183,0.15)]",
  failed: "border-rose-300/30 from-rose-300/15 via-rose-200/5 to-rose-300/10 text-rose-100 shadow-[0_0_18px_rgba(251,113,133,0.10)]",
  cancelled: "border-slate-300/20 from-slate-300/10 via-slate-200/5 to-slate-300/5 text-slate-200 shadow-[0_0_14px_rgba(148,163,184,0.06)]",
};
export type WithdrawalPreviewState = { active: boolean; status: typeof statusLabels[keyof typeof statusLabels] | null };

export default function WithdrawalDemoToken({ withdrawalId, admin = false, showNotice = true, onPreviewChange }: { withdrawalId: string; admin?: boolean; showNotice?: boolean; onPreviewChange?: (value: WithdrawalPreviewState) => void }) {
  const inputId = useId();
  const [state, setState] = useState<DemoState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [issuedCode, setIssuedCode] = useState<{ code: string; generation: string } | null>(null);
  const [completed, setCompleted] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");
  const mounted = useRef(false);
  const checking = useRef(false);
  const attempted = useRef("");
  const generationRef = useRef(state?.generation);
  useEffect(() => { generationRef.current = state?.generation; }, [state?.generation]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    const result = await supabase.from("withdrawal_demo_tokens").select("*").eq("withdrawal_id", withdrawalId).maybeSingle();
    return result;
  }, [withdrawalId]);

  useEffect(() => {
    let active = true;
    let request = 0;
    async function refresh() {
      const current = ++request;
      try {
        const { data, error } = await load();
        if (!active || current !== request) return;
        setLoading(false); setUnavailable(Boolean(error));
        // Hide stale entry forms if authorization or configuration becomes unavailable.
        setState(error ? null : data as DemoState | null);
      } catch {
        if (!active || current !== request) return;
        setLoading(false); setUnavailable(true); setState(null);
      }
    }
    void refresh();
    const channel = supabase.channel(`withdrawal-demo:${withdrawalId}:${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_demo_tokens", filter: `withdrawal_id=eq.${withdrawalId}` }, () => { void refresh(); })
      .subscribe(status => { if (status === "SUBSCRIBED") void refresh(); });
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("online", visible); document.addEventListener("visibilitychange", visible);
    return () => { active = false; void supabase.removeChannel(channel); window.removeEventListener("online", visible); document.removeEventListener("visibilitychange", visible); };
  }, [load, withdrawalId]);

  async function configure(enabled: boolean) {
    if (busy) return;
    setBusy(true); setError(""); setIssuedCode(null);
    try {
      const { data, error } = await supabase.rpc("configure_withdrawal_demo_token", { p_withdrawal_id: withdrawalId, p_enabled: enabled });
      if (error) throw error;
      setIssuedCode(enabled ? data : null);
      const result = await load(); setState(result.data as DemoState | null); setUnavailable(Boolean(result.error));
    } catch { setError("Could not update the demo code. Check your administrator access and try again."); }
    finally { setBusy(false); }
  }
  const enabled = state?.enabled;
  const generation = state?.generation;
  const verify = useCallback(async () => {
    const entered = code.trim().toUpperCase();
    const value = entered.startsWith("DEMO-") ? entered : "DEMO-" + entered;
    const key = generation + ":" + value;
    if (!enabled || !generation || checking.current || !completeCode(code) || attempted.current === key) return;
    attempted.current = key;
    checking.current = true;
    setBusy(true); setError("");
    try {
      const { data, error } = await supabase.rpc("verify_withdrawal_demo_token", { p_withdrawal_id: withdrawalId, p_generation: generation, p_code: value });
      if (!mounted.current || generationRef.current !== generation) return;
      if (error) throw error;
      if (data?.status === "success") {
        setCompleted(generation); setSuccessVisible(true);
        // Consumption is authoritative even if the following refresh is delayed.
        setState(current => current?.generation === generation ? { ...current, enabled: false, demo_status: data.demo_status ?? current.demo_status } : current);
      } else setError(data?.status === "incorrect" ? "Incorrect token code" : "This code is inactive, expired, or locked. Ask support for a new demo code.");
    } catch {
      if (mounted.current && generationRef.current === generation) setError("Could not check the code. Clear and re-enter it to retry.");
    } finally {
      checking.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [code, enabled, generation, withdrawalId]);
  useEffect(() => {
    if (admin || !enabled || completed === generation || !completeCode(code)) return;
    const timer = setTimeout(() => { void verify(); }, 500);
    return () => clearTimeout(timer);
  }, [admin, code, completed, enabled, generation, verify]);
  useEffect(() => {
    if (!successVisible) return;
    const timer = setTimeout(() => { setSuccessVisible(false); setCode(""); }, 1200);
    return () => clearTimeout(timer);
  }, [successVisible]);
  const button = "rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-50";
  async function copyIssuedCode(value: string) {
    setError("");
    try {
      await copyText(displayCode(value));
      if (mounted.current) setCopiedCode(value);
    } catch {
      if (mounted.current) setError("Copy unavailable. Select the displayed code and copy it manually.");
    }
  }
  useEffect(() => {
    if (!copiedCode) return;
    const timer = setTimeout(() => setCopiedCode(""), 1800);
    return () => clearTimeout(timer);
  }, [copiedCode]);
  async function toggleAutoAdvance(value: boolean) {
    if (busy) return;
    const previous = state?.auto_advance;
    setBusy(true); setError("");
    setState(current => current ? { ...current, auto_advance: value } : current);
    try {
      const { error } = await supabase.rpc("set_withdrawal_demo_auto_advance", { p_withdrawal_id: withdrawalId, p_enabled: value });
      if (error) throw error;
    } catch {
      setState(current => current ? { ...current, auto_advance: previous } : current);
      setError("Could not change automatic demo status. Please try again.");
    }
    finally { setBusy(false); }
  }
  const demoStatus = state?.demo_status;
  const previewStatus = demoStatus && Object.prototype.hasOwnProperty.call(statusLabels, demoStatus) ? statusLabels[demoStatus as keyof typeof statusLabels] : null;
  const showStatusBar = Boolean(previewStatus) && state?.auto_advance !== false;
  useEffect(() => {
    onPreviewChange?.({ active: !unavailable && Boolean(enabled || previewStatus), status: unavailable ? null : previewStatus });
  }, [enabled, previewStatus, unavailable, onPreviewChange]);
  const showEntry = !unavailable && (state?.enabled && completed !== generation || busy || successVisible);
  if (!admin && !showEntry && !showStatusBar && !error) return null;
  return <section aria-label={admin ? "Admin demo token controls" : "Demo token code"} className={admin ? "mt-4 min-w-56 rounded-xl border border-dashed border-cyan-200/20 bg-cyan-200/[0.03] p-4 text-left" : "mt-5 border-t border-white/[0.07] pt-4 text-left"}>
    {showNotice ? <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-amber-200">Demo preview</p> : null}
    {admin ? <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-100">Token Code</p>
      <label className="mt-3 flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={state?.enabled ?? false} disabled={busy || loading || unavailable} onChange={event => void configure(event.target.checked)} className="accent-cyan-300" />Enable code for this withdrawal</label>
      {typeof state?.auto_advance === "boolean" ? <label className="mt-3 flex items-center gap-2 text-xs text-slate-200"><input type="checkbox" checked={state.auto_advance} disabled={busy} onChange={event => void toggleAutoAdvance(event.target.checked)} className="accent-cyan-300" />Advance status automatically</label> : null}
      {state?.enabled ? <button type="button" disabled={busy} onClick={() => void configure(true)} className={`${button} mt-3`}>Generate a new code</button> : null}
      {state?.consumed_at ? <p className="mt-2 text-xs text-emerald-200">Token code accepted.</p> : null}
      {issuedCode && state?.enabled && issuedCode.generation === state.generation ? <div className="mt-3"><p className="text-xs text-slate-400">Shown once. Copy it and share with the selected client. Expires after 24 hours.</p><code className="mt-2 block select-all break-all text-xs text-cyan-100">{displayCode(issuedCode.code)}</code><button className={`${button} mt-2`} type="button" onClick={() => void copyIssuedCode(issuedCode.code)}><span role="status">{copiedCode === issuedCode.code ? "Copied ✓" : "Copy code"}</span></button></div> : null}
      {unavailable ? <p role="status" className="mt-2 text-xs text-amber-200">Demo controls unavailable. Apply the reviewed demo migration before enabling.</p> : null}
    </> : showEntry ? <form onSubmit={event => { event.preventDefault(); void verify(); }} className="space-y-3">
      <label htmlFor={inputId} className="block text-center text-sm font-medium text-slate-200">Enter token to complete transaction</label>
      <input id={inputId} value={code} onChange={event => { setCode(event.target.value); setError(""); attempted.current = ""; }} aria-invalid={Boolean(error)} aria-describedby={error || busy || successVisible ? inputId + "-status" : undefined} readOnly={successVisible} disabled={busy} maxLength={80} autoComplete="off" autoCapitalize="characters" spellCheck={false} required placeholder="*****" className={`h-12 w-full min-w-0 rounded-xl border px-3 text-center font-mono text-base outline-none transition placeholder:text-lg placeholder:tracking-[.35em] placeholder:text-slate-500 focus:ring-1 disabled:opacity-60 ${successVisible ? "border-emerald-300 bg-emerald-300/10 text-emerald-200" : error ? "border-rose-400 bg-rose-400/5 text-rose-200 focus:ring-rose-400/15" : "border-white/10 bg-[#06121f] text-slate-100 focus:border-cyan-300/50 focus:ring-cyan-300/10"}`} />
      {busy || successVisible ? <p id={inputId + "-status"} role="status" className={successVisible ? "text-center text-xs text-emerald-200" : "text-xs text-slate-400"}>{successVisible ? "Token code accepted" : "Checking…"}</p> : null}
    </form> : null}
    {showStatusBar ? <p role="status" className={`mt-4 flex min-h-11 items-center justify-center gap-2.5 rounded-xl border bg-gradient-to-r px-4 py-3 text-center text-xs font-semibold tracking-wide transition-colors duration-300 ${statusBarTones[demoStatus ?? ""] ?? statusBarTones.cancelled}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current shadow-[0_0_10px_currentColor]" />Status: <span>{previewStatus}</span></p> : null}
    {error ? <p id={inputId + "-status"} role="alert" className="mt-3 text-xs leading-5 text-rose-200">{error}</p> : null}
  </section>;
}
