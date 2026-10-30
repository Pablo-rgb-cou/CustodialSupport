"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Transaction = {
id: string;
reference: string;
asset: string;
amount: string;
status: "Completed" | "Processing" | "Pending";
date: string;
};

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
status: "Open" | "In review" | "Resolved";
createdAt: string;
};

const demoTransactions: Transaction[] = [
{
id: "1",
reference: "DEMO-1041",
asset: "USDT",
amount: "250.00",
status: "Completed",
date: "Oct 28, 2026",
},
{
id: "2",
reference: "DEMO-1042",
asset: "ETH",
amount: "0.85",
status: "Processing",
date: "Oct 28, 2026",
},
{
id: "3",
reference: "DEMO-1043",
asset: "BTC",
amount: "0.012",
status: "Pending",
date: "Oct 27, 2026",
},
{
id: "4",
reference: "DEMO-1044",
asset: "USDC",
amount: "120.00",
status: "Completed",
date: "Oct 26, 2026",
},
];

const initialTickets: Ticket[] = [];

const navigation = [
{ label: "Overview", icon: "◫" },
{ label: "Withdrawals", icon: "↗" },
{ label: "Support tickets", icon: "▤" },
{ label: "Notifications", icon: "♧" },
{ label: "Settings", icon: "⚙" },
];

