"use client";

export type ClientSupportTicket = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: "Open" | "In progress" | "Waiting for client" | "Resolved" | "Closed";
  createdAt: string;
  createdAtISO: string;
  amount?: string;
  asset?: string;
  network?: string;
  walletAddress?: string;
  transactionHash?: string;
};

type TicketActions = {
  onOpen: (ticketId: string) => void;
  onPrefetch?: (ticketId: string) => void | Promise<void>;
};

export type ClientTicketCardProps = TicketActions & {
  ticket: ClientSupportTicket;
  /** Unread replies from support for this ticket, calculated by the parent. */
  unreadCount?: number;
};

const ticketStatusStyles: Record<ClientSupportTicket["status"], string> = {
  Open: "border-cyan-200/15 bg-cyan-200/[0.07] text-cyan-200",
  "In progress": "border-blue-300/20 bg-blue-300/[0.08] text-blue-200",
  "Waiting for client": "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
  Resolved: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
  Closed: "border-slate-300/15 bg-slate-300/[0.06] text-slate-300",
};

type TicketDetail = { label: string; value: string };

function ticketContent(ticket: ClientSupportTicket) {
  const labels: Record<string, string> = {
    amount: "Amount",
    network: "Network",
    "wallet address": "Wallet address",
    "transaction reference": "Transaction reference",
  };
  const details: TicketDetail[] = [];
  const request: string[] = [];

  for (const line of ticket.description.split(/\r?\n/)) {
    const match = line.match(/^\s*(Amount|Network|Wallet address|Transaction reference):\s*(.*)\s*$/i);
    if (!match) {
      request.push(line);
      continue;
    }
    const value = match[2].trim();
    if (value) details.push({ label: labels[match[1].toLowerCase()], value });
  }

  // Older locally created tickets may keep these in separate fields.
  const fallback: TicketDetail[] = [
    { label: "Amount", value: ticket.amount ? [ticket.amount, ticket.asset].filter(Boolean).join(" ") : "" },
    { label: "Network", value: ticket.network ?? "" },
    { label: "Wallet address", value: ticket.walletAddress ?? "" },
    { label: "Transaction reference", value: ticket.transactionHash ?? "" },
  ];
  for (const detail of fallback) {
    if (detail.value.trim() && !details.some((item) => item.label === detail.label)) details.push(detail);
  }

  return { summary: request.join("\n").replace(/\n{3,}/g, "\n\n").trim(), details };
}

function formatTicketDate(ticket: ClientSupportTicket) {
  const date = new Date(ticket.createdAtISO);
  if (!Number.isNaN(date.getTime())) {
    return { label: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), value: ticket.createdAtISO };
  }
  return { label: ticket.createdAt.split(",")[0] || "Date unavailable", value: undefined };
}

function ConversationIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.5h9m-9 4h6M5 19l-2 2V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5Z" />
    </svg>
  );
}

