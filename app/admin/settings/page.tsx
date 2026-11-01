"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Setting = { key: string; value: unknown; updated_at: string };
type Preferences = {
  supportEmail: string;
  supportHours: string;
  replyTargetHours: number;
  defaultPriority: string;
  waitingReminderHours: number;
  defaultNotificationType: string;
  notificationsEnabled: boolean;
  activityRotationSeconds: number;
};

const initial: Preferences = {
  supportEmail: "", supportHours: "Monday–Friday, 9:00 AM–5:00 PM",
  replyTargetHours: 24, defaultPriority: "normal", waitingReminderHours: 48,
  defaultNotificationType: "information", notificationsEnabled: true,
  activityRotationSeconds: 60,
};
const input = "mt-2 w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-300/50";
const card = "rounded-2xl border border-white/[.08] bg-[#081a2a] p-5 sm:p-6";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [prefs, setPrefs] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sign in again to continue."); setLoading(false); return; }
    const { data: me, error: roleError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (roleError || me?.role !== "admin") { setError("Administrator access is required."); setLoading(false); return; }
    const { data, error: dbError } = await supabase.from("admin_settings").select("key,value,updated_at").order("key");
    if (dbError) setError(`Could not load settings: ${dbError.message}`);
    else {
      const rows = (data ?? []) as Setting[];
      setSettings(rows);
      const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
      setPrefs({ ...initial,
        supportEmail: typeof values["support.contact"] === "string" ? values["support.contact"] : initial.supportEmail,
        supportHours: typeof values["support.hours"] === "string" ? values["support.hours"] : initial.supportHours,
        replyTargetHours: Number(values["support.reply_target_hours"] ?? initial.replyTargetHours),
        defaultPriority: typeof values["tickets.default_priority"] === "string" ? values["tickets.default_priority"] : initial.defaultPriority,
        waitingReminderHours: Number(values["tickets.waiting_reminder_hours"] ?? initial.waitingReminderHours),
        defaultNotificationType: typeof values["notifications.default_type"] === "string" ? values["notifications.default_type"] : initial.defaultNotificationType,
        notificationsEnabled: values["notifications.enabled"] !== false,
        activityRotationSeconds: Number(values["dashboard.activity_rotation_seconds"] ?? initial.activityRotationSeconds),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("admin-settings-live").on("postgres_changes", { event: "*", schema: "public", table: "admin_settings" }, () => void load()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) { setPrefs((old) => ({ ...old, [key]: value })); }

  async function save() {
    setError(""); setNotice(""); setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Your session has expired. Sign in again."); setSaving(false); return; }
    const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (me?.role !== "admin") { setError("Administrator access is required."); setSaving(false); return; }
    const entries: [string, unknown][] = [
      ["support.contact", prefs.supportEmail.trim()], ["support.hours", prefs.supportHours.trim()],
      ["support.reply_target_hours", prefs.replyTargetHours], ["tickets.default_priority", prefs.defaultPriority],
      ["tickets.waiting_reminder_hours", prefs.waitingReminderHours], ["notifications.default_type", prefs.defaultNotificationType],
      ["notifications.enabled", prefs.notificationsEnabled], ["dashboard.activity_rotation_seconds", prefs.activityRotationSeconds],
    ];
    const { error: dbError } = await supabase.from("admin_settings").upsert(entries.map(([key, value]) => ({ key, value, updated_by: user.id, updated_at: new Date().toISOString() })), { onConflict: "key" });
    if (dbError) setError(`Could not save settings: ${dbError.message}`);
    else { setNotice("Settings saved."); await load(); }
    setSaving(false);
  }

  const label = (title: string, description: string, control: React.ReactNode) => <label className="block text-sm text-slate-200">{title}<span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>{control}</label>;

  return <section className="space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">Configuration</p><h2 className="mt-2 text-2xl font-semibold text-white">Admin settings</h2><p className="mt-2 text-sm text-slate-400">Manage support, ticket, notification, and dashboard preferences. These values do not control payment processing.</p></header>
    {loading ? <div className={card}><p className="text-sm text-slate-400">Loading settings…</p></div> : <>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={card}><h3 className="text-lg font-semibold text-white">Support</h3><p className="mt-1 text-sm text-slate-400">Contact details and response expectations.</p><div className="mt-5 space-y-4">
          {label("Support email", "Address clients can use to contact support.", <input className={input} type="email" value={prefs.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} placeholder="support@example.com" />)}
          {label("Support hours", "Shown as an admin reference for service availability.", <input className={input} value={prefs.supportHours} onChange={(e) => set("supportHours", e.target.value)} />)}
          {label("Reply target (hours)", "Internal target for responding to new tickets.", <input className={input} type="number" min={1} max={720} value={prefs.replyTargetHours} onChange={(e) => set("replyTargetHours", Number(e.target.value))} />)}
        </div></section>
        <section className={card}><h3 className="text-lg font-semibold text-white">Tickets</h3><p className="mt-1 text-sm text-slate-400">Defaults used when staff manage incoming requests.</p><div className="mt-5 space-y-4">
          {label("Default priority", "Initial priority for new support tickets.", <select className={input} value={prefs.defaultPriority} onChange={(e) => set("defaultPriority", e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select>)}
          {label("Waiting reminder (hours)", "Suggested follow-up interval for tickets waiting on a client.", <input className={input} type="number" min={1} max={720} value={prefs.waitingReminderHours} onChange={(e) => set("waitingReminderHours", Number(e.target.value))} />)}
        </div></section>
        <section className={card}><h3 className="text-lg font-semibold text-white">Notifications</h3><p className="mt-1 text-sm text-slate-400">Set defaults for notifications created by admins.</p><div className="mt-5 space-y-4">
          {label("Default notification type", "Preselected type in the notification form.", <select className={input} value={prefs.defaultNotificationType} onChange={(e) => set("defaultNotificationType", e.target.value)}><option value="information">Information</option><option value="success">Success</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select>)}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[.07] p-4"><span><span className="block text-sm text-white">Notifications enabled</span><span className="mt-1 block text-xs text-slate-400">Allow admins to create client notifications.</span></span><input aria-label="Notifications enabled" type="checkbox" className="size-5 accent-cyan-300" checked={prefs.notificationsEnabled} onChange={(e) => set("notificationsEnabled", e.target.checked)} /></div>
        </div></section>
        <section className={card}><h3 className="text-lg font-semibold text-white">Dashboard</h3><p className="mt-1 text-sm text-slate-400">Control the pace of the activity display.</p><div className="mt-5">{label("Activity rotation (seconds)", "How long each activity view remains visible before changing.", <input className={input} type="number" min={10} max={600} value={prefs.activityRotationSeconds} onChange={(e) => set("activityRotationSeconds", Number(e.target.value))} />)}</div></section>
      </div>
      {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}
      <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{saving ? "Saving…" : "Save settings"}</button>
      <section className={card}><h3 className="font-semibold text-white">Saved settings</h3>{settings.length === 0 ? <p className="mt-3 text-sm text-slate-400">No settings saved yet. Save preferences above to create them.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{settings.map((setting) => <article key={setting.key} className="rounded-xl border border-white/[.07] bg-white/[.02] p-4"><h4 className="font-mono text-xs text-cyan-100">{setting.key}</h4><p className="mt-2 break-words text-sm text-slate-300">{typeof setting.value === "string" ? setting.value || "Not set" : JSON.stringify(setting.value)}</p><time className="mt-2 block text-xs text-slate-500">Updated {new Date(setting.updated_at).toLocaleString()}</time></article>)}</div>}</section>
    </>}
  </section>;
}
