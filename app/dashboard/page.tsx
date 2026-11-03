"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ClientTicketCards from "@/app/components/ClientTicketCards";
import { useTicketAttachmentUrls } from "@/lib/use-ticket-attachment-urls";
import { useClientTicketUnread } from "@/lib/use-client-ticket-unread";
import { prepareTicketPhoto } from "@/lib/prepare-ticket-photo";
import { dispatchTicketEmail } from "@/lib/dispatch-ticket-email";
import { withRequestTimeout } from "@/lib/with-request-timeout";
import { useIdleSession } from "@/lib/use-idle-session";
import { sessionHasEnded } from "@/lib/session-activity";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClientTicketConversation, type ClientTicketMessage } from "@/lib/use-client-ticket-conversation";
import { useClientTicketTyping } from "@/lib/use-client-ticket-typing";
import WithdrawalRecords, { type WithdrawalRecord as Transaction } from "@/app/components/WithdrawalRecords";

type Ticket = {
id: string;
subject: string;
category: string;
amount: string;
asset: string;
network: string;
walletAddress: string;
transactionHash: string;
description: string;
status: "Open" | "In progress" | "Waiting for client" | "Resolved" | "Closed";
createdAt: string;
createdAtISO: string;
};

const initialTickets: Ticket[] = [];

type ClientNotification = { id: string; title: string; message: string; type: string; is_popup: boolean; read_at: string | null; created_at: string };

type ParsedTicketMessage = { text: string; photoPath?: string };

const ticketPhotoPrefix = "CS_TICKET_PHOTO_V1:";
const ticketPhotoExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const maxTicketPhotoSize = 5 * 1024 * 1024;

function encodeTicketPhotoMessage(text: string, photoPath: string) {
  return `${ticketPhotoPrefix}${JSON.stringify({ version: 1, text, photoPath })}`;
}

function parseTicketMessage(value: string): ParsedTicketMessage {
  if (!value.startsWith(ticketPhotoPrefix)) return { text: value };

  try {
    const parsed = JSON.parse(value.slice(ticketPhotoPrefix.length)) as {
      version?: unknown;
      text?: unknown;
      photoPath?: unknown;
    };
    if (
      parsed.version === 1 &&
      typeof parsed.text === "string" &&
      typeof parsed.photoPath === "string"
    ) {
      return { text: parsed.text, photoPath: parsed.photoPath };
    }
  } catch {
    // Keep malformed or legacy content readable as ordinary message text.
  }

  return { text: value };
}

function mapClientWithdrawal(row: Record<string, unknown>): Transaction {
  const rawStatus = String(row.status ?? "pending").toLowerCase();
  const status: Transaction["status"] = rawStatus === "completed" ? "Completed" : rawStatus === "processing" ? "Processing" : rawStatus === "failed" ? "Failed" : rawStatus === "cancelled" ? "Cancelled" : "Pending";
  return { id: String(row.id), reference: typeof row.transaction_reference === "string" && row.transaction_reference.trim() ? row.transaction_reference.trim() : String(row.id), asset: row.crypto_asset ? String(row.crypto_asset).toUpperCase() : null, cryptoAmount: row.crypto_amount == null ? null : Number(row.crypto_amount), walletAddress: typeof row.wallet_address === "string" && row.wallet_address.trim() ? row.wallet_address.trim() : null, fiatAmount: Number(row.amount), currency: String(row.currency || "USD").toUpperCase(), status, date: row.created_at ? new Date(String(row.created_at)).toLocaleString() : "—", createdAtISO: String(row.created_at ?? "") };
}
function mapClientTicket(row: Record<string, unknown>): Ticket {
  return { id: String(row.id), subject: String(row.subject ?? "Support request"), category: String(row.category ?? "Support"), amount: "", asset: "", network: "", walletAddress: "", transactionHash: "", description: String(row.description ?? ""), status: clientTicketStatus(String(row.status ?? "open")), createdAt: row.created_at ? new Date(String(row.created_at)).toLocaleString() : "—", createdAtISO: String(row.created_at ?? "") };
}

function clientTicketStatus(status: string): Ticket["status"] {
  switch (status) {
    case "in_progress": return "In progress";
    case "waiting_for_client": return "Waiting for client";
    case "resolved": return "Resolved";
    case "closed": return "Closed";
    default: return "Open";
  }
}

function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

const navigation = [
{ label: "Overview", icon: "home" },
{ label: "Withdrawals", icon: "withdrawals" },
{ label: "Support tickets", icon: "tickets" },
{ label: "Notifications", icon: "notifications" },
{ label: "Settings", icon: "settings" },
];

const navigationIconTileColors: Record<string, string> = {
  home: "border-cyan-300/20 bg-cyan-300/[0.09] text-cyan-200",
  withdrawals: "border-emerald-300/20 bg-emerald-300/[0.09] text-emerald-200",
  tickets: "border-sky-300/20 bg-sky-300/[0.09] text-sky-200",
  notifications: "border-amber-300/20 bg-amber-300/[0.09] text-amber-200",
  settings: "border-violet-300/20 bg-violet-300/[0.09] text-violet-200",
};

function DashboardNavigationIcon({ icon }: { icon: string }) {
  const common = { viewBox: "0 0 24 24", fill: "currentColor", className: "h-5 w-5", "aria-hidden": true as const };

  if (icon === "home") {
    return <svg {...common}><path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" /><path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" /></svg>;
  }
  if (icon === "withdrawals") {
    return <svg {...common}><path d="M4.5 3.75a3 3 0 0 0-3 3v.75h21v-.75a3 3 0 0 0-3-3h-15Z" /><path fillRule="evenodd" clipRule="evenodd" d="M22.5 9.75h-21v7.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-7.5Zm-18 3.75a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5h-6a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z" /></svg>;
  }
  if (icon === "tickets") {
    return <svg {...common}><path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 0 0-1.032-.211 50.89 50.89 0 0 0-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 0 0 2.433 3.984L7.28 21.53A.75.75 0 0 1 6 21v-4.03a48.527 48.527 0 0 1-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979Z" /><path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 0 0 1.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0 0 15.75 7.5Z" /></svg>;
  }
  if (icon === "notifications") {
    return <svg {...common}><path fillRule="evenodd" clipRule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" /></svg>;
  }
  if (icon === "settings") {
    return <svg {...common}><path fillRule="evenodd" clipRule="evenodd" d="M11.828 2.25c-.916 0-1.699.663-1.85 1.567l-.091.549a.798.798 0 0 1-.517.608 7.45 7.45 0 0 0-.478.198.798.798 0 0 1-.796-.064l-.453-.324a1.875 1.875 0 0 0-2.416.2l-.243.243a1.875 1.875 0 0 0-.2 2.416l.324.453a.798.798 0 0 1 .064.796 7.448 7.448 0 0 0-.198.478.798.798 0 0 1-.608.517l-.55.092a1.875 1.875 0 0 0-1.566 1.849v.344c0 .916.663 1.699 1.567 1.85l.549.091c.281.047.508.25.608.517.06.162.127.321.198.478a.798.798 0 0 1-.064.796l-.324.453a1.875 1.875 0 0 0 .2 2.416l.243.243c.648.648 1.67.733 2.416.2l.453-.324a.798.798 0 0 1 .796-.064c.157.071.316.137.478.198.267.1.47.327.517.608l.092.55c.15.903.932 1.566 1.849 1.566h.344c.916 0 1.699-.663 1.85-1.567l.091-.549a.798.798 0 0 1 .517-.608 7.52 7.52 0 0 0 .478-.198.798.798 0 0 1 .796.064l.453.324a1.875 1.875 0 0 0 2.416-.2l.243-.243c.648-.648.733-1.67.2-2.416l-.324-.453a.798.798 0 0 1-.064-.796c.071-.157.137-.316.198-.478.1-.267.327-.47.608-.517l.55-.091a1.875 1.875 0 0 0 1.566-1.85v-.344c0-.916-.663-1.699-1.567-1.85l-.549-.091a.798.798 0 0 1-.608-.517 7.507 7.507 0 0 0-.198-.478.798.798 0 0 1 .064-.796l.324-.453a1.875 1.875 0 0 0-.2-2.416l-.243-.243a1.875 1.875 0 0 0-2.416-.2l-.453.324a.798.798 0 0 1-.796.064 7.462 7.462 0 0 0-.478-.198.798.798 0 0 1-.517-.608l-.091-.55a1.875 1.875 0 0 0-1.85-1.566h-.344ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" /></svg>;
  }
  return <span aria-hidden="true">{icon}</span>;
}

function MetricCard({
title,
value,
description,
icon,
}: {
title: string;
value: string;
description: string;
icon: string;
}) {
const iconPaths: Record<string, string> = {
  "↗": "M5 16 10 11 14 14 21 6 M15 6h6v6",
  "◷": "M12 7v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "✓": "m5 12 4 4L19 6",
  "♧": "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  "▤": "M7 3h10l4 4v14H3V3h4 M7 3v5h10V3 M7 12h10 M7 16h7",
};
return (
<div className="group relative isolate min-h-[156px] overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#102941] via-[#0a1c30] to-[#071321] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:shadow-[0_20px_48px_rgba(0,0,0,0.27)] sm:p-6">
<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
<div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full border border-cyan-200/[0.08] transition-colors duration-700 group-hover:border-cyan-200/[0.16]" />
<div aria-hidden="true" className="pointer-events-none absolute -right-3 bottom-[-42px] h-32 w-32 rounded-full bg-cyan-400/[0.07] blur-2xl transition duration-500 group-hover:bg-cyan-300/[0.11]" />
<svg aria-hidden="true" viewBox="0 0 120 90" fill="none" className="pointer-events-none absolute bottom-2 right-2 h-24 w-32 opacity-20 transition duration-500 group-hover:opacity-35">
<path d="M4 72 28 52 44 60 66 33 82 40 112 10" stroke="#67E8F9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M4 84H116M4 64H116M4 44H116" stroke="#67E8F9" strokeOpacity=".35" strokeDasharray="3 5"/>
<circle cx="112" cy="10" r="4" fill="#99F6E4"/>
</svg>
<div className="relative flex items-start justify-between gap-3">
<p className="text-sm font-medium text-slate-300">{title}</p>
<span className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-gradient-to-br from-cyan-300/15 to-blue-400/[0.06] text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d={iconPaths[icon] ?? "M5 12h14"}/></svg>
</span>
</div>
<p className="relative mt-5 text-3xl font-semibold tracking-tight text-white">{value}</p>
<p className="relative mt-2 text-xs leading-5 text-slate-400">{description}</p>
</div>
);
}

type DemoPayout = {
  id: number;
  name: string;
  initials: string;
  amountUSD: number;
  asset: string;
  date: string;
};

const americanFirstNames = [
  "James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph",
  "Thomas", "Charles", "Christopher", "Daniel", "Matthew", "Anthony", "Mark",
  "Donald", "Steven", "Paul", "Andrew", "Joshua", "Mary", "Patricia", "Jennifer",
  "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Lisa",
  "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Kimberly", "Emily", "Donna",
  "Michelle", "Carol", "Amanda", "Melissa", "Deborah", "Stephanie", "Rebecca",
  "Laura", "Sharon", "Cynthia", "Kathleen", "Amy", "Nicole", "Samantha", "Megan",
  "Olivia", "Emma", "Ava", "Sophia", "Isabella", "Mia", "Charlotte", "Amelia",
  "Harper", "Evelyn", "Abigail", "Ella", "Scarlett", "Grace", "Chloe", "Lily",
  "Benjamin", "Lucas", "Henry", "Alexander", "Mason", "Ethan", "Logan", "Jackson",
  "Sebastian", "Jack", "Aiden", "Owen", "Samuel", "Ryan", "Nathan", "Caleb",
];

const americanLastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
  "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
  "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey",
  "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson",
];

const usedDemoNames = new Set<string>();

function uniqueAmericanName(_id: number, _namespace: number) {
  // Choose names randomly rather than walking through the name arrays in order.
  // A shared Set prevents repeated names in the rotating payout examples.
  const totalCombinations = americanFirstNames.length * americanLastNames.length;

  for (let attempt = 0; attempt < totalCombinations; attempt += 1) {
    const first = americanFirstNames[
      Math.floor(Math.random() * americanFirstNames.length)
    ];
    const last = americanLastNames[
      Math.floor(Math.random() * americanLastNames.length)
    ];
    const candidate = `${first} ${last}`;

    if (!usedDemoNames.has(candidate)) {
      usedDemoNames.add(candidate);
      return candidate;
    }
  }

  // Keep names unique even if the predefined combinations are exhausted.
  let suffix = 2;
  let fallback = `${americanFirstNames[Math.floor(Math.random() * americanFirstNames.length)]} ${americanLastNames[Math.floor(Math.random() * americanLastNames.length)]} ${suffix}`;
  while (usedDemoNames.has(fallback)) {
    suffix += 1;
    fallback = `${americanFirstNames[Math.floor(Math.random() * americanFirstNames.length)]} ${americanLastNames[Math.floor(Math.random() * americanLastNames.length)]} ${suffix}`;
  }
  usedDemoNames.add(fallback);
  return fallback;
}

