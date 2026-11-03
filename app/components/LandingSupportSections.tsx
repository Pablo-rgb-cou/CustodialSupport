"use client";

import { useState } from "react";
import Link from "next/link";

type SupportIconName = "wallet" | "transfer" | "shield" | "message" | "check" | "arrow";

function SupportIcon({ name, className = "size-5" }: { name: SupportIconName; className?: string }) {
  const paths = {
    wallet: "M3 7V5a2 2 0 0 1 2-2h13v4M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm18 4h-6v4h6m-3-2h.01",
    transfer: "M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
    message: "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Zm2 5h10M7 13h6",
    check: "m5 12 4 4L19 6",
    arrow: "M5 12h14m-5-5 5 5-5 5",
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[name]} /></svg>;
}

const topics: { id: string; icon: SupportIconName; label: string; title: string; description: string; checks: string[] }[] = [
  { id: "transaction", icon: "transfer", label: "Transaction questions", title: "Sent it. Still waiting?", description: "Bring the transaction details together so the support conversation can start with the right context.", checks: ["Check the transaction status on the correct network’s block explorer.", "Compare the receiving address and network with the original request.", "Include the transaction hash and when the transfer was made."] },
  { id: "wallet", icon: "wallet", label: "Wallet assistance", title: "Make sense of your wallet activity.", description: "Get help describing a missing balance, an unfamiliar entry, or a wallet-related question without sharing your wallet credentials.", checks: ["Note the wallet app, asset, and network you are using.", "Describe what you expected to see and what appears instead.", "Attach a screenshot with sensitive information covered."] },
  { id: "withdrawal", icon: "shield", label: "Withdrawal updates", title: "Keep your withdrawal in view.", description: "Use your account’s withdrawal records and a dedicated support conversation to follow up on the details available.", checks: ["Find the relevant record in your Withdrawals page.", "Note the current status, asset, amount, and destination.", "Keep follow-up questions in the same ticket for context."] },
];

const faqs = [
  { question: "What should I include in a support ticket?", answer: "Describe the issue in your own words, then add the asset, network, public transaction hash or reference, and the approximate date. A screenshot can help; cover passwords, recovery phrases, private keys, and unrelated personal information first." },
  { question: "Does a pending status mean my funds are lost?", answer: "A pending status alone does not establish that funds are lost. Check the transaction on the correct network’s block explorer and distinguish its on-chain status from the status shown by your wallet or service. Include those details when asking for help." },
  { question: "Do I need to connect my wallet to ask for help?", answer: "You can create a CustodialSupport account and open a ticket without connecting a wallet. Use the support conversation to share relevant public transaction details. Never share your recovery phrase or private key." },
  { question: "Can support reverse a blockchain transaction?", answer: "Support can help review the information you provide and explain possible next steps. It cannot reverse a confirmed blockchain transfer or guarantee that funds can be recovered. Some issues require the receiving service or your wallet provider." },
  { question: "Where will I see replies and updates?", answer: "Sign in to your dashboard and open Support tickets to continue your conversation. Your Notifications page contains account notices, while Withdrawals shows the records associated with your account." },
];

