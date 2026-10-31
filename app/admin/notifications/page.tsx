"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string | null; role: string };
type Notice = {
  id: string;
  client_id: string;
  title: string;
  message: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

const field =
  "w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-sm text-white outline-none focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60";

export default function AdminNotificationsPage() {
  const [clients, setClients] = useState<Profile[]>([]);
  const [items, setItems] = useState<Notice[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    setError("");

    const finishInitialLoad = () => {
      if (initial) setLoading(false);
    };

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Sign in again to continue.");
        finishInitialLoad();
        return;
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (roleError || me?.role !== "admin") {
        setError("Administrator access is required.");
        finishInitialLoad();
        return;
      }

      const [profilesResult, notificationsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,role")
          .order("full_name"),
        supabase
          .from("notifications")
          .select("id,client_id,title,message,type,read_at,created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (profilesResult.error || notificationsResult.error) {
        setError(
          `Could not load notifications: ${
            profilesResult.error?.message ?? notificationsResult.error?.message
          }`
        );
      } else {
        setClients((profilesResult.data ?? []) as Profile[]);
        setItems((notificationsResult.data ?? []) as Notice[]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load notifications."
      );
    } finally {
      finishInitialLoad();
    }
  }, []);

  useEffect(() => {
    void load(true);

    let hasSubscribed = false;
    const channel = supabase
      .channel("admin-notifications-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void load()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (hasSubscribed) void load();
          hasSubscribed = true;
        }
      });

    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setClientId("");
    setTitle("");
    setMessage("");
    setType("info");
  }

  function beginEdit(item: Notice) {
    setEditingId(item.id);
    setClientId(item.client_id);
    setTitle(item.title);
    setMessage(item.message);
    setType(item.type);
    setError("");
    setNotice("");
    document
      .getElementById("notification-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!clientId || !title.trim() || !message.trim()) {
      setError("Choose a client and enter both a title and message.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (roleError || me?.role !== "admin") {
        setError("Administrator access is required.");
        return;
      }

      if (editingId) {
        const { error: updateError } = await supabase.rpc(
          "admin_update_client_notification",
          {
            p_notification_id: editingId,
            p_title: title.trim(),
            p_message: message.trim(),
            p_type: type,
          }
        );
        if (updateError) {
          setError(`Could not update notification: ${updateError.message}`);
          return;
        }
        setNotice("Notification updated.");
      } else {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert({
            client_id: clientId,
            title: title.trim(),
            message: message.trim(),
            type,
          });
        if (insertError) {
          setError(`Could not create notification: ${insertError.message}`);
          return;
        }
        setNotice("Notification created.");
      }

      resetForm();
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the notification."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteNotification(item: Notice) {
    const clientName =
      clients.find((client) => client.id === item.client_id)?.full_name ??
      "this client";
    if (
      !window.confirm(
        `Delete “${item.title}” for ${clientName}? This cannot be undone.`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");
    setDeletingId(item.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (roleError || me?.role !== "admin") {
        setError("Administrator access is required.");
        return;
      }

      const { data, error: deleteError } = await supabase
        .from("notifications")
        .delete()
        .eq("id", item.id)
        .select("id")
        .maybeSingle();

      if (deleteError || !data) {
        setError(
          `Could not delete notification: ${
            deleteError?.message ?? "the notification was not removed"
          }`
        );
        return;
      }

      setItems((current) => current.filter((noticeItem) => noticeItem.id !== item.id));
      if (editingId === item.id) resetForm();
      setNotice("Notification deleted.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the notification."
      );
    } finally {
      setDeletingId(null);
    }
  }

  const names = new Map(
    clients.map((client) => [
      client.id,
      client.full_name?.trim() || "Unnamed client",
    ] as const)
  );

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
          Client communication
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Notifications</h2>
        <p className="mt-2 text-sm text-slate-400">
          Send accurate, account-specific notices to a selected client.
        </p>
      </header>

      <form
        id="notification-form"
        onSubmit={saveNotification}
        className="scroll-mt-24 rounded-2xl border border-white/[.08] bg-[#081a2a] p-5 sm:p-6"
      >
        <h3 className="font-semibold text-white">
          {editingId ? "Edit notification" : "Create notification"}
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Client
            <select
              className={`${field} mt-2`}
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              required
              disabled={Boolean(editingId)}
            >
              <option value="">Select a client…</option>
              {clients
                .filter((client) => client.role === "client")
                .map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name || "Unnamed client"}
                  </option>
                ))}
            </select>
            {editingId && (
              <span className="mt-2 block text-xs text-slate-500">
                The recipient stays the same when editing a sent notification.
              </span>
            )}
          </label>
          <label className="text-sm text-slate-300">
            Type
            <select
              className={`${field} mt-2`}
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="info">Information</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Action required / error</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">
            Title
            <input
              className={`${field} mt-2`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              minLength={1}
              maxLength={200}
              required
            />
          </label>
          <label className="text-sm text-slate-300 md:col-span-2">
            Message
            <textarea
              className={`${field} mt-2 min-h-28 resize-y`}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={1}
              maxLength={5000}
              required
            />
          </label>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-rose-200">{error}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-emerald-200">{notice}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {saving
              ? "Saving…"
              : editingId
                ? "Save notification changes"
                : "Create notification"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setError("");
                setNotice("");
              }}
              disabled={saving}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/[.04] disabled:opacity-50"
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-white/[.08] bg-[#081a2a] p-5">
        <h3 className="font-semibold text-white">Recent notifications</h3>
        {loading ? (
          <p className="mt-4 text-sm text-slate-400">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-white/[.07] bg-white/[.02] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h4 className="font-medium text-white">{item.title}</h4>
                  <time className="text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleString()}
                  </time>
                </div>
                <p className="mt-1 text-xs text-cyan-200">
                  {names.get(item.client_id) ?? "Client profile unavailable"} · {item.type} · {item.read_at ? "Read" : "Unread"}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {item.message}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => beginEdit(item)}
                    disabled={Boolean(deletingId)}
                    className="rounded-lg border border-cyan-200/20 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-200/[.07] disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteNotification(item)}
                    disabled={Boolean(deletingId)}
                    className="rounded-lg border border-rose-300/20 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-300/[.07] disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </article>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-slate-400">No notifications yet.</p>
            )}
          </div>
        )}
        {error && !notice && (
          <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>
        )}
      </div>
    </section>
  );
}
