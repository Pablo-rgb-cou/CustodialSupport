"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WithdrawalStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

type Profile = {
  id: string;
  full_name: string | null;
};

type WithdrawalRecord = {
  id: string;
  client_id: string;
  amount: number;
  currency: string;
  crypto_asset: string | null;
  crypto_amount: number | null;
  wallet_address: string | null;
  status: WithdrawalStatus;
  transaction_reference: string | null;
  created_at: string;
  admin_note: string | null;
};

type Withdrawal = WithdrawalRecord & {
  clientName: string;
};

const statusStyles: Record<WithdrawalStatus, string> = {
  pending:
    "border-amber-300/20 bg-amber-300/10 text-amber-200",
  processing:
    "border-cyan-300/20 bg-cyan-300/10 text-cyan-200",
  completed:
    "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  failed:
    "border-rose-300/20 bg-rose-300/10 text-rose-200",
  cancelled:
    "border-slate-300/20 bg-slate-300/10 text-slate-300",
};

const statusLabels: Record<WithdrawalStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const currencies = ["USD", "EUR", "GBP"] as const;

const cryptoAssets = [
  "BTC",
  "ETH",
  "USDT",
  "USDC",
  "BNB",
  "XRP",
  "LTC",
  "SOL",
  "ADA",
  "DOGE",
  "TRX",
] as const;

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
const [currency, setCurrency] = useState("USD");

