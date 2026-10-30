"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Client = {
id: string;
full_name: string | null;
role: string;
created_at?: string;
updated_at?: string;
};

const panel =
"rounded-2xl border border-white/[0.08] bg-[#081a2a] p-5";

export default function AdminClientsPage() {
const [clients, setClients] = useState<Client[]>([]);
const [query, setQuery] = useState("");
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

const load = useCallback(async () => {
setLoading(true);
setError("");

const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
  setError("Your session has expired. Sign in again.");
  setLoading(false);
  return;
}

const { data: me, error: roleError } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .maybeSingle();

if (roleError || me?.role !== "admin") {
  setError("Administrator access is required.");
  setLoading(false);
  return;
}

// Fetch clients only. Administrator profiles are excluded.
const { data, error: dbError } = await supabase
  .from("profiles")
  .select("id, full_name, role, created_at, updated_at")
  .eq("role", "client")
  .order("created_at", { ascending: false });

if (dbError) {
  setError(`Could not load clients: ${dbError.message}`);
} else {
  setClients((data ?? []) as Client[]);
}

setLoading(false);

}, []);

useEffect(() => {
void load();
}, [load]);

const visible = clients.filter((client) =>
  `${client.full_name ?? ""} ${client.id}`
    .toLowerCase()
    .includes(query.toLowerCase())
);

return (
<section className="space-y-6">
<header>
<p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">
Account management
</p>

    <h2 className="mt-2 text-2xl font-semibold text-white">
      Clients
    </h2>

    <p className="mt-2 text-sm text-slate-400">
      View and manage client accounts registered in your Supabase project.
      Administrator accounts are excluded from this list.
    </p>
  </header>

  <div className={panel}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm text-slate-400">
          Registered clients
        </p>

        <p className="mt-1 text-2xl font-semibold text-white">
          {clients.length}
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search client name or ID"
        className="w-full rounded-xl border border-white/10 bg-[#04101d] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50 sm:max-w-sm"
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
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="border-b border-white/10 px-3 py-3">
              Client
            </th>

            <th className="border-b border-white/10 px-3 py-3">
              Profile ID
            </th>

            <th className="border-b border-white/10 px-3 py-3">
              Role
            </th>

            <th className="border-b border-white/10 px-3 py-3">
              Created
            </th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-8 text-slate-400"
              >
                Loading clients...
              </td>
            </tr>
          ) : (
            visible.map((client) => (
              <tr
                key={client.id}
                className="border-b border-white/[.05]"
              >
                <td className="px-3 py-4 font-medium text-white">
                  {client.full_name?.trim() || "Unnamed client"}
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
              </tr>
            ))
          )}

          {!loading && !error && visible.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-8 text-center text-slate-400"
              >
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
</section>
);
}