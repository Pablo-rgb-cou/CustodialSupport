"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { CustomerEmailDraft } from "@/lib/customer-email-content";

type Client = { id: string; fullName: string; email: string; verified: boolean };
type Template = { id: string; name: string; subject: string; message: string };
type EmailJob = { id: string; kind: string; recipient_name: string; recipient_email: string; subject: string; status: string; created_at: string; submitted_at: string | null; error_code: string | null; attempts: number };
type Preview = { html: string; recipient: string; subject: string; draft: CustomerEmailDraft };
const emptyDraft: CustomerEmailDraft = { clientId: null, recipientName: "", recipientEmail: "", subject: "", message: "" };
const field = "w-full min-w-0 rounded-xl border border-white/10 bg-[#04101d] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/60 disabled:opacity-60";
const button = "rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-40 disabled:cursor-not-allowed";
const panel = "rounded-3xl border border-white/10 bg-[#0a1b2a]";
const statusLabel: Record<string, string> = { queued: "Waiting to send", processing: "Sending", submitted: "Sent to mail server", failed: "Failed", uncertain: "Needs review" };
const errorLabel: Record<string, string> = { SMTP_AUTH: "Mailbox authentication failed", SMTP_TIMEOUT: "SMTP timed out", SMTP_CONNECT: "Could not connect to SMTP", SMTP_REJECTED: "SMTP rejected the submission", SMTP_SEND: "Submission could not be confirmed", LEASE_EXPIRED: "Worker interrupted; check mailbox logs before resending", INVALID_JOB: "Invalid queued message" };