export function ClientTicketCard({ ticket, unreadCount = 0, onOpen, onPrefetch }: ClientTicketCardProps) {
  const { summary, details } = ticketContent(ticket);
  const date = formatTicketDate(ticket);
  const title = ticket.subject.trim() || ticket.category.trim() || "Support request";
  const categoryIsDifferent = ticket.category.trim() && ticket.category.trim().toLowerCase() !== title.toLowerCase();
  const count = Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0;
  const compactDetails = details.filter((detail) => detail.label === "Amount" || detail.label === "Network");

  return (
    <article className={`relative min-w-0 overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,#102438_0%,#0a1b2c_55%,#071625_100%)] shadow-[0_10px_26px_rgba(0,0,0,0.12)] transition-colors ${count > 0 ? "border-cyan-200/20" : "border-white/[0.08] hover:border-cyan-200/15"}`}>
      {count > 0 && <span aria-hidden="true" className="absolute bottom-5 left-0 top-5 w-0.5 rounded-r-full bg-cyan-300/80" />}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-sky-200/15 bg-sky-200/[0.07] text-sky-200">
              <ConversationIcon className="size-[18px]" />
            </span>
            <div className="min-w-0">
              {categoryIsDifferent && <p className="mb-1 text-[10px] font-medium uppercase tracking-[.14em] text-slate-500 [overflow-wrap:anywhere]">{ticket.category}</p>}
              <h3 className="text-sm font-semibold leading-5 text-slate-100 [overflow-wrap:anywhere] sm:text-base sm:leading-6">{title}</h3>
            </div>
          </div>
          <span className={`inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium leading-4 sm:text-[11px] ${ticketStatusStyles[ticket.status]}`}>
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            {ticket.status}
          </span>
        </div>

        <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-[10px] text-slate-500 sm:text-[11px]">
          <span className="min-w-0 truncate font-mono" title={`Ticket ${ticket.id}`}>#{ticket.id.slice(0, 8)}</span>
          <time dateTime={date.value} className="shrink-0 whitespace-nowrap">{date.label}</time>
        </div>

        {summary && <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-300 [overflow-wrap:anywhere] sm:text-sm sm:leading-6">{summary}</p>}

        {compactDetails.length > 0 && (
          <dl className="mt-3 flex min-w-0 flex-wrap gap-x-5 gap-y-2 rounded-xl border border-white/[0.05] bg-[#051221]/40 px-3 py-2.5">
            {compactDetails.map((detail, index) => (
              <div key={`${detail.label}-${index}`} className="min-w-0">
                <dt className="text-[9px] font-medium uppercase tracking-[.13em] text-slate-500">{detail.label}</dt>
                <dd className="mt-0.5 text-xs font-medium text-slate-200 [overflow-wrap:anywhere]">{detail.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {(summary || details.length > 0) && (
          <details className="group mt-3">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md py-1 text-[11px] font-medium text-slate-400 outline-none transition hover:text-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-300/60 [&::-webkit-details-marker]:hidden">
              Request details
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3 transition-transform group-open:rotate-180" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" /></svg>
            </summary>
            <div className="mt-2 space-y-3 rounded-xl border border-white/[0.06] bg-[#051221]/50 p-3">
              {summary && <p className="whitespace-pre-wrap text-xs leading-6 text-slate-300 [overflow-wrap:anywhere]">{summary}</p>}
              {details.length > 0 && (
                <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {details.map((detail, index) => (
                    <div key={`${detail.label}-${index}`} className="min-w-0">
                      <dt className="text-[9px] font-medium uppercase tracking-[.12em] text-slate-500">{detail.label}</dt>
                      <dd className={`mt-1 text-xs leading-5 text-slate-200 [overflow-wrap:anywhere] ${detail.label === "Wallet address" || detail.label === "Transaction reference" ? "font-mono" : ""}`}>{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </details>
        )}
      </div>

      <footer className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] bg-[#061421]/30 px-4 py-3 sm:px-5">
        <span className="hidden items-center gap-1.5 text-[10px] text-slate-500 sm:flex"><span className="size-1 rounded-full bg-slate-500" aria-hidden="true" />Support conversation</span>
        <button
          type="button"
          onClick={() => onOpen(ticket.id)}
          onPointerEnter={() => void onPrefetch?.(ticket.id)}
          onFocus={() => void onPrefetch?.(ticket.id)}
          aria-label={`View conversation for ticket ${ticket.id.slice(0, 8)}${count > 0 ? `, ${count} unread ${count === 1 ? "reply" : "replies"} from support` : ""}`}
          className="inline-flex min-h-10 max-w-full items-center justify-center gap-2.5 rounded-xl border border-cyan-200/15 bg-cyan-200/[0.07] px-3.5 py-2 text-[11px] font-semibold text-cyan-100 outline-none transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.12] focus-visible:ring-2 focus-visible:ring-cyan-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071625] sm:text-xs"
        >
          <span>View conversation</span>
          {count > 0 && <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-cyan-200 px-1.5 text-[10px] font-bold leading-5 text-[#052032]" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
          <span aria-hidden="true" className="text-base font-normal leading-none">→</span>
        </button>
      </footer>
    </article>
  );
}

export type ClientTicketCardsProps = TicketActions & {
  tickets: ClientSupportTicket[];
  unreadByTicket?: Record<string, number>;
};

export default function ClientTicketCards({ tickets, unreadByTicket = {}, onOpen, onPrefetch }: ClientTicketCardsProps) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#061321]/35 px-5 py-8 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.05] text-cyan-200/70"><ConversationIcon className="size-5" /></span>
        <p className="mt-3 text-sm font-medium text-slate-200">No support tickets yet</p>
        <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-500">Create a request to start a conversation with the support team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => <ClientTicketCard key={ticket.id} ticket={ticket} unreadCount={unreadByTicket[ticket.id] ?? 0} onOpen={onOpen} onPrefetch={onPrefetch} />)}
    </div>
  );
}