const [cryptoAsset, setCryptoAsset] = useState("BTC");
const [cryptoAmount, setCryptoAmount] = useState("");
const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] =
    useState<WithdrawalStatus>("pending");
  const [reference, setReference] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Verify that a valid authenticated session exists.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "Your session has expired. Sign in again to access withdrawals."
        );
      }

      // Confirm the current user's role.
      const { data: ownProfile, error: roleError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (roleError || ownProfile?.role !== "admin") {
        throw new Error(
          "Administrator access is required to manage withdrawals."
        );
      }

      // Load real client profiles.
      const { data: profileData, error: profilesError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .order("full_name", { ascending: true });

      if (profilesError) {
        throw new Error(
          `Could not load client profiles: ${profilesError.message}`
        );
      }

      // Load actual withdrawal records.
      const { data: withdrawalData, error: withdrawalsError } =
        await supabase
          .from("withdrawals")
          .select(
            "id, client_id, amount, currency, crypto_asset, crypto_amount, wallet_address, status, transaction_reference, created_at, admin_note"
          )
          .order("created_at", { ascending: false });

      if (withdrawalsError) {
        throw new Error(
          `Could not load withdrawals: ${withdrawalsError.message}`
        );
      }

      const availableProfiles = (profileData ?? []) as Profile[];
      const records = (withdrawalData ?? []) as WithdrawalRecord[];

      const profileMap = new Map(
        availableProfiles.map((profile) => [
          profile.id,
          profile.full_name?.trim() || "Unnamed client",
        ])
      );

      setProfiles(availableProfiles);

      setWithdrawals(
        records.map((record) => ({
          ...record,
          clientName:
            profileMap.get(record.client_id) ?? "Unknown client",
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading withdrawals."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const channel = supabase.channel("admin-withdrawals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, (payload) => {
        const row = (payload.new ?? payload.old) as WithdrawalRecord;
        if (payload.eventType === "DELETE") setWithdrawals((current) => current.filter((item) => item.id !== row.id));
        else if (row?.id) void loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => { void loadData(); })
      .subscribe((status) => { if (status === "SUBSCRIBED") void loadData(); });
    const refresh = () => { if (document.visibilityState === "visible") void loadData(); };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [loadData]);

  const filteredWithdrawals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return withdrawals.filter((item) => {
      const matchesSearch =
        item.clientName.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        (item.transaction_reference ?? "")
          .toLowerCase()
          .includes(query) ||
        (item.wallet_address ?? "").toLowerCase().includes(query) ||
        item.client_id.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [withdrawals, search, statusFilter]);

  const countByStatus = (value: WithdrawalStatus) =>
    withdrawals.filter((item) => item.status === value).length;

  function formatAmount(value: number, code: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  }

  async function addWithdrawal(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setNotice("");

    const numericAmount = Number(amount);
const numericCryptoAmount = Number(cryptoAmount);

if (
  !cryptoAssets.includes(
    cryptoAsset as (typeof cryptoAssets)[number]
  )
) {
  setError("Select a supported cryptocurrency.");
  return;
}

if (
  !Number.isFinite(numericCryptoAmount) ||
  numericCryptoAmount <= 0
) {
  setError("Enter a valid cryptocurrency quantity.");
  return;
}

    if (!clientId) {
      setError("Select an existing client profile.");
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!currencies.includes(currency as (typeof currencies)[number])) {
      setError("Select a supported currency.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Sign in again.");
      }

      // Recheck the administrator role before writing.
      const { data: ownProfile, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleError || ownProfile?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const { error: insertError } = await supabase
        .from("withdrawals")
        .insert({
          client_id: clientId,
          amount: numericAmount,
          currency,
          crypto_asset: cryptoAsset,
          crypto_amount: numericCryptoAmount,
          wallet_address: walletAddress.trim() || null,
          status,
          transaction_reference: reference.trim() || null,
          admin_note: adminNote.trim() || null,
        });

      if (insertError) {
        throw new Error(
          `Could not create the withdrawal record: ${insertError.message}`
        );
      }

      setNotice(
        "Withdrawal record saved successfully. This records a request; it does not initiate or verify a payment."
      );

      setClientId("");
      setAmount("");
      setCurrency("USD");
      setCryptoAsset("BTC");
      setCryptoAmount("");
      setWalletAddress("");
      setStatus("pending");
      setReference("");
      setAdminNote("");
      setShowForm(false);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the withdrawal record."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    id: string,
    nextStatus: WithdrawalStatus
  ) {
    setError("");
    setNotice("");
    setUpdatingId(id);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Your session has expired. Sign in again.");
      }

      const { data: ownProfile, error: roleError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleError || ownProfile?.role !== "admin") {
        throw new Error("Administrator access is required.");
      }

      const updatePayload: {
        status: WithdrawalStatus;
        updated_at: string;
        processed_at?: string | null;
      } = {
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };

      if (nextStatus === "completed") {
        updatePayload.processed_at = new Date().toISOString();
      } else {
        updatePayload.processed_at = null;
      }

      const { error: updateError } = await supabase
        .from("withdrawals")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) {
        throw new Error(
          `Could not update the withdrawal: ${updateError.message}`
        );
      }

      setNotice(
        `Withdrawal status updated to ${statusLabels[nextStatus]}. This change does not verify that a payment occurred.`
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update the withdrawal status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-200/[0.05] px-3 py-1.5 text-xs text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            Withdrawal management
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Withdrawals
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
            Review withdrawal requests and maintain accurate records of
            their current status.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/[0.04] disabled:opacity-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              setNotice("");
              setError("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-200/15"
          >
            <span className="text-lg">{showForm ? "×" : "+"}</span>
            {showForm ? "Cancel" : "Add withdrawal"}
          </button>
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm leading-6 text-emerald-100"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            className="ml-3 underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      )}

      {showForm && (
        <section className="rounded-2xl border border-white/10 bg-[#081a2a] p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-white">
            Create withdrawal record
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            Select an existing client and enter the details of an actual
            withdrawal request. This form does not transfer funds.
          </p>

          <form
            onSubmit={addWithdrawal}
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <label className="space-y-2 text-sm text-slate-300">
              <span>Client profile</span>
              <select
                required
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
              >
                <option value="">Select a client</option>
                {profiles
                  .filter((profile) => profile.id)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name?.trim() || "Unnamed client"} ·{" "}
                      {profile.id.slice(0, 8)}
                    </option>
                  ))}
              </select>

              {profiles.length === 0 && !loading && (
                <span className="block text-xs text-amber-200">
                  No client profiles are available. Create or register a
                  client account first.
                </span>
              )}
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Amount</span>
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
                placeholder="0.00"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Crypto asset</span>
              <select
                required
                value={cryptoAsset}
                onChange={(event) => setCryptoAsset(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
              >
                {cryptoAssets.map((asset) => (
                  <option key={asset} value={asset}>
                    {asset}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Crypto quantity</span>
              <input
                required
                type="number"
                min="0.00000001"
                step="any"
                value={cryptoAmount}
                onChange={(event) => setCryptoAmount(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
                placeholder="0.00000000"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              <span>Wallet address (optional)</span>
              <input
                value={walletAddress}
                onChange={(event) => setWalletAddress(event.target.value)}
                maxLength={200}
                autoComplete="off"
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 font-mono text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                placeholder="Enter the destination wallet address"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Currency</span>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300">
              <span>Initial status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as WithdrawalStatus)
                }
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none focus:border-cyan-300/40"
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              <span>Transaction reference (optional)</span>
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                maxLength={200}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                placeholder="Enter a genuine payment or transaction reference"
              />
            </label>

            <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">
              <span>Administrative note (optional)</span>
              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                maxLength={2000}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                placeholder="Internal record notes"
              />
            </label>

            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={saving || loading || profiles.length === 0}
                className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-3 text-sm font-medium text-cyan-100 hover:bg-cyan-200/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save withdrawal record"}
              </button>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total records",
            value: withdrawals.length,
            tone: "text-white",
          },
          {
            label: "Pending",
            value: countByStatus("pending"),
            tone: "text-amber-200",
          },
          {
            label: "Processing",
            value: countByStatus("processing"),
            tone: "text-cyan-200",
          },
          {
            label: "Completed",
            value: countByStatus("completed"),
            tone: "text-emerald-200",
          },
        ].map((stat) => (
          <article
            key={stat.label}
            className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5"
          >
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${stat.tone}`}>
              {loading ? "—" : stat.value}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#071725]/80">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="font-semibold text-white">
              Withdrawal records
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {loading
                ? "Loading records..."
                : `${filteredWithdrawals.length} record${
                    filteredWithdrawals.length === 1 ? "" : "s"
                  } shown`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, ID or reference"
              aria-label="Search withdrawal records"
              className="w-full rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/40 sm:w-64"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter withdrawals by status"
              className="rounded-xl border border-white/10 bg-[#04101d] px-3.5 py-2.5 text-sm text-white outline-none focus:border-cyan-300/40"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-slate-400">
            Loading withdrawal records from Supabase...
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-6"><path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" /><path fillRule="evenodd" clipRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" /></svg>
            </div>

            <h4 className="mt-4 font-medium text-white">
              {search || statusFilter !== "all"
                ? "No matching withdrawals"
                : "No withdrawal records yet"}
            </h4>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {search || statusFilter !== "all"
                ? "Try a different search term or status filter."
                : "Withdrawal records saved to your database will appear here."}
            </p>

            {!search && statusFilter === "all" && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-5 rounded-xl border border-cyan-200/20 bg-cyan-200/10 px-4 py-2.5 text-sm text-cyan-100 hover:bg-cyan-200/15"
              >
                Add first record
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1160px] text-left text-sm">
              <thead className="bg-white/[0.025] text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Client</th>
                  <th className="px-5 py-4 font-medium">Withdrawal ID</th>
                  <th className="px-5 py-4 font-medium">Amount</th>
                  <th className="px-5 py-4 font-medium">Wallet address</th>
                  <th className="px-5 py-4 font-medium">Date created</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Update status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.06]">
                {filteredWithdrawals.map((item) => (
                  <tr
                    key={item.id}
                    className="transition hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">
                        {item.clientName}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {item.client_id}
                      </p>
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-400">
                      {item.id}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-white">
                        {formatAmount(Number(item.amount), item.currency)}
                      </p>
                      {item.crypto_asset && item.crypto_amount != null ? (
                        <p className="mt-1 text-xs text-cyan-200">
                          {Number(item.crypto_amount).toLocaleString("en-US", {
                            maximumFractionDigits: 8,
                          })}{" "}
                          {item.crypto_asset}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          Crypto details unavailable
                        </p>
                      )}
                    </td>

                    <td className="max-w-[260px] px-5 py-4 font-mono text-xs text-slate-400">
                      {item.wallet_address ? (
                        <span className="break-all" title={item.wallet_address}>
                          {item.wallet_address}
                        </span>
                      ) : (
                        <span className="text-slate-600">Not provided</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {new Date(item.created_at).toLocaleString()}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
                          statusStyles[item.status]
                        }`}
                      >
                        {statusLabels[item.status]}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <select
                        aria-label={`Update status for ${item.id}`}
                        value={item.status}
                        disabled={updatingId === item.id}
                        onChange={(event) =>
                          void updateStatus(
                            item.id,
                            event.target.value as WithdrawalStatus
                          )
                        }
                        className="rounded-lg border border-white/10 bg-[#04101d] px-2.5 py-2 text-xs text-white outline-none focus:border-cyan-300/40 disabled:opacity-50"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        These records track administrative withdrawal requests. Changing
        a status does not initiate, settle, or independently verify a
        payment. Confirm transactions through your actual payment provider
        before marking them completed.
      </p>
    </div>
  );
}
