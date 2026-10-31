"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  full_name: string | null;
  role: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type ClientRegistrationDetails = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  registeredAt: string | null;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  profileUpdatedAt: string | null;
};

const panel = "rounded-2xl border border-white/[0.08] bg-[#081a2a] p-5";
const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#04101d] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [details, setDetails] = useState<ClientRegistrationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const detailRequestId = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Sign in again.");
      }

      const { data: me, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (roleError || me?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("id, full_name, role, created_at, updated_at")
        .eq("role", "client")
        .order("created_at", { ascending: false });

      if (dbError) throw new Error(`Could not load clients: ${dbError.message}`);
      setClients((data ?? []) as Client[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load client profiles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("admin-clients-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          const row = (payload.eventType === "DELETE"
            ? payload.old
            : payload.new) as Client;
          if (!row?.id) return;

          if (payload.eventType === "DELETE" || row.role !== "client") {
            setClients((current) =>
              current.filter((client) => client.id !== row.id)
            );
            setSelectedClient((current) =>
              current?.id === row.id ? null : current
            );
            return;
          }

          setClients((current) =>
            payload.eventType === "INSERT"
              ? [row, ...current.filter((client) => client.id !== row.id)]
              : current.map((client) =>
                  client.id === row.id ? { ...client, ...row } : client
                )
          );
          setSelectedClient((current) =>
            current?.id === row.id ? { ...current, ...row } : current
          );
          setDetails((current) =>
            current?.id === row.id
              ? {
                  ...current,
                  fullName: row.full_name?.trim() || "Unnamed client",
                  role: row.role,
                  profileUpdatedAt: row.updated_at ?? current.profileUpdatedAt,
                }
              : current
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load(true);
      });

    const refresh = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function viewClient(client: Client) {
    const requestId = ++detailRequestId.current;
    setSelectedClient(client);
    setDetails(null);
    setDetailsError("");
    setLoadingDetails(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your admin session has expired. Sign in again.");
      }

      const response = await fetch(
        `/api/admin/clients/${encodeURIComponent(client.id)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load client details.");
      }

      if (detailRequestId.current === requestId) {
        setDetails(result as ClientRegistrationDetails);
      }
    } catch (loadError) {
      if (detailRequestId.current === requestId) {
        setDetailsError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load client details."
        );
      }
    } finally {
      if (detailRequestId.current === requestId) setLoadingDetails(false);
    }
  }

  function closeDetails() {
    detailRequestId.current += 1;
    setSelectedClient(null);
    setDetails(null);
    setDetailsError("");
    setLoadingDetails(false);
  }

  const visible = clients.filter((client) =>
    `${client.full_name ?? ""} ${client.id}`
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );

  const detailRows = details
    ? [
        ["Full name", details.fullName || "Not provided"],
        ["Sign-in email", details.email || "Not available"],
        ["Profile ID", details.id],
        ["Account role", details.role === "client" ? "Client" : details.role],
        ["Registered", formatDate(details.registeredAt)],
        [
          "Email verification",
          details.emailConfirmedAt
            ? `Confirmed · ${formatDate(details.emailConfirmedAt)}`
            : "Not confirmed",
        ],
        ["Last sign-in", formatDate(details.lastSignInAt)],
        ["Profile last updated", formatDate(details.profileUpdatedAt)],
      ]
    : [];

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
          Account directory
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Clients</h2>
        <p className="mt-2 text-sm text-slate-400">
          View client registration and account details. Administrator accounts
          are excluded from this list.
        </p>
      </header>

      <div className={panel}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-400">Registered clients</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {clients.length}
            </p>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search client name or ID"
            className={`${inputClass} sm:max-w-sm`}
            aria-label="Search client name or profile ID"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-200"
          >
            {error}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-white/10 px-3 py-3">Client</th>
                <th className="border-b border-white/10 px-3 py-3">Profile ID</th>
                <th className="border-b border-white/10 px-3 py-3">Role</th>
                <th className="border-b border-white/10 px-3 py-3">Registered</th>
                <th className="border-b border-white/10 px-3 py-3">Profile</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-slate-400">
                    Loading clients...
                  </td>
                </tr>
              ) : (
                visible.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-white/[.05] transition hover:bg-white/[.025]"
                  >
                    <td className="px-3 py-4 font-medium">
                      <button
                        type="button"
                        onClick={() => void viewClient(client)}
                        className="text-left text-white outline-none transition hover:text-cyan-200 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        {client.full_name?.trim() || "Unnamed client"}
                      </button>
                    </td>
                    <td className="break-all px-3 py-4 font-mono text-xs text-slate-400">
                      {client.id}
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[.06] px-2.5 py-1 text-xs text-cyan-100">
                        Client
                      </span>
                    </td>
                    <td className="px-3 py-4 text-slate-400">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        type="button"
                        onClick={() => void viewClient(client)}
                        className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-300/[.12]"
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {!loading && !error && visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                    {query
                      ? "No matching clients found."
                      : "No registered clients yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClient && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetails();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-profile-title"
            className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-[#081a2a] p-5 shadow-2xl shadow-black/50 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[.08] pb-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-300">
                  Client account · view only
                </p>
                <h2
                  id="client-profile-title"
                  className="sr-only"
                >
                  Client registration details
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetails}
                aria-label="Close client profile details"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/[.06]"
              >
                ×
              </button>
            </div>

            {loadingDetails ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Loading registration details…
              </p>
            ) : detailsError ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-4 text-sm text-rose-200"
              >
                {detailsError}
              </p>
            ) : details ? (
              <>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  {detailRows.map(([label, value]) => (
                    <div
                      key={label}
                      className={`min-w-0 rounded-xl border border-white/[.07] bg-[#04101d]/70 p-4 ${
                        label === "Profile ID" ? "sm:col-span-2" : ""
                      }`}
                    >
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </dt>
                      <dd className="mt-2 break-words text-sm leading-6 text-slate-100">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[.05]"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