function StatusBadge({ status }: { status: string }) {
const styles: Record<string, string> = {
Completed:
"border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
Processing: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
Pending: "border-amber-400/20 bg-amber-400/10 text-amber-300",
Open: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
"In review": "border-amber-400/20 bg-amber-400/10 text-amber-300",
Resolved:
"border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
};

return (
<span
className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
    styles[status] ?? "border-white/10 bg-white/5 text-slate-300"
  }`}
>
<span className="h-1.5 w-1.5 rounded-full bg-current" />
{status}
</span>
);
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
  "▤": "M7 3h10l4 4v14H3V3h4 M7 3v5h10V3 M7 12h10 M7 16h7",
};
return (
<div className="group relative isolate min-h-[156px] overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#102941] via-[#0a1c30] to-[#071321] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:shadow-[0_20px_48px_rgba(0,0,0,0.27)] sm:p-6">
<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />
<div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full border border-cyan-200/[0.08] transition duration-700 group-hover:scale-110 group-hover:border-cyan-200/[0.16]" />
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

type DemoTestimonial = {
  id: number;
  name: string;
  initials: string;
  message: string;
  rating: number;
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
  // A shared Set prevents repeats between the payout and testimonial cards.
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

const testimonialOpeners = [
  "I appreciated how clearly the support team explained",
  "The support representative took time to walk me through",
  "Thank you for providing a helpful explanation of",
  "The communication made it easier to understand",
  "I found the guidance useful when reviewing",
  "The team responded professionally about",
  "I was glad to receive a clear update regarding",
  "The instructions helped me understand",
  "I appreciated the patient assistance with",
  "The support conversation clarified",
  "It was helpful to get more information about",
  "Thanks for taking the time to explain",
  "The team made the next steps clearer for",
  "I received a courteous response about",
  "The follow-up helped me make sense of",
  "I valued the straightforward communication about",
];

const testimonialTopics = [
  "the withdrawal review process",
  "the transaction details and next steps",
  "the information needed for my support request",
  "the status update on my ticket",
  "the network details for my transaction",
  "the documentation I should provide",
  "how to check a transaction reference",
  "the questions I had about my account",
  "the support process and expected updates",
  "the steps for tracking a request",
  "the details in my transaction record",
  "the information available about my request",
  "the process for following up with support",
  "how to find the correct transaction hash",
  "the account security steps I should follow",
  "the difference between a pending and completed status",
];

const testimonialClosers = [
  "The explanation was easy to follow.",
  "I knew what information to check next.",
  "The response was polite and helpful.",
  "I appreciate the clear communication.",
  "That made the process easier to understand.",
  "Thank you for taking the time to respond.",
  "The instructions were practical and straightforward.",
  "I appreciated having the next steps explained.",
  "It was useful to have the details laid out clearly.",
  "The response helped answer my questions.",
  "I felt better informed after the conversation.",
  "Thanks for the professional assistance.",
  "The follow-up information was helpful.",
  "I appreciate the courteous support.",
  "The guidance gave me a clearer picture of the process.",
  "It was helpful to know where to look for updates.",
];

const usedDemoMessages = new Set<string>();

function makeUniqueDemoMessage() {
  const maxCombinations = testimonialOpeners.length * testimonialTopics.length * testimonialClosers.length;
  for (let attempt = 0; attempt < maxCombinations; attempt += 1) {
    const opener = testimonialOpeners[Math.floor(Math.random() * testimonialOpeners.length)];
    const topic = testimonialTopics[Math.floor(Math.random() * testimonialTopics.length)];
    const closer = testimonialClosers[Math.floor(Math.random() * testimonialClosers.length)];
    const message = `${opener} ${topic}. ${closer}`;
    if (!usedDemoMessages.has(message)) {
      usedDemoMessages.add(message);
      return message;
    }
  }

  // This fallback is only reached after the combination pool is exhausted.
  const message = `Sample feedback ${usedDemoMessages.size + 1}: the support experience and information provided were useful to review.`;
  usedDemoMessages.add(message);
  return message;
}

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

function makeDemoTestimonial(id: number): DemoTestimonial {
  const name = uniqueAmericanName(id, 2);
  return {
    id,
    name,
    initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2),
    message: makeUniqueDemoMessage(),
    rating: 3 + Math.floor(Math.random() * 3),
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
    }, 5000);

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
          <h3 className="font-semibold text-white">Recent withdrawal activity</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Sample activity · new entries every 5 seconds
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Demo
        </span>
      </div>

      <div className="px-5 pb-2 pt-3 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-3 border-b border-white/[0.07] pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
          <span>Client</span>
          <span>USD / crypto equivalent</span>
          <span>Date</span>
        </div>
        <div aria-label="Sample withdrawal activity" className="divide-y divide-white/[0.055]">
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
                    <p className="mt-1 text-[10px] text-slate-500">Sample client</p>
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
      <div className="border-t border-white/[0.06] px-5 py-3 sm:px-6">
        <p className="text-[10px] leading-5 text-slate-500">
          Fictional sample activity, not verified customer payouts. Crypto equivalents are estimates based on market prices and are not transaction confirmations.
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          {priceUpdatedAt
            ? `Market prices updated ${priceUpdatedAt.toLocaleTimeString("en-US")}.`
            : priceUnavailable
              ? "Live prices are temporarily unavailable."
              : "Fetching live cryptocurrency prices…"}
        </p>
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

function DemoTestimonialCard() {
  const [testimonials, setTestimonials] = useState<DemoTestimonial[]>([]);
  const [counter, setCounter] = useState(1);
  const nextId = useRef(4);

  useEffect(() => {
    setTestimonials([
      makeDemoTestimonial(1),
      makeDemoTestimonial(2),
      makeDemoTestimonial(3),
    ]);
    nextId.current = 4;

    // Add one new sample review at the start, just like the withdrawal feed.
    // The previous cards shift along; only three cards remain visible.
    const testimonialTimer = window.setInterval(() => {
      const newTestimonial = makeDemoTestimonial(nextId.current++);
      setTestimonials((current) => [newTestimonial, ...current].slice(0, 3));
      setCounter((current) => current + 1);
    }, 10000);

    return () => window.clearInterval(testimonialTimer);
  }, []);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)]">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-white">Customer feedback</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Three sample reviews · rotates every 10 seconds
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
          Demo
        </span>
      </div>

      <div
        aria-live="polite"
        className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3"
      >
        {testimonials.map((testimonial, index) => (
          <article
            key={testimonial.id}
            className={`relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#102a46] via-[#0a1c31] to-[#071321] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/20 ${
              index === 0 ? "animate-[testimonial-in_450ms_ease-out]" : ""
            }`}
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-5 select-none font-serif text-7xl leading-none text-cyan-300/[0.06]">“</span>
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-xs font-semibold text-cyan-200"
                >
                  {testimonial.initials}
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-white">
                    {testimonial.name}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    Fictional sample review
                  </p>
                </div>
              </div>
            </div>

            <div
              className="mt-4 text-sm tracking-[0.12em] text-amber-300"
              aria-label={`${testimonial.rating} out of 5 sample stars`}
            >
              {"★".repeat(testimonial.rating)}
              <span className="text-slate-600">
                {"★".repeat(5 - testimonial.rating)}
              </span>
            </div>

            <blockquote className="mt-3 flex-1 text-sm leading-6 text-slate-300">
              “{testimonial.message}”
            </blockquote>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4 sm:px-6">
        <span className="text-[10px] leading-5 text-slate-500">
          Fictional generated review text for interface preview only.
        </span>
        <span className="shrink-0 text-xs text-cyan-200">
          {counter} new reviews · rotating
        </span>
      </div>
      <style jsx>{`
        @keyframes testimonial-in {
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
const [signingOut, setSigningOut] = useState(false);

const [activeSection, setActiveSection] = useState("Overview");
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
const [transactions, setTransactions] =
useState<Transaction[]>(demoTransactions);
const [tickets, setTickets] = useState<Ticket[]>(initialTickets);

const [showTicketForm, setShowTicketForm] = useState(false);
const [successMessage, setSuccessMessage] = useState("");
const [search, setSearch] = useState("");

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
let active = true;

async function loadUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!active) return;

  if (error || !user) {
    router.replace("/login");
    return;
  }

  const name =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Client";

  setUserName(name);
  setUserEmail(user.email ?? "");
  setFullName(name);
  setEmail(user.email ?? "");
  const { data: ticketRows, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id, subject, category, description, status, created_at")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });
  if (ticketError) {
    console.error("Could not load support tickets:", ticketError.message);
  } else {
    const mapped: Ticket[] = (ticketRows ?? []).map((row) => ({
      id: row.id,
      subject: row.subject,
      category: row.category,
      amount: "",
      asset: "",
      network: "",
      walletAddress: "",
      transactionHash: "",
      description: row.description,
      status: row.status === "resolved" || row.status === "closed" ? "Resolved" : row.status === "in_progress" || row.status === "waiting_for_client" ? "In review" : "Open",
      createdAt: new Date(row.created_at).toLocaleString(),
    }));
    setTickets(mapped);
  }
  setAuthLoading(false);
}