const cryptoAssets = [
  { symbol: "BTC", id: "bitcoin" },
  { symbol: "ETH", id: "ethereum" },
  { symbol: "USDT", id: "tether" },
  { symbol: "USDC", id: "usd-coin" },
  { symbol: "BNB", id: "binancecoin" },
  { symbol: "SOL", id: "solana" },
  { symbol: "XRP", id: "ripple" },
];

function makeDemoPayout(id: number): DemoPayout {
  const name = uniqueAmericanName(id, 1);
  const token = cryptoAssets[Math.floor(Math.random() * cryptoAssets.length)];
  const amountUSD = Math.floor(14000 + Math.random() * (200000 - 14000));
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2);
  // Demo entries always show today's date; this is not a verified transaction timestamp.
  const date = new Date();

  return {
    id,
    name,
    initials,
    amountUSD,
    asset: token.symbol,
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

function WithdrawalPayoutCard() {
  const [payouts, setPayouts] = useState<DemoPayout[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<Date | null>(null);
  const [priceUnavailable, setPriceUnavailable] = useState(false);
  const nextPayoutId = useRef(4);

  useEffect(() => {
    setPayouts([makeDemoPayout(1), makeDemoPayout(2), makeDemoPayout(3)]);
    nextPayoutId.current = 4;

    const payoutTimer = window.setInterval(() => {
      const id = nextPayoutId.current++;
      const newPayout = makeDemoPayout(id);
      setPayouts((current) => [newPayout, ...current].slice(0, 3));
    }, 12000);

    async function loadPrices() {
      try {
        const ids = cryptoAssets.map((asset) => asset.id).join(",");
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Price request failed");
        const data = await response.json();
        const nextPrices: Record<string, number> = {};
        for (const asset of cryptoAssets) {
          const price = data?.[asset.id]?.usd;
          if (typeof price === "number" && price > 0) nextPrices[asset.symbol] = price;
        }
        setPrices(nextPrices);
        setPriceUpdatedAt(new Date());
        setPriceUnavailable(false);
      } catch {
        setPriceUnavailable(true);
      }
    }

    void loadPrices();
    const priceTimer = window.setInterval(() => void loadPrices(), 60000);

    return () => {
      window.clearInterval(payoutTimer);
      window.clearInterval(priceTimer);
    };
  }, []);

  const formatCryptoEquivalent = (payout: DemoPayout) => {
    const price = prices[payout.asset];
    if (!price) return null;
    const quantity = payout.amountUSD / price;
    const maximumFractionDigits = payout.asset === "BTC" ? 8 : payout.asset === "ETH" || payout.asset === "BNB" || payout.asset === "SOL" ? 6 : 2;
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    }).format(quantity);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-white">Recent Platform Activity</h3>
        </div>
        <span
          role="img"
          aria-label="Platform activity"
          title="Platform activity"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 shadow-[0_0_20px_rgba(52,211,153,0.08)]"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z" />
          </svg>
        </span>
      </div>

      <div className="px-5 pb-2 pt-3 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 border-b border-white/[0.07] pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
          <span>Customers</span>
          <span>Withdrawal amount</span>
          <span>Date</span>
        </div>
        <div aria-label="Recent platform activity" className="divide-y divide-white/[0.055]">
          {payouts.map((payout, index) => {
            const equivalent = formatCryptoEquivalent(payout);
            return (
              <div
                key={payout.id}
                className={`grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] items-center gap-3 py-4 ${
                  index === 0 ? "animate-[payout-in_450ms_ease-out]" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-xs font-semibold text-cyan-200"
                  >
                    {payout.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-200 sm:text-sm">{payout.name}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Sample customer</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white sm:text-sm">
                    {payout.amountUSD.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-cyan-200 sm:text-xs">
                    {equivalent ? `${equivalent} ${payout.asset}` : `${payout.asset} equivalent loading`}
                  </p>
                </div>
                <p className="text-[10px] leading-4 text-slate-400 sm:text-xs">{payout.date}</p>
              </div>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        @keyframes payout-in {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}

export default function DashboardPage() {
const router = useRouter();

const [userName, setUserName] = useState("Client");
const [userEmail, setUserEmail] = useState("");
const [authLoading, setAuthLoading] = useState(true);
const [authCheckError, setAuthCheckError] = useState("");
const [authSessionMissing, setAuthSessionMissing] = useState(false);
const [authRetryCount, setAuthRetryCount] = useState(0);
const [signingOut, setSigningOut] = useState(false);

const [activeSection, setActiveSection] = useState("Overview");
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const activeSectionRef = useRef(activeSection);
useEffect(() => { activeSectionRef.current = activeSection; }, [activeSection]);

useEffect(() => {
  if (!mobileMenuOpen) return;

  const bodyOverflow = document.body.style.overflow;
  const htmlOverflow = document.documentElement.style.overflow;
  const desktopViewport = window.matchMedia("(min-width: 1024px)");
  const restorePageScroll = () => {
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = htmlOverflow;
  };
  const handleViewportChange = (event: MediaQueryListEvent) => {
    if (event.matches) {
      restorePageScroll();
      setMobileMenuOpen(false);
    } else {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
  };

  if (!desktopViewport.matches) {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }
  desktopViewport.addEventListener("change", handleViewportChange);

  return () => {
    desktopViewport.removeEventListener("change", handleViewportChange);
    restorePageScroll();
  };
}, [mobileMenuOpen]);

const [transactions, setTransactions] = useState<Transaction[]>([]);
const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
const [withdrawalsError, setWithdrawalsError] = useState("");
const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
const [ticketsLoading, setTicketsLoading] = useState(true);
const [ticketsError, setTicketsError] = useState("");
const [notificationsLoading, setNotificationsLoading] = useState(true);
const [notificationsError, setNotificationsError] = useState("");
const [dashboardRetryCount, setDashboardRetryCount] = useState(0);
const [overviewMessages, setOverviewMessages] = useState<ClientTicketMessage[]>([]);
const [notifications, setNotifications] = useState<ClientNotification[]>([]);
const [selectedNotification, setSelectedNotification] = useState<ClientNotification | null>(null);
const [popupNotification, setPopupNotification] = useState<ClientNotification | null>(null);
const [dismissedPopupIds, setDismissedPopupIds] = useState<string[]>([]);
const popupAnnouncementCache = useRef<ClientNotification[]>([]);

useEffect(() => {
  if (!popupNotification) return;

  const bodyOverflow = document.body.style.overflow;
  const htmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = htmlOverflow;
  };
}, [popupNotification]);

useEffect(() => {
  if (!selectedNotification) return;

  const bodyOverflow = document.body.style.overflow;
  const htmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setSelectedNotification(null);
  };
  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = htmlOverflow;
  };
}, [selectedNotification]);

const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
const notificationReadAttempted = useRef(false);
const [currentUserId, setCurrentUserId] = useState("");
const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
const { unreadByTicket, totalUnread: unreadTicketCount, markRead: markTicketMessagesRead, applyEvent: applyTicketUnreadEvent, refresh: refreshTicketUnread } = useClientTicketUnread(currentUserId);
const {
  messages: ticketMessages, loading: loadingTicketMessages,
  error: ticketConversationError, reconnecting: ticketConversationReconnecting,
  reload: reloadClientTicketMessages, addMessage: addClientTicketMessage,
  prefetch: prefetchClientTicketMessages,
} = useClientTicketConversation(currentUserId, selectedTicketId);
const [ticketReply, setTicketReply] = useState("");
const updateClientTyping = useClientTicketTyping(currentUserId, selectedTicketId);
const clientConversationScrollRef = useRef<HTMLDivElement | null>(null);
const clientChatShellRef = useRef<HTMLElement | null>(null);
const clientFollowMessagesRef = useRef(true);
const [ticketReplyPhoto, setTicketReplyPhoto] = useState<File | null>(null);
const ticketPhotoPaths = ticketMessages.flatMap((message) => {
  const content = parseTicketMessage(message.message);
  return content.photoPath ? [content.photoPath] : [];
});
const { urls: ticketPhotoUrls, retry: retryTicketPhoto } = useTicketAttachmentUrls(currentUserId, selectedTicketId, ticketPhotoPaths);
const [ticketPhotoViewerUrl, setTicketPhotoViewerUrl] = useState<string | null>(null);
const ticketPhotoInputRef = useRef<HTMLInputElement | null>(null);
const [sendingTicketReply, setSendingTicketReply] = useState(false);

useEffect(() => {
  if (!ticketPhotoViewerUrl) return;
  const bodyOverflow = document.body.style.overflow;
  const htmlOverflow = document.documentElement.style.overflow;
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setTicketPhotoViewerUrl(null);
  };
  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    document.body.style.overflow = bodyOverflow;
    document.documentElement.style.overflow = htmlOverflow;
  };
}, [ticketPhotoViewerUrl]);

const [showTicketForm, setShowTicketForm] = useState(false);
const [successMessage, setSuccessMessage] = useState("");
const [notificationReadError, setNotificationReadError] = useState("");

const [fullName, setFullName] = useState("");
const [email, setEmail] = useState("");
const [category, setCategory] = useState("Withdrawal delay");
const [amount, setAmount] = useState("");
const [asset, setAsset] = useState("USDT");
const [network, setNetwork] = useState("TRC20");
const [walletAddress, setWalletAddress] = useState("");
const [transactionHash, setTransactionHash] = useState("");
const [description, setDescription] = useState("");
const [formError, setFormError] = useState("");

useEffect(() => {
  const getSectionFromUrl = () => {
    const section = new URLSearchParams(window.location.search).get("section");
    return navigation.some((item) => item.label === section) ? section : null;
  };

  const persistSection = (section: string) => {
    try {
      window.localStorage.setItem(
        "custodial-support-client-dashboard-section",
        section
      );
    } catch {
      // Dashboard navigation still works if browser storage is unavailable.
    }
  };

  const sectionFromUrl = getSectionFromUrl();
  let initialSection = sectionFromUrl;

  if (!initialSection) {
    try {
      const savedSection = window.localStorage.getItem(
        "custodial-support-client-dashboard-section"
      );
      if (navigation.some((item) => item.label === savedSection)) {
        initialSection = savedSection;
      }
    } catch {
      // Use the default section if browser storage is unavailable.
    }
  }

  initialSection ??= "Overview";
  setActiveSection(initialSection);
  persistSection(initialSection);

  // Make the currently displayed section the starting point for browser Back.
  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get("section") !== initialSection) {
    currentUrl.searchParams.set("section", initialSection);
    window.history.replaceState(null, "", currentUrl.toString());
  }

  const handlePopState = () => {
    const section = getSectionFromUrl() ?? "Overview";
    setActiveSection(section);
    setShowTicketForm(false);
    setSuccessMessage("");
    persistSection(section);
  };

  window.addEventListener("popstate", handlePopState);
  return () => window.removeEventListener("popstate", handlePopState);
}, []);

function selectSection(label: string) {
  const nextUrl = new URL(window.location.href);
  if (nextUrl.searchParams.get("section") !== label) {
    nextUrl.searchParams.set("section", label);
    // Each dashboard section becomes a browser-history entry, without a reload.
    window.history.pushState(null, "", nextUrl.toString());
  }

  setActiveSection(label);
  try {
    window.localStorage.setItem(
      "custodial-support-client-dashboard-section",
      label
    );
  } catch {
    // Navigation still works if browser storage is unavailable.
  }
}

useIdleSession(currentUserId, () => {
  setCurrentUserId("");
  setAuthLoading(true);
  setSelectedTicketId(null);
  setPopupNotification(null);
  router.replace("/login?reason=session-expired");
});

useEffect(() => {
  let active = true;
  const controller = new AbortController();
  setAuthLoading(true);
  setAuthCheckError("");
  setAuthSessionMissing(false);

  const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      setAuthLoading(true);
      setCurrentUserId("");
      setSelectedTicketId(null);
      setPopupNotification(null);
      popupAnnouncementCache.current = [];
      router.replace("/login");
    }
  });

  async function requireFreshSignIn() {
    if (!active) return;
    setCurrentUserId("");
    setAuthSessionMissing(true);
    try { await withRequestTimeout(() => supabase.auth.signOut({ scope: "local" }), { signal: controller.signal, timeoutMs: 5000 }); }
    finally { if (active) router.replace("/login"); }
  }

  async function loadUser() {
    try {
      const { data: { user }, error } = await withRequestTimeout(() => supabase.auth.getUser(), { signal: controller.signal });
      if (!active) return;
      if (error) {
        if (sessionHasEnded(error)) { await requireFreshSignIn(); return; }
        throw new Error("We couldn't verify your session just now. Please try again.");
      }
      if (!user) { await requireFreshSignIn(); return; }
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Client";
      setCurrentUserId(user.id);
      setUserName(name);
      setUserEmail(user.email ?? "");
      setFullName(name);
      setEmail(user.email ?? "");
      // Only authentication gates the page. Independent data sections load next.
    } catch (error) {
      if (active && !controller.signal.aborted) {
        console.warn("Could not verify the client session:", error);
        setAuthCheckError("We couldn't verify your session just now. Please try again.");
      }
    } finally {
      if (active) setAuthLoading(false);
    }
  }
  void loadUser();
  return () => {
    active = false;
    controller.abort();
    authListener.subscription.unsubscribe();
  };
}, [router, authRetryCount]);


async function handleSignOut() {
setSigningOut(true);

const { error } = await supabase.auth.signOut();

if (error) {
  setSuccessMessage("Unable to sign out. Please try again.");
  setSigningOut(false);
  return;
}

router.replace("/login");
router.refresh();

}

function openSection(label: string) {
selectSection(label);
setMobileMenuOpen(false);
setSuccessMessage("");

if (label === "Support tickets") {
  setShowTicketForm(false);
}

if (label === "Overview") {
  setShowTicketForm(false);
}

if (label === "Notifications") {
  setSuccessMessage("");
  setNotificationReadError("");
}

}

async function handleTicketSubmit(
event: React.FormEvent<HTMLFormElement>
) {
event.preventDefault();
setFormError("");
setSuccessMessage("");

if (!fullName.trim() || !email.trim() || !description.trim()) {
  setFormError("Please complete all required fields.");
  return;
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
  setFormError("Please enter a valid email address.");
  return;
}

if (amount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) {
  setFormError("Enter a valid withdrawal amount.");
  return;
}

if (walletAddress.length > 200 || transactionHash.length > 200) {
  setFormError("Please check the length of your transaction details.");
  return;
}

const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  setFormError("Your session has expired. Please sign in again.");
  return;
}
const extraDetails = [
  amount ? `Amount: ${amount} ${asset}` : "",
  network ? `Network: ${network}` : "",
  walletAddress ? `Wallet address: ${walletAddress}` : "",
  transactionHash ? `Transaction reference: ${transactionHash}` : "",
].filter(Boolean).join("\n");
const fullDescription = [description.trim(), extraDetails].filter(Boolean).join("\n\n");
const { data: created, error: createError } = await supabase
  .from("support_tickets")
  .insert({ client_id: user.id, subject: category.trim(), category, description: fullDescription, priority: "normal", status: "open" })
  .select("id, subject, category, description, status, created_at")
  .single();
if (createError || !created) {
  setFormError(`Could not create your ticket: ${createError?.message ?? "No ticket was returned."}`);
  return;
}
const newTicket: Ticket = {
  id: created.id, subject: created.subject, category: created.category, amount, asset, network,
  walletAddress, transactionHash, description: created.description, status: "Open",
  createdAt: new Date(created.created_at).toLocaleString(),
  createdAtISO: String(created.created_at ?? ""),
};
void dispatchTicketEmail(created.id);
setTickets((current) => [newTicket, ...current]);
setShowTicketForm(false);
selectSection("Support tickets");
setSuccessMessage(`Your support ticket ${newTicket.id} has been submitted.`);

setAmount("");
setWalletAddress("");
setTransactionHash("");
setDescription("");

}

function handleTicketPhotoSelection(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.currentTarget.files?.[0] ?? null;
  event.currentTarget.value = "";
  if (!file) return;

  if (!ticketPhotoExtensions[file.type]) {
    setFormError("Choose a JPG, PNG, WebP, or GIF photo.");
    return;
  }
  if (file.size > maxTicketPhotoSize) {
    setFormError("Photos must be 5 MB or smaller.");
    return;
  }

  setFormError("");
  setTicketReplyPhoto(file);
}

async function handleClientTicketReply(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const messageText = ticketReply.trim();
  const photo = ticketReplyPhoto;
  if (!selectedTicketId || (!messageText && !photo)) return;

  setSendingTicketReply(true);
  setFormError("");

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    setCurrentUserId(user.id);
    let photoPath: string | null = null;

    if (photo) {
      const uploadPhoto = await prepareTicketPhoto(photo);
      const extension = ticketPhotoExtensions[uploadPhoto.type];
      if (!extension) throw new Error("Choose a supported photo file.");

      photoPath = `${selectedTicketId}/${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(photoPath, uploadPhoto, {
          cacheControl: "3600",
          contentType: uploadPhoto.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`The photo could not be uploaded: ${uploadError.message}`);
      }
    }

    const storedMessage = photoPath
      ? encodeTicketPhotoMessage(messageText, photoPath)
      : messageText;

    const { data: sentMessage, error: insertError } = await supabase.from("ticket_messages").insert({
      ticket_id: selectedTicketId,
      sender_id: user.id,
      message: storedMessage,
      is_internal: false,
    }).select("id, ticket_id, sender_id, message, is_internal, created_at").single();

    if (insertError) {
      if (photoPath) {
        const { error: cleanupError } = await supabase.storage
          .from("ticket-attachments")
          .remove([photoPath]);
        if (cleanupError) {
          console.warn("Could not remove the unused ticket photo:", cleanupError.message);
        }
      }
      throw new Error(`Your reply could not be sent: ${insertError.message}`);
    }

    setTicketReply("");
    updateClientTyping(false);
    clientFollowMessagesRef.current = true;
    if (sentMessage) addClientTicketMessage(sentMessage as ClientTicketMessage);
    if (sentMessage) void dispatchTicketEmail(selectedTicketId);
    setTicketReplyPhoto(null);
    void reloadClientTicketMessages();
    setSuccessMessage("Your reply has been sent to support.");
  } catch (replyError) {
    setFormError(
      replyError instanceof Error
        ? replyError.message
        : "Your reply could not be sent."
    );
  } finally {
    setSendingTicketReply(false);
  }
}

useEffect(() => {
  setTicketReply("");
  setTicketReplyPhoto(null);
  clientFollowMessagesRef.current = true;
}, [selectedTicketId]);

useEffect(() => {
  if (activeSection !== "Support tickets" || selectedTicketId || !currentUserId) return;
  const firstTicket = tickets[0];
  if (firstTicket) void prefetchClientTicketMessages(firstTicket.id);
}, [activeSection, currentUserId, prefetchClientTicketMessages, selectedTicketId, tickets]);

useEffect(() => {
  const scroll = clientConversationScrollRef.current;
  if (scroll && clientFollowMessagesRef.current) scroll.scrollTop = scroll.scrollHeight;
}, [ticketMessages, loadingTicketMessages]);

useEffect(() => {
  if (activeSection !== "Support tickets" || !selectedTicketId || loadingTicketMessages || ticketConversationError) return;
  const markVisible = () => {
    const panel = clientConversationScrollRef.current;
    if (document.visibilityState === "visible" && !popupNotification && !ticketPhotoViewerUrl && !selectedNotification && !mobileMenuOpen && panel && panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80) markTicketMessagesRead(selectedTicketId, ticketMessages);
  };
  const frame = requestAnimationFrame(markVisible);
  document.addEventListener("visibilitychange", markVisible);
  return () => { cancelAnimationFrame(frame); document.removeEventListener("visibilitychange", markVisible); };
}, [activeSection, selectedTicketId, loadingTicketMessages, ticketConversationError, ticketMessages, markTicketMessagesRead, popupNotification, ticketPhotoViewerUrl, selectedNotification, mobileMenuOpen]);

function handleClientTicketReplyChange(value: string) {
  setTicketReply(value);
  updateClientTyping(Boolean(value.trim()));
}

useEffect(() => {
  if (authLoading || !currentUserId) return;
  let active = true;
  let inFlight = false;
  let queued = false;
  const controller = new AbortController();
  const revision = { withdrawals: 0, tickets: 0, notifications: 0, messages: 0, profile: 0 };
  type Entry = { revision: number; row: Record<string, unknown> | null };
  const journals = { withdrawals: new Map<string, Entry>(), tickets: new Map<string, Entry>(), notifications: new Map<string, Entry>(), messages: new Map<string, Entry>() };
  const remember = (key: keyof typeof journals, change: { eventType: string; old: unknown; new: unknown }) => {
    const row = (change.eventType === "DELETE" ? change.old : change.new) as Record<string, unknown>;
    if (typeof row.id === "string") journals[key].set(row.id, { revision: revision[key], row: change.eventType === "DELETE" ? null : row });
  };
  const loaded = { withdrawals: false, tickets: false, notifications: false };
  setWithdrawalsLoading(true);
  setTicketsLoading(true);
  setNotificationsLoading(true);
  setWithdrawalsError("");
  setTicketsError("");
  setNotificationsError("");

  const request = <T,>(factory: (signal: AbortSignal) => PromiseLike<T>) => withRequestTimeout(factory, { signal: controller.signal });
  const refresh = async () => {
    if (!active) return;
    if (inFlight) { queued = true; return; }
    inFlight = true;
    const started = { ...revision };
    const current = (key: keyof typeof revision) => active && revision[key] === started[key];
    const merge = <Row extends { id: string },>(key: keyof typeof journals, rows: Row[]): Row[] => {
      const merged = new Map(rows.map((row) => [row.id, row]));
      for (const [id, event] of journals[key]) {
        if (event.revision <= started[key]) { journals[key].delete(id); continue; }
        if (event.row) merged.set(id, event.row as Row); else merged.delete(id);
      }
      return [...merged.values()];
    };
    // Publish each section as soon as it arrives; one slow service cannot hold the dashboard.
    await Promise.allSettled([
      request((signal) => supabase.from("withdrawals").select("id, amount, currency, crypto_asset, crypto_amount, wallet_address, status, transaction_reference, created_at").eq("client_id", currentUserId).order("created_at", { ascending: false }).abortSignal(signal)).then(({ data, error }) => {
        if (!active) return;
        if (error) throw new Error(error.message);
        setTransactions(merge("withdrawals", data ?? []).map(mapClientWithdrawal));
        loaded.withdrawals = true;
        setWithdrawalsError("");
      }).catch((error) => { if (active && !loaded.withdrawals) setWithdrawalsError("Your withdrawals could not be loaded. Please try again."); console.warn("Withdrawal refresh failed:", error); }).finally(() => { if (active) setWithdrawalsLoading(false); }),
      request((signal) => supabase.from("support_tickets").select("id, subject, category, description, status, created_at").eq("client_id", currentUserId).order("created_at", { ascending: false }).abortSignal(signal)).then(({ data, error }) => {
        if (!active) return;
        if (error) throw new Error(error.message);
        setTickets(merge("tickets", data ?? []).map(mapClientTicket));
        loaded.tickets = true;
        setTicketsError("");
      }).catch((error) => { if (active && !loaded.tickets) setTicketsError("Your support tickets could not be loaded. Please try again."); console.warn("Ticket refresh failed:", error); }).finally(() => { if (active) setTicketsLoading(false); }),
      request((signal) => supabase.from("notifications").select("id, title, message, type, is_popup, read_at, created_at").eq("client_id", currentUserId).order("created_at", { ascending: false }).limit(100).abortSignal(signal)).then(({ data, error }) => {
        if (!active) return;
        if (error) throw new Error(error.message);
        setNotifications(merge("notifications", data ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100) as ClientNotification[]);
        loaded.notifications = true;
        setNotificationsError("");
      }).catch((error) => { if (active && !loaded.notifications) setNotificationsError("Your notifications could not be loaded. Please try again."); console.warn("Notification refresh failed:", error); }).finally(() => { if (active) setNotificationsLoading(false); }),
      request((signal) => supabase.from("client_ticket_message_realtime").select("id, ticket_id, client_id, sender_id, message, is_internal, created_at").eq("client_id", currentUserId).eq("is_internal", false).order("created_at", { ascending: false }).limit(8).abortSignal(signal)).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        if (active) setOverviewMessages(merge("messages", data ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8) as ClientTicketMessage[]);
      }).catch((error) => { if (active) console.warn("Recent activity refresh failed:", error); }),
      request((signal) => supabase.from("notifications").select("id", { count: "exact", head: true }).eq("client_id", currentUserId).is("read_at", null).eq("is_popup", false).abortSignal(signal)).then(({ count, error }) => {
        if (error) throw new Error(error.message);
        if (current("notifications")) setUnreadNotificationCount(count ?? 0);
      }).catch((error) => { if (active) console.warn("Notification count refresh failed:", error); }),
      request((signal) => supabase.from("profiles").select("full_name").eq("id", currentUserId).abortSignal(signal).maybeSingle()).then(({ data, error }) => {
        if (error) throw new Error(error.message);
        if (current("profile") && data?.full_name?.trim()) { setUserName(data.full_name.trim()); setFullName(data.full_name.trim()); }
      }).catch((error) => { if (active) console.warn("Profile refresh failed:", error); }),
    ]);
    inFlight = false;
    if (active && queued) { queued = false; void refresh(); }
  };

  const channel = supabase.channel(`client-dashboard:${currentUserId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "client_profile_realtime", filter: `id=eq.${currentUserId}` }, (payload) => {
      if (!active) return;
      revision.profile += 1;
      const row = payload.new as { full_name?: string | null };
      const name = payload.eventType === "DELETE" ? "Client" : row.full_name?.trim() || "Client";
      setUserName(name); setFullName(name);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "client_withdrawal_realtime", filter: `client_id=eq.${currentUserId}` }, (payload) => {
      if (!active) return;
      revision.withdrawals += 1;
      remember("withdrawals", payload);
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
      if (payload.eventType === "DELETE") setTransactions((items) => items.filter((item) => item.id !== row.id));
      else { const item = mapClientWithdrawal(row); setTransactions((items) => [item, ...items.filter((entry) => entry.id !== item.id)]); }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets", filter: `client_id=eq.${currentUserId}` }, (payload) => {
      if (!active) return;
      revision.tickets += 1;
      remember("tickets", payload);
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Record<string, unknown>;
      if (payload.eventType === "DELETE") setTickets((items) => items.filter((item) => item.id !== row.id));
      else { const item = mapClientTicket(row); setTickets((items) => [item, ...items.filter((entry) => entry.id !== item.id)]); }
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "client_ticket_message_realtime", filter: `client_id=eq.${currentUserId}` }, (payload) => {
      if (!active) return;
      revision.messages += 1;
      remember("messages", payload);
      applyTicketUnreadEvent(payload);
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as ClientTicketMessage & { client_id?: string };
      if (payload.eventType === "DELETE") setOverviewMessages((items) => items.filter((item) => item.id !== row.id));
      else if (row.client_id === currentUserId && !row.is_internal) setOverviewMessages((items) => [row, ...items.filter((item) => item.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8));
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `client_id=eq.${currentUserId}` }, (payload) => {
      if (!active) return;
      revision.notifications += 1;
      remember("notifications", payload);
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as ClientNotification;
      if (payload.eventType !== "DELETE" && row.read_at === null && activeSectionRef.current === "Notifications") notificationReadAttempted.current = false;
      if (payload.eventType === "DELETE") setNotifications((items) => items.filter((item) => item.id !== row.id));
      else setNotifications((items) => [row, ...items.filter((item) => item.id !== row.id)].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 100));
      void request((signal) => supabase.from("notifications").select("id", { count: "exact", head: true }).eq("client_id", currentUserId).is("read_at", null).eq("is_popup", false).abortSignal(signal)).then(({ count, error }) => { if (active && !error) setUnreadNotificationCount(count ?? 0); }).catch(() => {});
    })
    .subscribe((status) => {
      if (!active) return;
      if (status === "SUBSCRIBED") { void refresh(); void refreshTicketUnread(true); }
    });
  // Data loading starts immediately and never waits for a WebSocket handshake.
  void refresh();
  const recover = () => { if (document.visibilityState === "visible") { void refresh(); void refreshTicketUnread(); } };
  window.addEventListener("online", recover);
  document.addEventListener("visibilitychange", recover);
  return () => {
    active = false;
    controller.abort();
    window.removeEventListener("online", recover);
    document.removeEventListener("visibilitychange", recover);
    void supabase.removeChannel(channel);
  };
}, [authLoading, currentUserId, dashboardRetryCount, applyTicketUnreadEvent, refreshTicketUnread]);


// Opening Notifications marks every currently unread item as read. Keep the
// badge optimistic, then persist read_at under the client's own-row RLS policy.
useEffect(() => {
  if (activeSection !== "Notifications") {
    notificationReadAttempted.current = false;
    return;
  }
  if (!currentUserId || unreadNotificationCount === 0 || notificationReadAttempted.current) return;

  notificationReadAttempted.current = true;
  const unreadCountBeforeRead = unreadNotificationCount;
  const readAt = new Date().toISOString();
  setNotifications((current) => current.map((item) =>
    !item.read_at ? { ...item, read_at: readAt } : item
  ));
  setUnreadNotificationCount(0);

  void (async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("client_id", currentUserId)
      .is("read_at", null);

    if (error) {
      setNotifications((current) => current.map((item) =>
        item.read_at === readAt ? { ...item, read_at: null } : item
      ));
      setUnreadNotificationCount(unreadCountBeforeRead);
      setNotificationReadError("Could not mark notifications as read. Please try opening this page again.");
    }
  })();
}, [activeSection, currentUserId, unreadNotificationCount]);

function dismissPopupNotification() {
  const item = popupNotification;
  if (!item) return;
  setDismissedPopupIds((current) => current.includes(item.id) ? current : [...current, item.id]);
  const next = popupAnnouncementCache.current.find((notification) => notification.id !== item.id && !dismissedPopupIds.includes(notification.id) && notification.is_popup);
  setPopupNotification(next ?? null);
}

useEffect(() => {
  const knownIds = new Set(popupAnnouncementCache.current.map((item) => item.id));
  popupAnnouncementCache.current = [
    ...popupAnnouncementCache.current,
    ...notifications.filter((item) => item.is_popup && !knownIds.has(item.id)),
  ];
  setPopupNotification((current) => current ?? popupAnnouncementCache.current.find((item) => !dismissedPopupIds.includes(item.id)) ?? null);
}, [notifications, dismissedPopupIds]);

const pendingOrProcessingWithdrawals = transactions.filter(
  (transaction) =>
    transaction.status === "Pending" || transaction.status === "Processing"
);
const pendingOrProcessingWithdrawalCount = pendingOrProcessingWithdrawals.length;
const activeTickets = tickets.filter(
  (ticket) => ticket.status !== "Resolved" && ticket.status !== "Closed"
);

const recentActivity = [
  ...notifications.map((item) => ({
    id: "notification-" + item.id,
    kind: "notification" as const,
    title: item.title,
    detail: item.message,
    createdAt: item.created_at,
    section: "Notifications",
  })),
  ...transactions.map((item) => ({
    id: "withdrawal-" + item.id,
    kind: "withdrawal" as const,
    title: "Withdrawal record",
    detail: item.status + " · " + (item.asset ?? "Asset not specified") + " · Ref " + item.reference,
    createdAt: item.createdAtISO,
    section: "Withdrawals",
  })),
  ...tickets.map((item) => ({
    id: "ticket-" + item.id,
    kind: "ticket" as const,
    title: "Support ticket submitted",
    detail: item.subject + " · " + item.status,
    createdAt: item.createdAtISO,
    section: "Support tickets",
  })),
  ...overviewMessages.map((item) => {
    const parsed = parseTicketMessage(item.message);
    const ticket = tickets.find((entry) => entry.id === item.ticket_id);
    return {
      id: "message-" + item.id,
      kind: "message" as const,
      title: item.sender_id === currentUserId ? "You replied to support" : "Support replied",
      detail: (ticket?.subject ?? "Support ticket") + " · " + (parsed.text.trim() || (parsed.photoPath ? "Shared a photo" : "Message sent")),
      createdAt: item.created_at,
      section: "Support tickets",
    };
  }),
]
  .filter((item) => Number.isFinite(Date.parse(item.createdAt)))
  .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

const latestOpenTicket = [...activeTickets].sort(
  (a, b) => Date.parse(b.createdAtISO) - Date.parse(a.createdAtISO)
)[0];
const latestPendingWithdrawal = pendingOrProcessingWithdrawals[0];
const nextStep = unreadNotificationCount > 0
  ? {
      eyebrow: "Account update",
      title: unreadNotificationCount === 1 ? "You have a new notification" : "You have " + unreadNotificationCount + " new notifications",
      detail: "Open your notifications to read the latest account updates.",
      action: "View notifications",
      section: "Notifications",
    }
  : latestPendingWithdrawal
    ? {
        eyebrow: "Withdrawal follow-up",
        title: "Your withdrawal record is being tracked",
        detail: (latestPendingWithdrawal.asset ?? "Withdrawal") + " is marked " + latestPendingWithdrawal.status + ". Review the recorded details and status in Withdrawals.",
        action: "View withdrawals",
        section: "Withdrawals",
      }
    : latestOpenTicket
      ? {
          eyebrow: "Support follow-up",
          title: "Continue your support conversation",
          detail: "Your ticket ‘" + latestOpenTicket.subject + "’ is " + latestOpenTicket.status + ". Open it to read or send a reply.",
          action: "View support tickets",
          section: "Support tickets",
        }
      : {
          eyebrow: "Here when you need us",
          title: "Need help with something?",
          detail: "Send a secure support request and follow the conversation from your dashboard.",
          action: "Open a support ticket",
          section: "Support tickets",
          openTicketForm: true,
        };

const handleNextStep = () => {
  selectSection(nextStep.section);
  setSuccessMessage("");
  setShowTicketForm(Boolean("openTicketForm" in nextStep && nextStep.openTicketForm));
};

const isTicketChatOpen = activeSection === "Support tickets" && Boolean(selectedTicketId);

useEffect(() => {
  if (!isTicketChatOpen) return;

  const bodyOverflow = document.body.style.overflow;
  const htmlOverflow = document.documentElement.style.overflow;
  const scrollY = window.scrollY;
  const bodyPosition = document.body.style.position;
  const bodyTop = document.body.style.top;
  const bodyWidth = document.body.style.width;
  const shell = clientChatShellRef.current;
  const viewport = window.visualViewport;
  const fitViewport = () => {
    shell?.style.setProperty("--client-chat-height", `${viewport?.height ?? window.innerHeight}px`);
    shell?.style.setProperty("--client-chat-top", `${viewport?.offsetTop ?? 0}px`);
    const panel = clientConversationScrollRef.current;
    if (panel && clientFollowMessagesRef.current) panel.scrollTop = panel.scrollHeight;
  };
  fitViewport();
  window.addEventListener("resize", fitViewport);
  viewport?.addEventListener("resize", fitViewport);
  viewport?.addEventListener("scroll", fitViewport, { passive: true });
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  document.documentElement.style.overflow = "hidden";

  return () => {
    window.removeEventListener("resize", fitViewport);
    viewport?.removeEventListener("resize", fitViewport);
    viewport?.removeEventListener("scroll", fitViewport);
    document.body.style.overflow = bodyOverflow;
    document.body.style.position = bodyPosition;
    document.body.style.top = bodyTop;
    document.body.style.width = bodyWidth;
    document.documentElement.style.overflow = htmlOverflow;
    window.scrollTo({ top: scrollY, behavior: "instant" });
  };
}, [isTicketChatOpen]);

if (authCheckError) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#060d18] px-5 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a1929] p-6 shadow-2xl">
        <h1 className="text-lg font-semibold">Session check paused</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{authCheckError}</p>
        {authSessionMissing ? (
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Go to sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthRetryCount((count) => count + 1)}
            className="mt-5 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Try again
          </button>
        )}
      </section>
    </main>
  );
}

if (authLoading || !currentUserId) {
return (
<main className="flex min-h-screen items-center justify-center bg-[#060d18] text-white">
<div className="text-center">
<div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-300/20 border-t-cyan-300" />
<p className="mt-4 text-sm text-slate-400">
Loading your dashboard...
</p>
</div>
</main>
);
}

return (
<main ref={clientChatShellRef} data-client-conversation-open={isTicketChatOpen ? "true" : undefined} style={isTicketChatOpen ? { top: "var(--client-chat-top, 0px)", height: "var(--client-chat-height, 100dvh)" } : undefined} className={`${isTicketChatOpen ? "fixed inset-x-0 min-h-0 overflow-hidden" : "min-h-screen"} bg-[#020a14] text-white selection:bg-cyan-300/25 selection:text-cyan-50`}>
<div className={`relative isolate flex ${isTicketChatOpen ? "h-full min-h-0 overflow-hidden" : "min-h-screen overflow-x-clip"} bg-[radial-gradient(ellipse_at_72%_0%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(ellipse_at_4%_56%,rgba(8,145,178,0.09),transparent_30%),linear-gradient(135deg,#020a14_0%,#07182a_48%,#020a14_100%)]`}>
{/* Sidebar */}
<aside className="fixed inset-y-0 left-0 z-30 hidden h-dvh w-[270px] shrink-0 flex-col border-r border-cyan-200/[0.07] bg-[#04101e]/95 shadow-[12px_0_40px_rgba(0,0,0,0.12)] lg:flex">
<Link href="/dashboard?section=Overview" className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6 transition hover:bg-white/[0.02]">
<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/20 bg-gradient-to-br from-cyan-300/20 to-blue-500/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
<svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-7 w-7"><path d="M16 2.8 27 7v8.1c0 7.1-4.5 11.8-11 14.1C9.5 26.9 5 22.2 5 15.1V7l11-4.2Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.6"/><path d="m10.5 15.8 3.5 3.4 7.6-8" stroke="#99F6E4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
</span>
<span className="text-base font-bold">
Custodial<span className="text-cyan-300">Support</span>
</span>
</Link>

      <div className="px-4 pt-8">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => (
            <button
              key={item.label}
              onClick={() => openSection(item.label)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                activeSection === item.label
                  ? "border border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.12] to-cyan-300/[0.04] text-cyan-100 shadow-sm shadow-cyan-950/20"
                  : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
              }`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${navigationIconTileColors[item.icon] ?? "border-slate-300/20 bg-slate-300/[0.07] text-slate-300"}`} aria-hidden="true">
                <DashboardNavigationIcon icon={item.icon} />
              </span>
              {item.label}
              {item.label === "Withdrawals" &&
                pendingOrProcessingWithdrawalCount > 0 && (
                  <span
                    aria-label={`${pendingOrProcessingWithdrawalCount} pending or processing withdrawals`}
                    className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-semibold text-amber-200"
                  >
                    {pendingOrProcessingWithdrawalCount > 99
                      ? "99+"
                      : pendingOrProcessingWithdrawalCount}
                  </span>
                )}
              {item.label === "Support tickets" && unreadTicketCount > 0 && (
                <span className="ml-auto rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs text-cyan-200">
                  {unreadTicketCount > 99 ? "99+" : unreadTicketCount}
                </span>
              )}
              {item.label === "Notifications" && unreadNotificationCount > 0 && (
                <span
                  aria-label={`${unreadNotificationCount} unread notifications`}
                  className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-semibold text-amber-200"
                >
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-cyan-300/15 bg-gradient-to-br from-cyan-300/[0.07] to-transparent p-4 shadow-inner shadow-white/[0.02]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            <span className="text-xs font-semibold text-emerald-200">
              Security reminder
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Never share your wallet recovery phrase or private keys with
            anyone claiming to be support.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-4 w-full rounded-xl border border-white/[0.09] bg-white/[0.02] px-3 py-3 text-sm text-slate-300 transition hover:border-red-400/30 hover:bg-red-400/[0.04] hover:text-red-300 disabled:opacity-50"
        >
          {signingOut ? "Signing out..." : "↗ Sign out"}
        </button>
      </div>
    </aside>

    {/* Main content */}
    <div className={`min-w-0 flex-1 lg:ml-[270px] ${isTicketChatOpen ? "flex h-full min-h-0 flex-col overflow-hidden" : ""}`}>
      {/* Top navigation */}
      <header className="sticky top-0 z-40 flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#07111f]/95 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuOpen ? "mobile-dashboard-menu" : undefined}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 lg:hidden"
          >
            {mobileMenuOpen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            )}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
              {activeSection}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-48 truncate text-sm text-slate-400 sm:block">
            {userEmail}
          </span>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 font-semibold text-cyan-200">
            {userName.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          />
          <nav
            id="mobile-dashboard-menu"
            aria-label="Mobile dashboard navigation"
            className="fixed left-4 right-4 top-[5.5rem] z-30 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.09] bg-[#0b1728]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:left-7 sm:right-7 lg:hidden"
          >
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</p>
            {navigation.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => openSection(item.label)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeSection === item.label
                    ? "border border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.12] to-cyan-300/[0.04] text-cyan-100 shadow-sm shadow-cyan-950/20"
                    : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,.04)] ${navigationIconTileColors[item.icon] ?? "border-slate-300/20 bg-slate-300/[0.07] text-slate-300"}`} aria-hidden="true">
                  <DashboardNavigationIcon icon={item.icon} />
                </span>
                <span>{item.label}</span>
                {item.label === "Withdrawals" && pendingOrProcessingWithdrawalCount > 0 && (
                  <span
                    aria-label={`${pendingOrProcessingWithdrawalCount} pending or processing withdrawals`}
                    className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-semibold text-amber-200"
                  >
                    {pendingOrProcessingWithdrawalCount > 99 ? "99+" : pendingOrProcessingWithdrawalCount}
                  </span>
                )}
                {item.label === "Support tickets" && unreadTicketCount > 0 && (
                  <span className="ml-auto rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs text-cyan-200">{unreadTicketCount > 99 ? "99+" : unreadTicketCount}</span>
                )}
                {item.label === "Notifications" && unreadNotificationCount > 0 && (
                  <span
                    aria-label={`${unreadNotificationCount} unread notifications`}
                    className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-semibold text-amber-200"
                  >
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                )}
              </button>
            ))}
            <div className="my-2 border-t border-white/[0.08]" />
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); void handleSignOut(); }}
              disabled={signingOut}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-300 transition hover:bg-red-400/[0.07] disabled:opacity-50"
            >
              <span className="w-5 text-center" aria-hidden="true">↗</span>
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </nav>
        </>
      )}

      <div className={`mx-auto w-full ${isTicketChatOpen ? "max-w-none flex min-h-0 flex-1 flex-col overflow-hidden !p-0" : "max-w-[1600px] p-4 sm:p-7 lg:p-10"}`}>
        {/* The account hero belongs to Overview; other sections have focused headers. */}
        {activeSection === "Settings" || activeSection === "Withdrawals" || activeSection === "Notifications" || isTicketChatOpen ? null : activeSection === "Settings" ? (
          <section className="relative isolate mb-6 min-h-0 overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-[#071a31] via-[#08203b] to-[#071525] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] sm:rounded-3xl sm:p-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-400/[0.08] blur-3xl sm:-right-8 sm:-top-12 sm:h-64 sm:w-64" />
              <div className="absolute bottom-0 right-[8%] h-32 w-32 rounded-full bg-cyan-400/[0.06] blur-3xl sm:h-44 sm:w-44" />
              <svg viewBox="0 0 420 420" fill="none" className="absolute -right-14 top-1/2 h-[190px] w-[190px] -translate-y-1/2 opacity-40 sm:-right-8 sm:h-[280px] sm:w-[280px] sm:opacity-75 lg:h-[310px] lg:w-[310px]" aria-hidden="true">
                <defs>
                  <linearGradient id="profileShield" x1="112" y1="62" x2="318" y2="344" gradientUnits="userSpaceOnUse"><stop stopColor="#8BE9FF"/><stop offset=".48" stopColor="#168BFF"/><stop offset="1" stopColor="#0C3E91"/></linearGradient>
                  <radialGradient id="profileGlow"><stop stopColor="#0EA5E9" stopOpacity=".32"/><stop offset="1" stopColor="#0EA5E9" stopOpacity="0"/></radialGradient>
                  <linearGradient id="profileOrbit" x1="72" y1="120" x2="350" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#67E8F9" stopOpacity=".8"/><stop offset="1" stopColor="#2563EB" stopOpacity=".12"/></linearGradient>
                </defs>
                <circle cx="226" cy="210" r="174" fill="url(#profileGlow)"/>
                <ellipse cx="226" cy="228" rx="150" ry="72" stroke="url(#profileOrbit)" strokeWidth="1.5" transform="rotate(-24 226 228)"/>
                <ellipse cx="226" cy="228" rx="130" ry="58" stroke="#38BDF8" strokeOpacity=".25" transform="rotate(32 226 228)"/>
                <circle cx="103" cy="174" r="4" fill="#67E8F9"/><circle cx="337" cy="270" r="4" fill="#60A5FA"/><circle cx="291" cy="90" r="3" fill="#A5F3FC"/>
                <path d="M226 72 306 106V177C306 237 273 279 226 305C179 279 146 237 146 177V106L226 72Z" fill="#061A31" fillOpacity=".92" stroke="url(#profileShield)" strokeWidth="3"/>
                <path d="M226 88 291 116V177C291 225 266 259 226 283C186 259 161 225 161 177V116L226 88Z" fill="url(#profileShield)" fillOpacity=".18" stroke="#67E8F9" strokeOpacity=".6" strokeWidth="1.5"/>
                <circle cx="226" cy="157" r="23" fill="#7DD3FC" fillOpacity=".95"/>
                <path d="M184 222C187 197 202 185 226 185C250 185 265 197 268 222V230H184V222Z" fill="#7DD3FC" fillOpacity=".95"/>
                <rect x="300" y="95" width="48" height="54" rx="13" fill="#0B2744" stroke="#38BDF8" strokeOpacity=".75"/>
                <path d="M316 119V112C316 107 320 103 324 103C329 103 333 107 333 112V119M313 119H336V137H313V119Z" stroke="#BAE6FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="291" y="284" width="52" height="52" rx="13" fill="#0B2744" stroke="#38BDF8" strokeOpacity=".7"/>
                <path d="M317 296V301M317 319V324M305 310H310M324 310H329M309 302L312 305M322 315L325 318M325 302L322 305M312 315L309 318" stroke="#BAE6FD" strokeWidth="2.5" strokeLinecap="round"/>
                <ellipse cx="226" cy="323" rx="91" ry="15" fill="#0EA5E9" fillOpacity=".13"/>
                <path d="M152 320C169 336 283 336 300 320" stroke="#38BDF8" strokeOpacity=".45" strokeWidth="2"/>
              </svg>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
            </div>
            <div className="relative z-10 w-full sm:max-w-[68%] lg:max-w-[62%]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-2.5 py-1 text-[11px] font-medium text-emerald-200 sm:mb-4 sm:px-3 sm:py-1.5 sm:text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.7)]" />
                Account connected
              </div>
              <div className="flex min-w-0 items-center gap-3 border-b border-white/[0.09] pb-3 sm:gap-4 sm:pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-200/50 bg-gradient-to-br from-indigo-200 to-blue-300 text-xl font-semibold text-blue-700 shadow-[0_0_22px_rgba(59,130,246,0.16)] sm:h-16 sm:w-16 sm:text-3xl">
                  {(userEmail.charAt(0) || userName.charAt(0) || "U").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="max-w-full break-all text-sm font-semibold tracking-tight text-white sm:text-xl">{userEmail || "Account email unavailable"}</h2>
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">Client Account</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:mt-4 sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/[0.08] text-sky-200 sm:h-9 sm:w-9 sm:rounded-xl">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20H5Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="min-w-0"><p className="text-[10px] text-slate-400 sm:text-xs">Full name</p><p className="mt-0.5 break-words text-xs font-medium text-white sm:mt-1 sm:text-base">{userName}</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/20 bg-sky-300/[0.08] text-sky-200 sm:h-9 sm:w-9 sm:rounded-xl">
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <div className="min-w-0"><p className="text-[10px] text-slate-400 sm:text-xs">Email address</p><p className="mt-0.5 break-all text-xs font-medium text-white sm:mt-1 sm:text-base">{userEmail || "Email unavailable"}</p></div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="relative isolate mb-8 overflow-hidden rounded-3xl border border-cyan-200/[0.12] bg-gradient-to-br from-[#10253a]/95 via-[#0b1b2d]/95 to-[#091321] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-cyan-300/[0.09] blur-3xl sm:h-96 sm:w-96" />
              <div className="absolute bottom-[-7rem] right-[18%] h-56 w-56 rounded-full bg-teal-300/[0.07] blur-3xl" />
              <svg viewBox="0 0 520 360" fill="none" className="absolute -right-24 -top-12 hidden h-[360px] w-[520px] opacity-70 sm:block" preserveAspectRatio="xMidYMid meet">
                <defs><linearGradient id="heroLine" x1="80" y1="20" x2="450" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#67E8F9" stopOpacity=".5"/><stop offset="1" stopColor="#2DD4BF" stopOpacity=".08"/></linearGradient><radialGradient id="heroGlow"><stop stopColor="#22D3EE" stopOpacity=".16"/><stop offset="1" stopColor="#22D3EE" stopOpacity="0"/></radialGradient></defs>
                <circle cx="340" cy="150" r="150" fill="url(#heroGlow)"/><circle cx="340" cy="150" r="112" stroke="url(#heroLine)" strokeWidth="1.2"/><circle cx="340" cy="150" r="82" stroke="url(#heroLine)" strokeWidth="1" strokeDasharray="4 8"/><circle cx="340" cy="150" r="52" stroke="url(#heroLine)" strokeWidth="1.2"/><path d="M340 90 382 108V145C382 177 364 198 340 211C316 198 298 177 298 145V108L340 90Z" fill="#0B1B2D" fillOpacity=".82" stroke="#67E8F9" strokeOpacity=".6" strokeWidth="1.5"/><path d="m322 149 12 12 25-27" stroke="#99F6E4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M35 275 105 225 155 244 215 178 260 194 300 142 355 160 415 88 490 58" stroke="url(#heroLine)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M35 295 105 245 155 264 215 198 260 214 300 162 355 180 415 108 490 78" stroke="url(#heroLine)" strokeOpacity=".35" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                {[ [105,225], [215,178], [300,142], [415,88], [490,58] ].map(([cx,cy], i) => <circle key={i} cx={cx} cy={cy} r="3" fill="#99F6E4" fillOpacity=".8"/>)}
              </svg>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-200/25 to-transparent" />
            </div>
            <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300"/>{activeSection === "Withdrawals" ? "Account updates" : "Account connected"}</div>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">{activeSection === "Withdrawals" ? <>Stay informed about your account<span className="text-cyan-300">.</span></> : <>Welcome back, <span className="text-cyan-300">{userName}</span></>}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{activeSection === "Withdrawals" ? "Check notifications for important account messages, support replies, and withdrawal updates." : "Review your account information and get help with a transaction."}</p>
                {activeSection === "Withdrawals" && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.06] px-3 py-2 text-xs text-cyan-100">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9a6 6 0 0 0-12 0v.75a8.967 8.967 0 0 1-2.31 6.022 23.848 23.848 0 0 0 5.455 1.31m5.712 0a24.255 24.255 0 0 1-5.712 0m5.712 0a3 3 0 1 1-5.712 0" /></svg>
                    {unreadNotificationCount > 0 ? `${unreadNotificationCount} unread account ${unreadNotificationCount === 1 ? "update" : "updates"}` : "No unread account updates"}
                  </div>
                )}
              </div>
              <button onClick={() => { if (activeSection === "Withdrawals") { selectSection("Notifications"); } else { selectSection("Support tickets"); setShowTicketForm(true); } setSuccessMessage(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-5 py-3 text-sm font-semibold text-[#06111d] shadow-lg shadow-cyan-950/20 transition duration-200 hover:-translate-y-0.5 hover:from-cyan-200 hover:to-teal-200 active:translate-y-0">{activeSection === "Withdrawals" ? <><span>View notifications</span><span aria-hidden="true">→</span></> : <><span className="text-lg">+</span>Open support ticket</>}</button>
            </div>
          </section>
        )}

        {successMessage && !isTicketChatOpen && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm leading-6 text-emerald-200"
          >
            {successMessage}
          </div>
        )}

        {/* Overview */}
        {activeSection === "Overview" && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>div:nth-child(2)]:border-amber-300/15 [&>div:nth-child(2)]:from-[#2b261f] [&>div:nth-child(2)]:via-[#111d2c] [&>div:nth-child(3)]:border-blue-300/15 [&>div:nth-child(3)]:from-[#142c49] [&>div:nth-child(3)]:via-[#0a1c30] [&>div:nth-child(4)]:border-cyan-300/15 [&>div:nth-child(4)]:from-[#10343b] [&>div:nth-child(4)]:via-[#0a1c30]">
              <MetricCard
                title="Withdrawal records"
                value={withdrawalsLoading ? "—" : String(transactions.length)}
                description="Records linked to your account"
                icon="↗"
              />
              <MetricCard
                title="Pending or processing"
                value={withdrawalsLoading ? "—" : String(pendingOrProcessingWithdrawalCount)}
                description="Records awaiting an update"
                icon="◷"
              />
              <MetricCard
                title="Open support tickets"
                value={ticketsLoading ? "—" : String(activeTickets.length)}
                description="Conversations still in progress"
                icon="▤"
              />
              <MetricCard
                title="Unread notifications"
                value={notificationsLoading ? "—" : String(unreadNotificationCount)}
                description="Account updates to review"
                icon="♧"
              />
            </section>

            <section className="mt-6">
              <article className="group relative isolate overflow-hidden rounded-[1.75rem] border border-cyan-200/[0.16] bg-[radial-gradient(ellipse_at_88%_15%,rgba(34,211,238,0.14),transparent_35%),linear-gradient(135deg,#102b40_0%,#0a1c2e_55%,#071321_100%)] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.24)] transition duration-300 hover:border-cyan-200/25 hover:shadow-[0_26px_70px_rgba(0,0,0,0.3)] sm:p-7 lg:p-8">
                <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/[0.09] blur-3xl transition duration-500 group-hover:bg-cyan-300/[0.15] sm:h-80 sm:w-80" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-8 h-64 w-64 rounded-full border border-cyan-100/[0.08] sm:right-24 sm:h-80 sm:w-80" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full border border-cyan-100/[0.06] sm:right-32 sm:h-60 sm:w-60" />
                <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 sm:justify-start">
                      <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-cyan-100/[0.07] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-cyan-100 sm:text-[11px]">
                        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-200 opacity-40"/><span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-200"/></span>
                        {nextStep.eyebrow}
                      </span>
                      <div className="flex items-center gap-2">
                        {nextStep.section === "Withdrawals" && latestPendingWithdrawal && (
                          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${latestPendingWithdrawal.status === "Processing" ? "border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100" : "border-amber-200/20 bg-amber-200/[0.08] text-amber-100"}`}>
                            {latestPendingWithdrawal.status}
                          </span>
                        )}
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-100/15 bg-[#061726]/70 text-cyan-100 shadow-[0_10px_30px_rgba(0,0,0,0.18)] sm:hidden">
                          {nextStep.section === "Withdrawals" ? (
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M8 7h9v9" /></svg>
                          ) : (
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6"><path d="M12 3v18M3 12h18" strokeLinecap="round"/><circle cx="12" cy="12" r="9"/></svg>
                          )}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-5 max-w-2xl text-2xl font-semibold leading-tight tracking-[-0.035em] text-white sm:mt-6 sm:text-3xl">{nextStep.title}</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">{nextStep.detail}</p>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="mt-6 inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-300 via-cyan-300 to-teal-300 px-5 py-3 text-sm font-semibold text-[#06111d] shadow-[0_12px_28px_rgba(34,211,238,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(34,211,238,0.24)] active:translate-y-0 sm:mt-7"
                    >
                      {nextStep.action}<span aria-hidden="true" className="text-base transition-transform group-hover:translate-x-0.5">→</span>
                    </button>
                  </div>
                  <div aria-hidden="true" className="relative hidden h-36 w-36 shrink-0 place-items-center sm:grid lg:mr-5 lg:h-44 lg:w-44">
                    <span className="absolute inset-0 rounded-full border border-cyan-100/[0.11]" />
                    <span className="absolute inset-4 rounded-full border border-cyan-100/[0.08]" />
                    <span className="absolute inset-8 rounded-full border border-dashed border-cyan-100/[0.12]" />
                    <span className="grid h-20 w-20 place-items-center rounded-[1.7rem] border border-cyan-100/20 bg-[#071a2a]/85 text-cyan-100 shadow-[0_0_45px_rgba(34,211,238,0.12)] lg:h-24 lg:w-24">
                      {nextStep.section === "Withdrawals" ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" className="h-9 w-9 lg:h-11 lg:w-11"><path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M8 7h9v9" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" className="h-9 w-9 lg:h-11 lg:w-11"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>
                      )}
                    </span>
                    <span className="absolute right-1 top-5 h-2.5 w-2.5 rounded-full bg-teal-200 shadow-[0_0_14px_rgba(153,246,228,0.8)]" />
                    <span className="absolute bottom-5 left-2 h-1.5 w-1.5 rounded-full bg-cyan-200/80" />
                  </div>
                </div>
              </article>
            </section>

            <section className="mt-8" aria-labelledby="recent-activity-title">
              <header className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <h3 id="recent-activity-title" className="text-lg font-semibold text-white">Recent activity</h3>
                  <p className="mt-1 text-sm text-slate-400">Account, withdrawal, and support updates</p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">{recentActivity.length} updates</span>
              </header>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 sm:grid-cols-[minmax(150px,0.85fr)_minmax(0,1.5fr)_minmax(120px,auto)] sm:px-4">
                <span>Activity</span><span className="hidden sm:block">Details</span><span className="hidden sm:block">Date</span>
              </div>
              {recentActivity.length > 0 ? (
                <ol className="scrollbar-hide max-h-[330px] divide-y divide-white/[0.07] overflow-y-auto overscroll-contain border-y border-white/[0.08] pr-1">
                  {recentActivity.map((item) => {
                    const activityIcon = item.kind === "notification" ? "♧" : item.kind === "withdrawal" ? "↗" : item.kind === "message" ? "↗" : "▤";
                    const activityTone = item.kind === "notification" ? "border-amber-200/15 bg-amber-200/[0.06] text-amber-100" : item.kind === "withdrawal" ? "border-cyan-200/15 bg-cyan-200/[0.06] text-cyan-100" : item.kind === "message" ? "border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100" : "border-blue-200/15 bg-blue-200/[0.06] text-blue-100";
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => { selectSection(item.section); setSuccessMessage(""); setShowTicketForm(false); }} className="grid w-full grid-cols-[minmax(0,1fr)] items-center gap-1 px-2 py-3 text-left transition hover:bg-white/[0.025] sm:grid-cols-[minmax(150px,0.85fr)_minmax(0,1.5fr)_minmax(120px,auto)] sm:gap-4 sm:px-4 sm:py-4">
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm " + activityTone}>{activityIcon}</span>
                            <span className="truncate text-sm font-medium text-slate-100">{item.title}</span>
                          </span>
                          <span className="line-clamp-2 break-words pl-12 text-xs leading-5 text-slate-400 sm:pl-0">{item.detail}</span>
                          <time className="pl-12 text-[11px] text-slate-500 sm:pl-0 sm:text-right" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="border-y border-white/[0.08] py-8 text-center text-sm text-slate-400">Your account activity will appear here.</p>
              )}
            </section>

            <section className="mt-8">
              <WithdrawalPayoutCard />
            </section>
          </>
        )}

        {/* Withdrawals */}
        {activeSection === "Withdrawals" && (
          <div className="space-y-5">
          <section className="relative isolate overflow-hidden rounded-2xl border border-cyan-200/[0.12] bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.12),transparent_42%),linear-gradient(125deg,#10263b,#0a1b2d_58%,#071625)] px-5 py-5 shadow-[0_16px_44px_rgba(0,0,0,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6">
            <div className="pointer-events-none absolute -right-8 -top-16 size-48 rounded-full border border-cyan-200/[0.08] sm:size-56" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200/75">Withdrawal center</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Track your withdrawals</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Review request amounts, destination wallets, and the latest status for each withdrawal.</p>
            </div>
            <div className="relative mt-4 flex shrink-0 items-center gap-2 sm:mt-0">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.07] text-cyan-100" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h16M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h8m-8 4h5"/></svg>
              </span>
              <span className="text-xs text-slate-400">{transactions.length} {transactions.length === 1 ? "record" : "records"}</span>
              {pendingOrProcessingWithdrawalCount > 0 && <span className="rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-2.5 py-1 text-xs font-semibold text-amber-100">{pendingOrProcessingWithdrawalCount} active</span>}
            </div>
          </section>

          <WithdrawalRecords records={transactions} loading={withdrawalsLoading} error={withdrawalsError} />
          {withdrawalsError && <button type="button" onClick={() => setDashboardRetryCount((value) => value + 1)} className="mt-3 rounded-xl border border-cyan-200/20 px-4 py-2 text-xs text-cyan-100">Try loading again</button>}
          </div>
        )}

        {/* Support tickets */}
        {activeSection === "Support tickets" && (
          <section className={`${isTicketChatOpen ? "flex min-h-0 flex-1 flex-col" : "grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"}`}>
            <div className={`rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)] p-5 sm:p-7 ${isTicketChatOpen ? "flex h-full min-h-0 flex-col overflow-hidden !rounded-none !border-0 !p-0" : ""}`}>
              <div className={`flex items-start justify-between gap-4 ${selectedTicketId ? "hidden" : ""}`}>
                <div>
                  <h2 className="text-lg font-semibold">
                    Your support tickets
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Submit a request and follow the conversation with our support team.
                  </p>
                </div>

                <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-200">
                  {ticketsLoading ? "Loading…" : `${tickets.length} total`}
                </span>
              </div>

              {!selectedTicketId && successMessage && (
                <p role="status" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 text-sm text-emerald-200">
                  {successMessage}
                </p>
              )}
              {!selectedTicketId && formError && !showTicketForm && (
                <p role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm text-rose-200">
                  {formError}
                </p>
              )}

              {!selectedTicketId && showTicketForm && (
                <form
                  onSubmit={handleTicketSubmit}
                  className="mt-6 space-y-5 border-t border-white/[0.08] pt-6"
                >
                  <div>
                    <h3 className="font-semibold">Request details</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Your request and replies are securely saved to your support conversation.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-name">
                        Full name *
                      </label>
                      <input
                        id="ticket-name"
                        required
                        maxLength={100}
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-email">
                        Email address *
                      </label>
                      <input
                        id="ticket-email"
                        type="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07]"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-category">
                        Issue category *
                      </label>
                      <select
                        id="ticket-category"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07]"
                      >
                        <option>Withdrawal delay</option>
                        <option>Failed withdrawal</option>
                        <option>Transaction not received</option>
                        <option>Deposit issue</option>
                        <option>Wallet connection issue</option>
                        <option>Other support request</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-amount">
                        Withdrawal amount
                      </label>
                      <input
                        id="ticket-amount"
                        type="number"
                        min="0"
                        step="any"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="e.g. 250"
                        className="w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-asset">
                        Crypto token *
                      </label>
                      <select
                        id="ticket-asset"
                        value={asset}
                        onChange={(event) => setAsset(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07]"
                      >
                        <option>USDT</option>
                        <option>BTC</option>
                        <option>ETH</option>
                        <option>USDC</option>
                        <option>BNB</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-network">
                        Network
                      </label>
                      <select
                        id="ticket-network"
                        value={network}
                        onChange={(event) => setNetwork(event.target.value)}
                        className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07]"
                      >
                        <option value="TRC20">Tron (TRC20)</option>
                        <option value="ERC20">Ethereum (ERC20)</option>
                        <option value="BEP20">BNB Smart Chain</option>
                        <option value="Bitcoin">Bitcoin</option>
                        <option value="Solana">Solana</option>
                        <option value="Unknown">Not sure</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-wallet">
                      Public wallet address (optional)
                    </label>
                    <input
                      id="ticket-wallet"
                      maxLength={200}
                      value={walletAddress}
                      onChange={(event) => setWalletAddress(event.target.value)}
                      placeholder="Public receiving address only"
                      className="w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                    />
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Never enter your seed phrase, private key, password,
                      or authentication code.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-hash">
                      Transaction hash (optional)
                    </label>
                    <input
                      id="ticket-hash"
                      maxLength={200}
                      value={transactionHash}
                      onChange={(event) => setTransactionHash(event.target.value)}
                      placeholder="Transaction ID, if available"
                      className="w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-slate-300" htmlFor="ticket-description">
                      Describe the issue *
                    </label>
                    <textarea
                      id="ticket-description"
                      required
                      minLength={10}
                      maxLength={3000}
                      rows={5}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Explain what happened and when..."
                      className="w-full resize-y rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 text-sm leading-6 outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
                    />
                  </div>

                  {formError && (
                    <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-300">
                      {formError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-4 py-3.5 text-sm font-semibold text-[#06111d] shadow-lg shadow-cyan-950/20 transition duration-200 hover:-translate-y-0.5 hover:from-cyan-200 hover:to-teal-200 hover:shadow-cyan-900/25 active:translate-y-0"
                  >
                    Submit support request
                  </button>
                </form>
              )}

              {!selectedTicketId && (
                <div className="mt-5">
                  {ticketsLoading ? <div role="status" className="space-y-3 py-2"><p className="text-xs text-slate-400">Loading your support tickets…</p>{[0, 1].map((item) => <div key={item} aria-hidden="true" className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]" />)}</div> : ticketsError ? <div role="alert" className="rounded-xl border border-amber-200/15 bg-amber-200/[0.04] p-4 text-sm text-amber-100">{ticketsError}<button type="button" onClick={() => setDashboardRetryCount((value) => value + 1)} className="ml-3 underline underline-offset-4">Try again</button></div> : <ClientTicketCards tickets={tickets} unreadByTicket={unreadByTicket} onOpen={setSelectedTicketId} onPrefetch={prefetchClientTicketMessages} />}
                </div>
              )}

              {selectedTicketId && tickets.some((ticket) => ticket.id === selectedTicketId) && (
                <section className={`rounded-xl border border-cyan-300/15 bg-[#071725]/70 p-4 sm:p-5 ${isTicketChatOpen ? "flex min-h-0 flex-1 flex-col overflow-hidden !rounded-none !border-0 !p-0" : "mt-6"}`}>
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
                    <div>
                      <h3 className="font-semibold text-white">Ticket conversation</h3>
                      <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${tickets.find((ticket) => ticket.id === selectedTicketId)?.status === "Waiting for client" ? "border-amber-300/20 bg-amber-300/10 text-amber-200" : tickets.find((ticket) => ticket.id === selectedTicketId)?.status === "In progress" ? "border-blue-300/20 bg-blue-300/10 text-blue-200" : "border-teal-300/20 bg-teal-300/10 text-teal-200"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{tickets.find((ticket) => ticket.id === selectedTicketId)?.status}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedTicketId(null)}
                        aria-label="Close conversation"
                        className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-lg text-slate-300 transition hover:border-cyan-200/25 hover:bg-white/[.04]"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {(ticketConversationError || ticketConversationReconnecting) && (
                    <p role="status" className="shrink-0 px-4 py-2 text-xs text-amber-200 sm:px-6">
                      {ticketConversationError || "Reconnecting to live messages…"}
                      {ticketConversationError && <button type="button" onClick={() => void reloadClientTicketMessages()} className="ml-3 rounded-lg border border-amber-200/25 px-2.5 py-1 font-semibold text-amber-100 transition hover:bg-amber-200/10">Refresh conversation</button>}
                    </p>
                  )}
                  {loadingTicketMessages ? (
                    <p className={`py-6 text-sm text-slate-400 ${isTicketChatOpen ? "flex-1 px-4 sm:px-6" : ""}`}>Loading conversation...</p>
                  ) : ticketMessages.length === 0 ? (
                    <p className={`py-6 text-sm text-slate-400 ${isTicketChatOpen ? "flex-1 px-4 sm:px-6" : ""}`}>
                      {ticketConversationError ? "Your messages will appear here once the connection is restored." : "No replies yet. You can send a message to the support team below."}
                    </p>
                  ) : (
                    <div ref={clientConversationScrollRef} onScroll={(event) => {
                      const element = event.currentTarget;
                      clientFollowMessagesRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
                      if (clientFollowMessagesRef.current && selectedTicketId && document.visibilityState === "visible" && !popupNotification && !ticketPhotoViewerUrl && !selectedNotification && !mobileMenuOpen) markTicketMessagesRead(selectedTicketId, ticketMessages);
                    }} className={`mt-4 space-y-3 overflow-y-auto overscroll-contain scrollbar-hide ${isTicketChatOpen ? "min-h-0 flex-1 px-4 sm:px-6" : "max-h-[420px]"}`}>
                      {ticketMessages.map((message) => {
                        const isOwnMessage = message.sender_id === currentUserId;
                        const content = parseTicketMessage(message.message);
                        const photoBelongsToTicket = content.photoPath?.startsWith(
                          `${message.ticket_id}/`
                        ) ?? false;
                        const photoUrl = content.photoPath
                          ? ticketPhotoUrls[content.photoPath]
                          : undefined;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <article
                              className={`w-fit max-w-[96%] rounded-2xl border px-3.5 pb-2.5 pt-2 shadow-sm sm:max-w-[42rem] ${
                                isOwnMessage
                                  ? "rounded-br-md border-sky-300/20 bg-[#24527a]"
                                  : "rounded-bl-md border-white/[0.07] bg-[#142334]"
                              }`}
                            >
                              <div className="mb-0.5 flex items-center justify-between gap-4">
                                <p className={`text-[10px] font-semibold ${isOwnMessage ? "text-sky-200" : "text-emerald-400"}`}>
                                  {isOwnMessage ? (
                                    "You"
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5">
                                      Support
                                      <svg
                                        viewBox="0 0 24 24"
                                        role="img"
                                        aria-label="Verified support account"
                                        className="h-4 w-4 shrink-0 text-emerald-400"
                                      >
                                        <path
                                          fill="currentColor"
                                          fillRule="evenodd"
                                          clipRule="evenodd"
                                          d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                                        />
                                      </svg>
                                    </span>
                                  )}
                                </p>
                              </div>
                              {content.text && (
                                <p className="whitespace-pre-wrap break-words text-sm leading-5 text-slate-100 [overflow-wrap:anywhere]">
                                  {content.text}
                                  {!content.photoPath && (
                                    <time className="float-right ml-2 mt-1 whitespace-nowrap text-[10px] leading-4 text-slate-300/70">
                                      {formatChatTime(message.created_at)}
                                    </time>
                                  )}
                                </p>
                              )}
                              {content.photoPath && (
                                !photoBelongsToTicket ? (
                                  <p className="mt-2 text-xs text-slate-400">
                                    This photo is unavailable.
                                  </p>
                                ) : photoUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setTicketPhotoViewerUrl(photoUrl)}
                                    className="mt-2 block max-w-full overflow-hidden rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                    aria-label="View attached photo in chat"
                                  >
                                    <img
                                      src={photoUrl}
                                      alt={isOwnMessage ? "Your attached photo" : "Photo from support"}
                                      loading={ticketPhotoPaths.slice(-2).includes(content.photoPath!) ? "eager" : "lazy"}
                                      decoding="async"
                                      onError={() => void retryTicketPhoto(content.photoPath!)}
                                      onLoad={() => { const panel = clientConversationScrollRef.current; if (panel && clientFollowMessagesRef.current) panel.scrollTop = panel.scrollHeight; }}
                                      className="max-h-72 w-auto max-w-full rounded-xl object-contain"
                                    />
                                  </button>
                                ) : content.photoPath in ticketPhotoUrls ? (
                                  <p className="mt-2 text-xs text-slate-400">
                                    This photo is unavailable.
                                  </p>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-400">
                                    Loading attached photo…
                                  </p>
                                )
                              )}
                              {(!content.text || content.photoPath) && (
                                <time className="mt-1 block whitespace-nowrap text-right text-[10px] leading-4 text-slate-300/70">
                                  {formatChatTime(message.created_at)}
                                </time>
                              )}
                            </article>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form onSubmit={handleClientTicketReply} className={`shrink-0 border-t border-white/[0.07] bg-gradient-to-b from-[#0b1c2b]/95 to-[#071421] px-4 pb-4 pt-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5 ${isTicketChatOpen ? "mt-0" : "mt-5"}`}>
                    <label htmlFor="ticket-reply" className="sr-only">Write a message to support</label>
                    <input
                      ref={ticketPhotoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleTicketPhotoSelection}
                      aria-label="Choose a photo attachment"
                    />
                    {ticketReplyPhoto && (
                      <div className="mb-2 flex min-w-0 items-center gap-2 text-xs text-slate-400">
                        <span className="max-w-[220px] truncate">{ticketReplyPhoto.name}</span>
                        <button type="button" onClick={() => setTicketReplyPhoto(null)} disabled={sendingTicketReply} className="shrink-0 text-rose-200 hover:text-rose-100 disabled:opacity-50">Remove</button>
                      </div>
                    )}
                    <div className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-white/[0.11] bg-[#17212b] px-3 shadow-inner shadow-black/20 transition focus-within:border-cyan-200/40 focus-within:ring-2 focus-within:ring-cyan-300/10">
                      <button type="button" onClick={() => ticketPhotoInputRef.current?.click()} disabled={sendingTicketReply} aria-label="Attach a photo" title="Attach a photo" className="grid size-10 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/50 disabled:cursor-not-allowed disabled:opacity-50">
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-6" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m7.5 12.75 6.97-6.97a3 3 0 1 1 4.24 4.24l-8.03 8.03a4.5 4.5 0 0 1-6.36-6.36l8.13-8.13" />
                        </svg>
                      </button>
                      <textarea
                        id="ticket-reply"
                        value={ticketReply}
                        onChange={(event) => handleClientTicketReplyChange(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (ticketReply.trim() || ticketReplyPhoto) event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        rows={1}
                        maxLength={10000}
                        placeholder="Write a message..."
                        className="max-h-28 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-sm leading-5 text-white outline-none placeholder:text-slate-400"
                      />
                      {(ticketReply.trim() || ticketReplyPhoto) && (
                        <button type="submit" disabled={sendingTicketReply} aria-label={sendingTicketReply ? "Sending message" : "Send message"} title="Send message" className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-400 text-[#062017] shadow-md shadow-emerald-950/25 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17212b] disabled:cursor-not-allowed disabled:opacity-60">
                          {sendingTicketReply ? <span className="text-xs font-bold">…</span> : (
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-5"><path d="M3.4 20.7 21 12 3.4 3.3l.1 6.8 12 1.9-12 1.9-.1 6.8Z" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  </form>
                </section>
              )}
            </div>

            <aside className={`rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)] p-5 sm:p-6 ${selectedTicketId ? "hidden" : ""}`}>
              <h3 className="font-semibold">Before you contact support</h3>
              <div className="mt-5 space-y-4">
                {[
                  {
                    title: "Keep your reference",
                    text: "Save your transaction hash if one is available.",
                  },
                  {
                    title: "Verify the network",
                    text: "Make sure the token and blockchain network match.",
                  },
                  {
                    title: "Protect your wallet",
                    text: "Support should never ask for your private keys or recovery phrase.",
                  },
                ].map((item, index) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-300/10 text-sm text-cyan-200">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        )}

        {/* Notifications */}
        {activeSection === "Notifications" && (
          <section className="overflow-hidden rounded-3xl border border-cyan-200/[0.12] bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.09),transparent_38%),linear-gradient(145deg,#0c2238_0%,#081a2c_56%,#061321_100%)] shadow-[0_20px_55px_rgba(0,0,0,0.24)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex min-w-0 items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.08] text-cyan-200 shadow-inner shadow-cyan-200/[0.04]">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9a6 6 0 0 0-12 0v.75a8.967 8.967 0 0 1-2.31 6.022 23.848 23.848 0 0 0 5.455 1.31m5.712 0a24.255 24.255 0 0 1-5.712 0m5.712 0a3 3 0 1 1-5.712 0" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-200/75">Account updates</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-white sm:text-xl">Notifications</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-400">
                    {successMessage || (notifications.some((item) => !item.is_popup) ? "Updates and messages for your account." : "Important updates for your account will appear here.")}
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-100">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
                {notifications.filter((item) => !item.is_popup).length} {notifications.filter((item) => !item.is_popup).length === 1 ? "notice" : "notices"}
              </span>
            </header>

            <div className="p-4 sm:p-6">
            {notificationReadError && (
              <p role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm text-rose-200">
                {notificationReadError}
              </p>
            )}
            {notifications.some((item) => !item.is_popup) ? (
              <div className="space-y-3">
                {notificationsLoading && <p role="status" className="py-6 text-center text-sm text-slate-400">Loading your notifications…</p>}
                {notificationsError && <p role="alert" className="py-3 text-sm text-amber-200">{notificationsError}<button type="button" onClick={() => setDashboardRetryCount((value) => value + 1)} className="ml-3 underline">Try again</button></p>}
                {notifications.filter((item) => !item.is_popup).map((item) => {
                  const appearance = item.type === "success"
                    ? { label: "Success", icon: "✓", color: "emerald" }
                    : item.type === "warning"
                      ? { label: "Update", icon: "!", color: "amber" }
                      : item.type === "error"
                        ? { label: "Action needed", icon: "!", color: "rose" }
                        : { label: "Information", icon: "i", color: "cyan" };
                  const tone = appearance.color === "emerald"
                    ? "border-emerald-200/15 bg-emerald-300/[0.07] text-emerald-200"
                    : appearance.color === "amber"
                      ? "border-amber-200/15 bg-amber-300/[0.07] text-amber-100"
                      : appearance.color === "rose"
                        ? "border-rose-200/15 bg-rose-300/[0.07] text-rose-200"
                        : "border-cyan-200/15 bg-cyan-300/[0.07] text-cyan-100";
                  const accent = appearance.color === "emerald"
                    ? "bg-emerald-300"
                    : appearance.color === "amber"
                      ? "bg-amber-300"
                      : appearance.color === "rose"
                        ? "bg-rose-300"
                        : "bg-cyan-300";
                  const needsFullMessage = item.message.length > 220;

                  return (
                    <article
                      key={item.id}
                      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-[0_10px_28px_rgba(0,0,0,0.12)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(0,0,0,0.2)] sm:p-5 ${
                        item.read_at
                          ? "border-white/[0.08] bg-gradient-to-br from-[#10253a] to-[#0a1a2b] hover:border-cyan-200/20"
                          : "border-cyan-200/20 bg-gradient-to-br from-[#123149] to-[#0b2032] hover:border-cyan-200/35"
                      }`}
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} />
                      <div className="flex items-start gap-3.5 sm:gap-4">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-bold ${tone}`}>
                          {appearance.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="break-words text-base font-semibold leading-6 text-white sm:text-[17px]">{item.title}</h3>
                                {!item.read_at && <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">New</span>}
                              </div>
                            </div>
                            <time className="shrink-0 text-xs leading-5 text-slate-400 sm:text-right">
                              {new Date(item.created_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </time>
                          </div>
                          <p className={`mt-2.5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200 sm:text-[15px] ${needsFullMessage ? "line-clamp-3" : ""}`}>{item.message}</p>
                          {needsFullMessage && (
                            <button
                              type="button"
                              onClick={() => setSelectedNotification(item)}
                              className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-cyan-200/15 bg-cyan-200/[0.06] px-3 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.1]"
                            >
                              View all <span aria-hidden="true">→</span>
                            </button>
                          )}
                          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${tone}`}>
                              {appearance.label}
                            </span>
                            <span className="text-[11px] text-slate-500">CustodialSupport</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#071726]/55 px-5 py-10 text-center sm:py-12">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/10 bg-cyan-300/[0.05] text-cyan-200/80">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9a6 6 0 0 0-12 0v.75a8.967 8.967 0 0 1-2.31 6.022 23.848 23.848 0 0 0 5.455 1.31m5.712 0a24.255 24.255 0 0 1-5.712 0m5.712 0a3 3 0 1 1-5.712 0" />
                  </svg>
                </span>
                <h3 className="mt-4 text-sm font-semibold text-slate-200">You’re all caught up</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">There are no notifications yet. New account updates will show here.</p>
              </div>
            )}
            </div>
          </section>
        )}

        {/* Settings */}
        {activeSection === "Settings" && (
          <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-cyan-200/[0.13] bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.09),transparent_38%),linear-gradient(145deg,#0b2033,#081827_58%,#061321)] shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200/75">Your account</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Settings & security</h2>
                <p className="mt-1 text-sm text-slate-400">Manage your profile, account access, and updates.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-100">
                <span className="size-1.5 rounded-full bg-emerald-300" /> Account connected
              </span>
            </header>

            <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.15fr_.85fr]">
              <section className="rounded-2xl border border-white/[0.08] bg-[#071726]/65 p-4 sm:p-5" aria-labelledby="profile-details-heading">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.08] text-base font-semibold text-cyan-100">{(userName.charAt(0) || "U").toUpperCase()}</span>
                  <div className="min-w-0">
                    <h3 id="profile-details-heading" className="font-semibold text-white">Profile details</h3>
                    <p className="text-xs text-slate-400">Your account identity</p>
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">Full name</dt>
                    <dd className="mt-1.5 break-words text-sm font-medium text-white">{userName || "Name not provided"}</dd>
                  </div>
                  <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-[.13em] text-slate-500">Sign-in email</dt>
                    <dd className="mt-1.5 break-all text-sm font-medium text-white">{userEmail || "Email unavailable"}</dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#071726]/65 p-4 sm:p-5" aria-labelledby="security-heading">
                <h3 id="security-heading" className="font-semibold text-white">Account security</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">Keep your sign-in secure. We never display or store a readable password here.</p>
                <Link href="/forgot-password?returnTo=settings" className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.06] px-3.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-200/[0.12]">
                  Reset password <span aria-hidden="true">→</span>
                </Link>
              </section>

              <section className="rounded-2xl border border-white/[0.08] bg-[#071726]/65 p-4 sm:p-5" aria-labelledby="updates-heading">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 id="updates-heading" className="font-semibold text-white">Account updates</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-400">Review support replies, account notices, and withdrawal updates.</p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/[0.07] text-cyan-100" aria-hidden="true">♧</span>
                </div>
                <button type="button" onClick={() => { selectSection("Notifications"); setSuccessMessage(""); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.09] px-3.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-200/20 hover:bg-white/[0.035]">
                  View notifications
                  {unreadNotificationCount > 0 && <span className="rounded-full bg-cyan-200/15 px-2 py-0.5 text-[10px] text-cyan-100">{unreadNotificationCount} new</span>}
                </button>
              </section>

              <section className="flex flex-col justify-between gap-4 rounded-2xl border border-rose-200/10 bg-rose-200/[0.025] p-4 sm:flex-row sm:items-center sm:p-5" aria-labelledby="signout-heading">
                <div>
                  <h3 id="signout-heading" className="font-semibold text-white">Session</h3>
                  <p className="mt-1 text-xs text-slate-400">Sign out when you’re finished using this device.</p>
                </div>
                <button onClick={handleSignOut} disabled={signingOut} className="min-h-10 shrink-0 rounded-xl border border-rose-300/20 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/[0.08] disabled:opacity-50">
                  {signingOut ? "Signing out..." : "Sign out"}
                </button>
              </section>
            </div>
          </section>
        )}

        <footer className={`mt-10 border-t border-white/[0.08] pt-5 text-xs leading-6 text-slate-500 ${isTicketChatOpen ? "hidden" : ""}`}>
          <p>
            CustodialSupport · Keep your account credentials private.
          </p>
        </footer>
      </div>
    </div>
  </div>
  {ticketPhotoViewerUrl && (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setTicketPhotoViewerUrl(null);
      }}
    >
      <section role="dialog" aria-modal="true" aria-label="Attached ticket photo" className="relative flex max-h-[92dvh] w-full max-w-5xl items-center justify-center rounded-2xl border border-white/10 bg-[#071725] p-3 shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:p-5">
        <button type="button" onClick={() => setTicketPhotoViewerUrl(null)} aria-label="Close photo viewer" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-[#07111f]/90 text-xl text-white hover:bg-white/10">×</button>
        <img src={ticketPhotoViewerUrl} alt="Attached photo from the support conversation" className="max-h-[84dvh] max-w-full rounded-xl object-contain" />
      </section>
    </div>
  )}
  {selectedNotification && (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSelectedNotification(null);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="full-notification-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-cyan-200/15 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.1),transparent_42%),linear-gradient(145deg,#0c2238,#071725)] shadow-[0_30px_100px_rgba(0,0,0,.65)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.08] p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200/80">Account notification</p>
            <h2 id="full-notification-title" className="mt-2 break-words text-xl font-semibold text-white sm:text-2xl">{selectedNotification.title}</h2>
            <time className="mt-2 block text-xs text-slate-400">
              {new Date(selectedNotification.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </time>
          </div>
          <button type="button" onClick={() => setSelectedNotification(null)} aria-label="Close notification" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-slate-300 transition hover:border-cyan-200/25 hover:bg-white/[.05]">×</button>
        </header>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div className="min-h-32 rounded-2xl border border-white/[0.08] bg-[#102438]/80 p-5 sm:p-6">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200 sm:text-base sm:leading-8">{selectedNotification.message}</p>
          </div>
        </div>
      </section>
    </div>
  )}
  {popupNotification && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="client-announcement-title" className="w-full max-w-4xl rounded-3xl border border-cyan-200/15 bg-[#081a2a] p-5 shadow-[0_30px_100px_rgba(0,0,0,.55)] sm:p-8">
        <header className="flex items-start justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-300">CustodialSupport · Announcement</p><h2 id="client-announcement-title" className="mt-2 text-xl font-semibold text-white sm:text-2xl">{popupNotification.title}</h2></div>
          <button type="button" aria-label="Close announcement" onClick={() => void dismissPopupNotification()} className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 text-lg text-slate-300 transition hover:bg-white/[.05]">×</button>
        </header>
        <div className="my-6 border-t border-white/[.08]" />
        <div className="min-h-28 rounded-2xl border border-white/[.07] bg-white/[.02] p-5 sm:p-6"><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-200 sm:text-base">{popupNotification.message}</p></div>
      </section>
    </div>
  )}
</main>

);
}