export function LandingSupportFinder() {
  const [topicId, setTopicId] = useState(topics[0].id);
  const active = topics.find((topic) => topic.id === topicId)!;
  return (
    <section id="find-support" aria-labelledby="find-support-title" className="landing-section relative border-y border-white/[0.07] bg-[#091321] px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="landing-eyebrow">A good place to start</p><h2 id="find-support-title" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Different questions.<br /><span className="text-cyan-200">A clearer next step.</span></h2></div>
          <p className="max-w-sm text-sm leading-7 text-slate-400">Choose what brings you here. A little context helps turn a complicated question into a useful conversation.</p>
        </div>
        <div className="grid overflow-hidden rounded-3xl border border-cyan-200/10 bg-[#08111e] lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col gap-2 border-b border-white/[0.07] p-4 sm:p-6 lg:border-b-0 lg:border-r" role="tablist" aria-label="Support topics" aria-orientation="vertical" onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const index = topics.findIndex((topic) => topic.id === topicId);
            const next = event.key === "Home" ? 0 : event.key === "End" ? topics.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + topics.length) % topics.length;
            setTopicId(topics[next].id);
            (event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
          }}>
            {topics.map((topic, index) => <button key={topic.id} id={`support-tab-${topic.id}`} type="button" role="tab" aria-selected={topicId === topic.id} aria-controls={`support-panel-${topic.id}`} tabIndex={topicId === topic.id ? 0 : -1} onClick={() => setTopicId(topic.id)} className={`group flex min-h-[86px] items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan-200 ${topicId === topic.id ? "border-cyan-200/25 bg-gradient-to-r from-cyan-300/10 to-teal-300/[0.03]" : "border-transparent hover:border-white/10 hover:bg-white/[0.025]"}`}><span className={`grid size-11 shrink-0 place-items-center rounded-xl border ${topicId === topic.id ? "border-cyan-200/20 bg-cyan-200/10 text-cyan-200" : "border-white/10 bg-white/[0.025] text-slate-400"}`}><SupportIcon name={topic.icon} /></span><span className="flex-1"><span className="block text-[10px] tracking-[0.16em] text-slate-500">0{index + 1}</span><span className="mt-1 block text-sm font-semibold text-slate-100">{topic.label}</span></span><SupportIcon name="arrow" className={`size-4 ${topicId === topic.id ? "text-cyan-200" : "text-slate-600"}`} /></button>)}
            <p className="px-4 pt-3 text-xs leading-6 text-slate-500">Already have a ticket? <Link href="/dashboard?section=Support%20tickets" className="font-medium text-cyan-200 underline-offset-4 hover:underline">Continue your conversation</Link></p>
          </div>
          <div id={`support-panel-${active.id}`} role="tabpanel" aria-labelledby={`support-tab-${active.id}`} tabIndex={0} className="relative min-w-0 p-6 sm:p-9 lg:min-h-[405px] lg:p-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-200/15 bg-teal-200/[0.05] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-teal-200"><span className="size-1.5 rounded-full bg-teal-200" /> Start with the details</span>
            <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white">{active.title}</h3><p className="mt-3 max-w-lg text-sm leading-7 text-slate-400">{active.description}</p>
            <ul className="mt-5 space-y-3">{active.checks.map((check) => <li key={check} className="flex gap-3 text-sm leading-6 text-slate-300"><SupportIcon name="check" className="mt-1 size-4 shrink-0 text-teal-200" /><span>{check}</span></li>)}</ul>
            <Link href="/signup" className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline">Get support for this <SupportIcon name="arrow" className="size-4" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingSupportJourney() {
  return <section id="how-it-works" aria-labelledby="support-journey-title" className="landing-section relative px-4 py-16 sm:px-6 lg:px-10 lg:py-24"><div className="mx-auto max-w-7xl">
    <div className="grid items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
      <div><p className="landing-eyebrow">From question to conversation</p><h2 id="support-journey-title" className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">Less back and forth.<br /><span className="text-gradient">More context.</span></h2><p className="mt-5 max-w-md text-sm leading-7 text-slate-400">Your ticket brings the question, supporting details, and replies into one place. Return to the same conversation whenever you need to follow up.</p><Link href="/login" className="mt-7 inline-flex items-center gap-3 rounded-xl border border-cyan-200/20 bg-cyan-200/[0.05] px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-200/10">Open your dashboard <SupportIcon name="arrow" className="size-4" /></Link></div>
      <div className="relative space-y-3">{[
        ["01", "Tell us what happened", "Create your account and open a support ticket. Choose a category and describe the issue clearly.", "message"],
        ["02", "Add the useful details", "Include the asset, network, reference, and a screenshot if it helps explain what you see.", "transfer"],
        ["03", "Keep the conversation going", "Read replies, send follow-up messages, and review the ticket status from your dashboard.", "check"],
      ].map(([number, title, description, icon]) => <article key={number} className="group relative flex gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#102436] to-[#0a1422] p-5 transition-colors hover:border-cyan-200/25 sm:gap-6 sm:p-6"><span className="pt-1 font-mono text-xs text-cyan-200/60">{number}</span><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">{title}</h3><p className="mt-2 max-w-lg text-sm leading-7 text-slate-400">{description}</p></div><span className="hidden size-10 shrink-0 place-items-center rounded-xl border border-teal-200/15 bg-teal-200/[0.06] text-teal-200 sm:grid"><SupportIcon name={icon as SupportIconName} /></span></article>)}</div>
    </div>
    <div className="mt-12 grid gap-5 border-y border-white/[0.07] py-6 sm:grid-cols-3 sm:gap-8">{[["One conversation", "Keep your request and replies together."], ["Photo attachments", "Show the issue when words aren’t enough."], ["Visible ticket status", "See where your support request stands."]].map(([title, text]) => <div key={title} className="flex items-start gap-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-200" /><div><h3 className="text-sm font-semibold text-slate-200">{title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{text}</p></div></div>)}</div>
  </div></section>;
}

export function LandingSupportPreparation() {
  const [checked, setChecked] = useState<string[]>([]);
  const items = ["The asset and network", "The transaction hash or reference", "The date and a short description", "A screenshot, if helpful"];
  return <section id="prepare" aria-labelledby="prepare-title" className="landing-section relative border-y border-white/[0.07] bg-gradient-to-br from-[#0b2030] via-[#0a1625] to-[#08111c] px-4 py-16 sm:px-6 lg:px-10 lg:py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
    <div><p className="landing-eyebrow">A little preparation goes a long way</p><h2 id="prepare-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Bring the context.<br /><span className="text-teal-200">Keep your keys private.</span></h2><p className="mt-5 max-w-lg text-sm leading-7 text-slate-400">Public transaction information helps explain an issue. Your wallet’s secret credentials should always stay with you.</p><div className="mt-7 flex items-start gap-4 rounded-2xl border border-teal-200/15 bg-teal-200/[0.04] p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-200/10 text-teal-200"><SupportIcon name="shield" /></span><div><h3 className="text-sm font-semibold text-teal-100">A safer support conversation</h3><p className="mt-2 text-xs leading-6 text-slate-400">Never send a recovery phrase, private key, password, or verification code in a ticket or message.</p><a href="https://ethereum.org/security/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-teal-200 underline-offset-4 hover:underline">Read wallet security guidance <SupportIcon name="arrow" className="size-3.5" /><span className="sr-only"> (opens in a new tab)</span></a></div></div></div>
    <div className="rounded-3xl border border-cyan-200/15 bg-[#091522] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Before you open a ticket</p><h3 className="mt-2 text-xl font-semibold text-white">Your support checklist</h3></div><span className="shrink-0 rounded-full border border-cyan-200/15 bg-cyan-200/[0.06] px-3 py-1.5 font-mono text-xs text-cyan-200" aria-live="polite">{checked.length} / 4</span></div><div className="my-5 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-teal-300 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${checked.length * 25}%` }} /></div><div className="space-y-2">{items.map((item) => <label key={item} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-sm text-slate-300 transition-colors hover:border-cyan-200/20"><input type="checkbox" checked={checked.includes(item)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, item] : current.filter((entry) => entry !== item))} className="size-4 shrink-0 accent-teal-300" />{item}</label>)}</div><p className="mt-4 text-xs leading-6 text-slate-500">Use what you have available. This checklist stays on this page and does not submit any information.</p><Link href="/signup" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-300 to-teal-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110">Start a support request <SupportIcon name="arrow" className="size-4" /></Link></div>
  </div></section>;
}

export function LandingSupportFAQ() {
  return <section id="questions" aria-labelledby="support-faq-title" className="landing-section relative px-4 py-16 sm:px-6 lg:px-10 lg:py-20"><div className="mx-auto grid max-w-7xl gap-9 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20"><div><p className="landing-eyebrow">A little clarity</p><h2 id="support-faq-title" className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Good questions.<br /><span className="text-cyan-200">Straightforward answers.</span></h2><p className="mt-5 text-sm leading-7 text-slate-400">A few things to know before you start.</p><Link href="/contact" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline">Have a different question? <SupportIcon name="arrow" className="size-4" /></Link></div><div className="space-y-3">{faqs.map((faq, index) => <details key={faq.question} className="landing-faq group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1827] open:border-cyan-200/20"><summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-5 text-sm font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200"><span className="font-mono text-[10px] text-slate-500">0{index + 1}</span><span className="flex-1">{faq.question}</span><span aria-hidden="true" className="text-xl font-normal text-cyan-200 group-open:hidden">+</span><span aria-hidden="true" className="hidden text-xl font-normal text-cyan-200 group-open:inline">−</span></summary><p className="border-t border-white/[0.06] px-5 py-5 text-sm leading-7 text-slate-400 sm:pl-12">{faq.answer}</p></details>)}</div></div></section>;
}