loadUser();

return () => {
  active = false;
};

}, [router]);

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
setActiveSection(label);
setMobileMenuOpen(false);
setSuccessMessage("");

if (label === "Support tickets") {
  setShowTicketForm(false);
}

if (label === "Overview") {
  setShowTicketForm(false);
}

if (label === "Notifications") {
  setSuccessMessage("You are all caught up.");
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
};
setTickets((current) => [newTicket, ...current]);
setShowTicketForm(false);
setActiveSection("Support tickets");
setSuccessMessage(`Your support ticket ${newTicket.id} has been submitted.`);

setAmount("");
setWalletAddress("");
setTransactionHash("");
setDescription("");

}

const filteredTransactions = transactions.filter((transaction) =>
  `${transaction.reference} ${transaction.asset} ${transaction.status}`
    .toLowerCase()
    .includes(search.toLowerCase())
);

if (authLoading) {
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
<main className="min-h-screen bg-[#020a14] text-white selection:bg-cyan-300/25 selection:text-cyan-50">
<div className="relative isolate flex min-h-screen overflow-x-clip bg-[radial-gradient(ellipse_at_72%_0%,rgba(14,165,233,0.14),transparent_34%),radial-gradient(ellipse_at_4%_56%,rgba(8,145,178,0.09),transparent_30%),linear-gradient(135deg,#020a14_0%,#07182a_48%,#020a14_100%)] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[linear-gradient(rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.025)_1px,transparent_1px)] before:bg-[size:56px_56px]">
{/* Sidebar */}
<aside className="sticky top-0 hidden h-screen w-[270px] shrink-0 self-start flex-col border-r border-cyan-200/[0.07] bg-[#04101e]/95 shadow-[12px_0_40px_rgba(0,0,0,0.12)] lg:flex">
<a href="/dashboard" className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6 transition hover:bg-white/[0.02]">
<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-200/20 bg-gradient-to-br from-cyan-300/20 to-blue-500/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
<svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className="h-7 w-7"><path d="M16 2.8 27 7v8.1c0 7.1-4.5 11.8-11 14.1C9.5 26.9 5 22.2 5 15.1V7l11-4.2Z" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="1.6"/><path d="m10.5 15.8 3.5 3.4 7.6-8" stroke="#99F6E4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
</span>
<span className="text-base font-bold">
Custodial<span className="text-cyan-300">Support</span>
</span>
</a>

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
              <span className="w-5 text-center text-base">
                {item.icon}
              </span>
              {item.label}
              {item.label === "Support tickets" && tickets.length > 0 && (
                <span className="ml-auto rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs text-cyan-200">
                  {tickets.length}
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
    <div className="min-w-0 flex-1">
      {/* Top navigation */}
      <header className="sticky top-0 z-40 flex min-h-20 items-center justify-between gap-4 border-b border-white/[0.08] bg-[#07111f]/95 px-4 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-dashboard-menu"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/40 lg:hidden"
          >
            {mobileMenuOpen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4 sm:h-5 sm:w-5" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Client workspace</p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
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
            className="absolute left-4 right-4 top-[5.5rem] z-30 rounded-2xl border border-white/[0.09] bg-[#0b1728]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:left-7 sm:right-7 lg:hidden"
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
                <span className="w-5 text-center text-base" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {item.label === "Support tickets" && tickets.length > 0 && (
                  <span className="ml-auto rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs text-cyan-200">{tickets.length}</span>
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

      <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-7 lg:p-10">
        {/* Contextual hero: account identity on Settings, welcome card elsewhere */}
        {activeSection === "Settings" ? (
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
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-3 py-1.5 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300"/>Account connected</div>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Welcome back, <span className="text-cyan-300">{userName}</span></h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Review your account information and get help with a transaction.</p>
              </div>
              <button onClick={() => { setActiveSection("Support tickets"); setShowTicketForm(true); setSuccessMessage(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-5 py-3 text-sm font-semibold text-[#06111d] shadow-lg shadow-cyan-950/20 transition duration-200 hover:-translate-y-0.5 hover:from-cyan-200 hover:to-teal-200 active:translate-y-0"><span className="text-lg">+</span>Open support ticket</button>
            </div>
          </section>
        )}

        {successMessage && (
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
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>div:nth-child(2)]:border-emerald-300/15 [&>div:nth-child(2)]:from-[#0c302f] [&>div:nth-child(2)]:via-[#0a202e] [&>div:nth-child(3)]:border-violet-300/15 [&>div:nth-child(3)]:from-[#201c42] [&>div:nth-child(3)]:via-[#0d1d32] [&>div:nth-child(4)]:border-amber-300/15 [&>div:nth-child(4)]:from-[#2b261f] [&>div:nth-child(4)]:via-[#111d2c]">
              <MetricCard
                title="Withdrawal records"
                value={String(transactions.length)}
                description="Demo records currently displayed"
                icon="↗"
              />
              <MetricCard
                title="Pending"
                value={String(
                  transactions.filter((item) => item.status === "Pending")
                    .length
                )}
                description="Awaiting a verified status update"
                icon="◷"
              />
              <MetricCard
                title="Completed"
                value={String(
                  transactions.filter(
                    (item) => item.status === "Completed"
                  ).length
                )}
                description="Sample completed records"
                icon="✓"
              />
              <MetricCard
                title="Support tickets"
                value={String(tickets.length)}
                description="Tickets created in this session"
                icon="▤"
              />
            </section>

            <section className="mt-8 grid items-start gap-6 xl:grid-cols-2">
              <WithdrawalPayoutCard />
              <DemoTestimonialCard />
            </section>
          </>
        )}

        {/* Withdrawals */}
        {activeSection === "Withdrawals" && (
          <section className="overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)]">
            <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h2 className="font-semibold">Withdrawal records</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Demo records only. No blockchain verification is
                  performed.
                </p>
              </div>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search reference, asset, status..."
                aria-label="Search withdrawal records"
                className="w-full rounded-xl border border-white/[0.09] bg-[#07111f]/80 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/[0.07] sm:max-w-xs"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Reference</th>
                    <th className="px-6 py-4 font-medium">Asset</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.055]">
                  {filteredTransactions.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-white/[0.025]">
                      <td className="px-6 py-4 text-slate-200">
                        {item.reference}
                      </td>
                      <td className="px-6 py-4">{item.asset}</td>
                      <td className="px-6 py-4">
                        {item.amount} {item.asset}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {item.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-500">
                  No matching demo records found.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Support tickets */}
        {activeSection === "Support tickets" && (
          <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)] p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Your support tickets
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Submit a request and review tickets created in this
                    browser session.
                  </p>
                </div>

                <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-200">
                  {tickets.length} total
                </span>
              </div>

              {showTicketForm && (
                <form
                  onSubmit={handleTicketSubmit}
                  className="mt-6 space-y-5 border-t border-white/[0.08] pt-6"
                >
                  <div>
                    <h3 className="font-semibold">Request details</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      This prototype stores requests in memory only.
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
                    Submit demo request
                  </button>
                </form>
              )}

              <div className="mt-6 space-y-3">
                {tickets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                    <span className="text-2xl text-slate-500">▤</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">
                      No support tickets yet
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Create a request to see it listed here.
                    </p>
                  </div>
                ) : (
                  tickets.map((ticket) => (
                    <article
                      key={ticket.id}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.035]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-white">
                          {ticket.subject}
                        </p>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {ticket.id} · {ticket.createdAt}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {ticket.description}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <aside className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)] p-5 sm:p-6">
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
          <section className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0c2238] via-[#081a2c] to-[#061321] shadow-[0_16px_44px_rgba(0,0,0,0.20)] p-6">
            <h2 className="font-semibold">Notifications</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {successMessage || "You have no new notifications."}
            </p>
          </section>
        )}

        {/* Settings */}
        {activeSection === "Settings" && (
          <section className="max-w-4xl rounded-2xl border border-sky-400/15 bg-gradient-to-br from-[#071a2d]/95 via-[#08192a]/95 to-[#061321] p-5 shadow-[0_14px_38px_rgba(0,0,0,0.18)] sm:rounded-3xl sm:p-7">
            <h2 className="text-lg font-semibold">Account settings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your account details are provided by Supabase Authentication.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01] p-4 transition-colors duration-200 hover:border-cyan-200/[0.16] sm:p-5">
                <p className="text-xs text-slate-500">Full name</p>
                <p className="mt-2 text-sm text-white">{userName}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.035] to-white/[0.01] p-4 transition-colors duration-200 hover:border-cyan-200/[0.16] sm:p-5">
                <p className="text-xs text-slate-500">Email address</p>
                <p className="mt-2 break-all text-sm text-white">
                  {userEmail}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-6 rounded-2xl border border-rose-400/25 px-5 py-3 text-sm font-medium text-rose-300 transition hover:bg-rose-400/[0.07] disabled:opacity-50"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </section>
        )}

        <footer className="mt-10 border-t border-white/[0.08] pt-5 text-xs leading-6 text-slate-500">
          <p>
            CustodialSupport · Client workspace · Keep your account
            credentials private.
          </p>
          <p className="mt-1">
            Transaction entries shown in this prototype are demonstration
            data and are not verified payouts.
          </p>
        </footer>
      </div>
    </div>
  </div>
</main>

);
}