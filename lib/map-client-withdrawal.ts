import type { WithdrawalRecord } from "@/app/components/WithdrawalRecords";

const statuses: Record<string, WithdrawalRecord["status"]> = {
  pending: "Pending", processing: "Processing", completed: "Completed",
  failed: "Failed", cancelled: "Cancelled",
};

// Realtime can deliver an empty/incomplete record when replication is unhealthy.
// Such records must trigger a refetch, never become a new transaction in state.
export function mapClientWithdrawal(row: Record<string, unknown>): WithdrawalRecord | null {
  if (typeof row.id !== "string" || !row.id.trim() || row.id === "undefined") return null;
  if (row.amount == null || row.amount === "" || !["string", "number"].includes(typeof row.amount)) return null;
  const fiatAmount = Number(row.amount);
  const status = typeof row.status === "string" ? statuses[row.status.toLowerCase()] : undefined;
  if (!Number.isFinite(fiatAmount) || !status || typeof row.created_at !== "string" || !Number.isFinite(Date.parse(row.created_at))) return null;
  const cryptoAmount = row.crypto_amount == null || row.crypto_amount === "" ? null : Number(row.crypto_amount);
  return {
    id: row.id,
    reference: typeof row.transaction_reference === "string" && row.transaction_reference.trim() ? row.transaction_reference.trim() : row.id,
    asset: typeof row.crypto_asset === "string" && row.crypto_asset.trim() ? row.crypto_asset.toUpperCase() : null,
    cryptoAmount: cryptoAmount !== null && Number.isFinite(cryptoAmount) ? cryptoAmount : null,
    walletAddress: typeof row.wallet_address === "string" && row.wallet_address.trim() ? row.wallet_address.trim() : null,
    fiatAmount, currency: String(row.currency || "USD").toUpperCase(), status,
    date: new Date(row.created_at).toLocaleString(), createdAtISO: row.created_at,
  };
}