async function emailApi(path = "", body?: object, signal?: AbortSignal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in as an administrator to manage emails.");
  const response = await fetch(`/api/admin/emails${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Email service is unavailable.");
  return result;
}

export default function AdminEmailsPage() {
  const [tab, setTab] = useState("compose");
  const [mode, setMode] = useState("client");
  const [draft, setDraft] = useState<CustomerEmailDraft>(emptyDraft);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clientPage, setClientPage] = useState(0);
  const [clientRefresh, setClientRefresh] = useState(0);
  const [moreClients, setMoreClients] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [messages, setMessages] = useState<EmailJob[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [moreHistory, setMoreHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const requestKey = useRef<{ fingerprint: string; id: string } | null>(null);

  const loadTemplates = useCallback(async () => {
    const result = await emailApi("?view=templates");
    setTemplates(result.templates || []);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    emailApi(`?view=clients&page=${clientPage}&q=${encodeURIComponent(clientQuery)}`, undefined, controller.signal).then((result) => { setClients(result.clients); setMoreClients(result.hasMore); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setClientsLoading(false); });
    return () => controller.abort();
  }, [clientPage, clientQuery, clientRefresh]);
  useEffect(() => { let active = true; emailApi("?view=templates").then((result) => { if (active) setTemplates(result.templates || []); }).catch((e) => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => emailApi(`?page=${historyPage}`, undefined, controller.signal).then((result) => { setMessages(result.messages || []); setMoreHistory(result.hasMore); setEnabled(result.sendingEnabled); }).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    void load();
    const timer = tab === "history" ? window.setInterval(() => { void load(); }, 15000) : undefined;
    return () => { controller.abort(); if (timer) window.clearInterval(timer); };
  }, [historyPage, tab]);
  useEffect(() => {
    if (!preview) return;
    const trigger = previewTrigger.current;
    const previous = document.body.style.overflow;
    const previousRoot = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending.current) setPreview(null);
      if (event.key === "Tab") {
        const controls = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-email-preview] button:not(:disabled)"));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; document.documentElement.style.overflow = previousRoot; document.removeEventListener("keydown", keydown); trigger?.focus(); };
  }, [preview]);

  function updateDraft(patch: Partial<CustomerEmailDraft>) { setDraft((current) => ({ ...current, ...patch })); setNotice(""); }
  async function previewEmail(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true); setNotice("");
    try { const result = await emailApi("", { action: "preview", ...draft }); setPreview({ ...result, draft: { ...draft } }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function sendEmail() {
    if (!preview || sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(preview.draft))))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data: { session } } = await supabase.auth.getSession();
      const storageKey = `customer-email-request:${session?.user.id}`;
      let stored = requestKey.current;
      try { stored = JSON.parse(sessionStorage.getItem(storageKey) || "null") || stored; } catch { /* Memory key still protects retry in this tab. */ }
      const id = stored?.fingerprint === fingerprint ? stored.id : crypto.randomUUID();
      requestKey.current = { fingerprint, id };
      try { sessionStorage.setItem(storageKey, JSON.stringify(requestKey.current)); } catch { /* Storage can be disabled. */ }
      await emailApi("", { action: "send", ...preview.draft, requestId: id });
      // A confirmed receipt ends this operation. A later intentional message
      // gets a fresh key; the DB still blocks identical ten-minute duplicates.
      requestKey.current = null;
      try { sessionStorage.removeItem(storageKey); } catch { /* Storage can be disabled. */ }
      setPreview(null); setNotice("Email accepted for sending. A sending attempt starts now; check History for the result. Duplicate requests do not create another copy."); setDraft(emptyDraft); setTab("history");
    } catch (e) { setError((e as Error).message); } finally { sending.current = false; setBusy(false); }
  }
  async function saveTemplate() {
    setBusy(true); setError(""); setNotice("");
    try { await emailApi("", { action: "save-template", name: templateName, subject: draft.subject, message: draft.message }); await loadTemplates(); setTemplateName(""); setNotice("Template saved. Recipient details are never saved in templates."); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function deleteTemplate(id: string) {
    if (!window.confirm("Delete this saved template? Previously queued emails will remain in History.")) return;
    setBusy(true); setError("");
    try { await emailApi("", { action: "delete-template", id }); await loadTemplates(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-7xl space-y-6 text-slate-100">
    <section className={`${panel} bg-linear-to-br from-cyan-950/40 to-[#0a1b2a] p-5 sm:p-7`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Client communication</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-bold sm:text-3xl">Emails</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Personal messages, reusable templates, and a clear record of every submission.</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3"><p className="text-[10px] uppercase tracking-widest text-emerald-200">Official sender</p><p className="mt-1 break-all text-sm">support@custodialmanagement.net</p></div></div>
    </section>
    <nav aria-label="Email management" className="flex flex-wrap gap-2">{["compose", "templates", "history"].map((value) => <button key={value} type="button" aria-current={tab === value ? "page" : undefined} onClick={() => setTab(value)} className={`${button} capitalize ${tab === value ? "border-cyan-300/50 bg-cyan-300/15" : ""}`}>{value}</button>)}</nav>
    {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-200">{notice}</p>}
    {!enabled && <p className="text-sm text-amber-200">Sending is disabled until the database migration and server configuration are approved and enabled.</p>}
    {tab === "compose" && <section className={`${panel} p-5 sm:p-7`}>
      <h2 className="text-lg font-semibold">Compose an email</h2><p className="mt-1 text-sm text-slate-400">Choose one recipient. Your message is safely formatted inside the CustodialSupport email design.</p>
      <div className="my-5 flex gap-2">{["client", "external"].map((value) => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { setMode(value); updateDraft({ clientId: null, recipientEmail: "", recipientName: "" }); }} className={`${button} ${mode === value ? "bg-cyan-300/15" : ""}`}>{value === "client" ? "Registered client" : "External recipient"}</button>)}</div>
      {mode === "client" && <div className="mb-5 space-y-3 rounded-2xl border border-white/5 p-4"><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setClientsLoading(true); setClientPage(0); setClientQuery(search); setClientRefresh((value) => value + 1); }}><input aria-label="Search registered clients by name" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clients by name…" className={field} maxLength={100}/><button className={button} type="submit">Search</button></form><label className="block text-sm text-slate-300">Client<select value={draft.clientId || ""} disabled={clientsLoading} onChange={(event) => { const client = clients.find((item) => item.id === event.target.value); updateDraft({ clientId: client?.id || null, recipientName: client?.fullName || "", recipientEmail: client?.email || "" }); }} className={`${field} mt-2`}><option value="">{clientsLoading ? "Loading clients…" : "Select a client"}</option>{draft.clientId && !clients.some((client) => client.id === draft.clientId) && <option value={draft.clientId}>{draft.recipientName} — {draft.recipientEmail} (selected)</option>}{clients.map((client) => <option key={client.id} value={client.id} disabled={!client.email}>{client.fullName} — {client.email}{client.verified ? "" : " (unverified)"}</option>)}</select></label><div className="flex items-center justify-between gap-3 text-xs text-slate-400"><span>Page {clientPage + 1} · {clients.length} clients</span><div className="flex gap-2"><button type="button" className={button} disabled={!clientPage || clientsLoading} onClick={() => { setClientsLoading(true); setClientPage((p) => p - 1); }}>Previous</button><button type="button" className={button} disabled={!moreClients || clientsLoading} onClick={() => { setClientsLoading(true); setClientPage((p) => p + 1); }}>Next</button></div></div></div>}
      <form onSubmit={previewEmail} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm text-slate-300">Recipient name <span className="text-slate-500">(optional)</span><input value={draft.recipientName} maxLength={100} onChange={(event) => updateDraft({ recipientName: event.target.value })} className={`${field} mt-2`} autoComplete="off"/></label><label className="block text-sm text-slate-300">Recipient email<input type="email" required maxLength={254} readOnly={mode === "client"} value={draft.recipientEmail} onChange={(event) => updateDraft({ recipientEmail: event.target.value })} className={`${field} mt-2`} placeholder="recipient@example.com" autoComplete="off"/></label></div>
        <label className="block text-sm text-slate-300">Subject<input required maxLength={160} value={draft.subject} onChange={(event) => updateDraft({ subject: event.target.value })} className={`${field} mt-2`}/></label>
        <label className="block text-sm text-slate-300">Message<textarea required rows={10} maxLength={12000} value={draft.message} onChange={(event) => updateDraft({ message: event.target.value })} className={`${field} mt-2 resize-y leading-7`} placeholder="Write your message. The greeting and signature are added automatically."/><span className="mt-1 block text-right text-xs text-slate-500">{draft.message.length.toLocaleString()} / 12,000</span></label>
        <button ref={previewTrigger} disabled={busy || (mode === "client" && !draft.clientId)} type="submit" className="rounded-xl bg-linear-to-r from-cyan-300 to-emerald-300 px-6 py-3 text-sm font-semibold text-[#04101d] disabled:opacity-40">{busy ? "Preparing…" : "Preview email"}</button>
      </form>
      <div className="mt-7 border-t border-white/10 pt-5"><h3 className="text-sm font-semibold">Save this message as a template</h3><div className="mt-3 flex flex-col gap-3 sm:flex-row"><input aria-label="Template name" maxLength={80} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className={field}/><button type="button" disabled={busy || !templateName.trim() || !draft.subject.trim() || !draft.message.trim()} onClick={saveTemplate} className={`${button} shrink-0`}>Save template</button></div></div>
    </section>}
    {tab === "templates" && <section className={`${panel} p-5 sm:p-7`}><h2 className="text-lg font-semibold">Saved templates</h2><p className="mt-1 text-sm text-slate-400">Apply a saved subject and message, then choose a recipient and preview.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{templates.map((item) => <article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-[#061321] p-5"><h3 className="break-words font-semibold">{item.name}</h3><p className="mt-2 break-words text-sm text-cyan-200">{item.subject}</p><p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">{item.message}</p><div className="mt-5 flex gap-3"><button type="button" className={button} onClick={() => { updateDraft({ subject: item.subject, message: item.message }); setTab("compose"); }}>Use template</button><button type="button" disabled={busy} className="px-3 text-sm text-rose-200" onClick={() => deleteTemplate(item.id)}>Delete</button></div></article>)}</div>{!templates.length && <p className="py-10 text-sm text-slate-400">No templates saved yet. Save a subject and message from Compose.</p>}</section>}
    {tab === "history" && <section className={`${panel} overflow-hidden`}><div className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Email history</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Sent to mail server means the SMTP server accepted the email; it does not confirm inbox delivery. Uncertain submissions require a mailbox-log review before resending. History refreshes every 15 seconds.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-white/10 bg-white/2 text-xs uppercase tracking-wider text-slate-400"><tr>{["Recipient", "Subject", "Created", "Submission", "Details"].map((label) => <th key={label} className="px-5 py-4 font-medium">{label}</th>)}</tr></thead><tbody>{messages.map((item) => <tr key={item.id} className="border-b border-white/5 align-top"><td className="max-w-64 px-5 py-5"><p className="break-words font-medium">{item.recipient_name || "Recipient"}</p><p className="mt-1 break-all text-xs text-slate-400">{item.recipient_email}</p></td><td className="max-w-72 break-words px-5 py-5"><p>{item.subject}</p><p className="mt-1 text-xs text-slate-500">{item.kind === "registration" ? "Verified registration" : "Admin email"}</p></td><td className="px-5 py-5 text-xs text-slate-400"><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></td><td className="px-5 py-5"><span className={`inline-block rounded-full border px-3 py-1 text-xs ${item.status === "submitted" ? "border-emerald-300/20 text-emerald-200" : ["failed", "uncertain"].includes(item.status) ? "border-amber-300/20 text-amber-200" : "border-cyan-300/20 text-cyan-200"}`}>{statusLabel[item.status] || item.status}</span></td><td className="max-w-64 px-5 py-5 text-xs leading-5 text-slate-400">{item.error_code ? errorLabel[item.error_code] || "Submission error" : item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "Awaiting submission"}<p className="mt-1 text-slate-500">{item.attempts} attempts</p></td></tr>)}</tbody></table></div>{!messages.length && <p className="p-7 text-sm text-slate-400">{historyLoading ? "Loading history…" : "No email submissions yet."}</p>}<div className="flex items-center justify-between gap-3 p-5 text-sm text-slate-400"><span>Page {historyPage + 1}</span><div className="flex gap-2"><button type="button" className={button} disabled={!historyPage} onClick={() => { setHistoryLoading(true); setHistoryPage((p) => p - 1); }}>Previous</button><button type="button" className={button} disabled={!moreHistory} onClick={() => { setHistoryLoading(true); setHistoryPage((p) => p + 1); }}>Next</button></div></div></section>}
    {preview && <div data-email-preview role="dialog" aria-modal="true" aria-labelledby="email-preview-title" className="fixed inset-0 z-[200] flex items-center justify-center bg-[#020811]/90 p-3 backdrop-blur-md sm:p-6"><div className="flex h-[90dvh] max-h-[900px] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a1b2a]"><div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5"><div className="min-w-0"><h2 id="email-preview-title" className="text-lg font-semibold">Email preview</h2><p className="mt-2 break-all text-xs text-slate-400">To: {preview.recipient}</p><p className="mt-1 break-words text-sm text-cyan-100">{preview.subject}</p></div><button ref={closeRef} type="button" aria-label="Close email preview" disabled={busy} className={button} onClick={() => setPreview(null)}>×</button></div><iframe title="Branded customer email preview" sandbox="" tabIndex={-1} srcDoc={preview.html} className="min-h-0 w-full flex-1 bg-[#061321]"/><div className="shrink-0 border-t border-white/10 p-5">{error && <p role="alert" className="mb-3 text-sm text-rose-200">{error}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">One recipient · Sent from the official support mailbox</p><button type="button" disabled={busy || !enabled} onClick={sendEmail} className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#04101d] disabled:opacity-40">{busy ? "Submitting…" : "Send email"}</button></div></div></div></div>}
  </div>;
}
