"use client";

import { useState } from "react";
import Link from "next/link";

const stages = [
  { name: "Open", label: "Request received", description: "Your question has a place to live. Keep your wallet or transaction context together in one support ticket.", next: "Add any relevant public transaction details to your conversation.", color: "text-cyan-200", dot: "bg-cyan-300" },
  { name: "In progress", label: "Stay in the conversation", description: "Follow the replies and status updates in your dashboard, without starting a new request for the same question.", next: "Open your conversation to check the latest support reply.", color: "text-blue-200", dot: "bg-blue-300" },
  { name: "Waiting for client", label: "Your next step is clear", description: "When support needs more information, you can respond in the same conversation and keep the context intact.", next: "Review the question from support, then reply with the requested details.", color: "text-amber-200", dot: "bg-amber-300" },
  { name: "Resolved", label: "Keep the useful details", description: "Your conversation remains a reference for the guidance you received, so you can return to it when you need to.", next: "Review the conversation and save any steps that help you going forward.", color: "text-emerald-200", dot: "bg-emerald-300" },
] as const;

export default function LandingStatusGuide() {
  const [selected, setSelected] = useState(0);
  const stage = stages[selected];

  return (
    <section aria-labelledby="status-guide-title" className="px-4 py-12 sm:px-6 sm:py-16 lg:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.1),transparent_55%),linear-gradient(130deg,#10273a,#081522)] p-6 sm:p-9 lg:p-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 size-96 rounded-full border border-cyan-200/[0.07]" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">A clearer conversation</p>
            <h2 id="status-guide-title" className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">Know where your<br className="hidden sm:block" /> request stands<span className="text-teal-300">.</span></h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 sm:text-base">From your first question to a useful answer, each status helps you understand what to do next. Explore the stages of a support ticket.</p>
            <div className="mt-7 grid grid-cols-2 gap-2" aria-label="Explore ticket statuses">
              {stages.map((item, index) => (
                <button key={item.name} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:px-4 sm:text-sm ${selected === index ? "border-cyan-200/35 bg-cyan-200/10 text-white" : "border-white/[0.08] bg-[#07121f]/40 text-slate-400 hover:border-white/20 hover:text-white"}`}>
                  <span className={`size-1.5 shrink-0 rounded-full ${item.dot}`} aria-hidden="true" />{item.name}
                </button>
              ))}
            </div>
            <Link href="/signup" className="mt-7 inline-flex items-center gap-3 text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline">Start with your support account <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#07131f]/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-5">
              <span className="text-xs font-medium text-slate-400">Inside your support account</span>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-wider text-slate-500">Preview</span>
            </div>
            <div className="grid" aria-live="polite" aria-atomic="true">
              {stages.map((item, index) => (
                <div key={item.name} aria-hidden={selected !== index} className={`col-start-1 row-start-1 pt-6 ${selected === index ? "visible" : "invisible"}`}>
                  <span className={`inline-flex items-center gap-2 rounded-full border border-current/20 bg-white/[0.03] px-3 py-1.5 text-xs ${item.color}`}><span aria-hidden="true" className={`size-1.5 rounded-full ${item.dot}`} />{item.name}</span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">{item.label}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{item.description}</p>
                  <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Your next step</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">{item.next}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-1.5" aria-hidden="true">{stages.map((item, index) => <span key={item.name} className={`h-1 flex-1 rounded-full ${index === selected ? stage.dot : "bg-white/10"}`} />)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
