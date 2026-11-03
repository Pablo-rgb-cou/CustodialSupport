"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { withRequestTimeout } from "@/lib/with-request-timeout";

const categories = ["General inquiry", "Account assistance", "Transaction support", "Technical issue", "Other"];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (!event.currentTarget.reportValidity()) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(["fullName", "email", "category", "subject", "message", "website"]
      .map((field) => [field, String(form.get(field) ?? "")]));
    setSent(false); setError(""); setSending(true);
    try {
      const response = await withRequestTimeout((signal) => fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal,
      }), { timeoutMs: 50000 });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
        const message = response.status === 429
          ? "You've sent several requests. Please wait before sending another message."
          : "We couldn't send your message right now. Please try again later or email support@custodialmanagement.net.";
        throw new Error(message);
      }
      setSent(true); formElement.reset();
    } catch (sendError) {
      setError(sendError instanceof Error && sendError.message.startsWith("You've sent several")
        ? sendError.message : "We couldn't confirm that your message was sent. Your details are still here; please try again later or email support@custodialmanagement.net.");
    } finally { setSending(false); }
  }

  const inputClass = "w-full rounded-xl border border-white/10 bg-[#07111f]/80 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 hover:border-white/20 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10";
  const labelClass = "mb-2 block text-sm font-medium text-slate-200";

  return (
    <main className="public-details-shell min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <header className="public-details-header fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#07111f]/95 backdrop-blur-xl">
        <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-10">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white sm:text-xl">
            Custodial<span className="text-cyan-300">Support</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium sm:gap-7">
            <Link href="/" className="hidden text-slate-300 transition hover:text-cyan-300 sm:inline">Home</Link>
            <Link href="/services" className="hidden text-slate-300 transition hover:text-cyan-300 sm:inline">Services</Link>
            <Link href="/about" className="hidden text-slate-300 transition hover:text-cyan-300 sm:inline">About</Link>
            <Link href="/contact" aria-current="page" className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-cyan-200">Contact</Link>
          </div>
        </nav>
      </header>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-32 h-80 w-80 rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute -right-40 top-[28rem] h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <section className="relative mx-auto max-w-7xl px-5 pb-12 pt-16 sm:px-8 sm:pt-20 lg:px-10 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-cyan-300" /> We&apos;re here to help
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Let&apos;s find a clearer path <span className="text-cyan-300">forward.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Tell us what you need help with. Send your question directly to our support team.
          </p>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-8 px-5 pb-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12 lg:px-10 lg:pb-28">
        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/10 backdrop-blur-xl sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Get in touch</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">How can we help?</h2>
            <p className="mt-3 leading-7 text-slate-400">Choose the category that best matches your question and provide enough context for the team to understand it.</p>
            <div className="mt-7 space-y-4">
              <div className="rounded-2xl border border-white/[0.07] bg-[#0b1929]/80 p-4">
                <h3 className="font-medium text-white">Email support</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">Submit your request here and our team will reply to the email address you provide.</p>
                <a href="mailto:support@custodialmanagement.net" className="mt-2 block break-all text-sm text-cyan-200 hover:text-cyan-100">support@custodialmanagement.net</a>
              </div>
              <div className="rounded-2xl border border-white/[0.07] bg-[#0b1929]/80 p-4">
                <h3 className="font-medium text-white">Clear communication</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">Include relevant reference numbers, but leave out sensitive account credentials.</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-amber-300/15 bg-amber-200/[0.045] p-5 sm:p-6">
            <h3 className="font-semibold text-amber-100 text-white">Keep your information safe</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">Never submit passwords, private keys, wallet recovery phrases, one-time codes, or full payment-card details through a contact form.</p>
          </div>
        </aside>

        <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Contact form</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Send us a message</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">Fields marked with <span className="text-cyan-300">*</span> are required.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={sending}>
            <fieldset disabled={sending} className="space-y-5 disabled:opacity-75">
            <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
              <label htmlFor="contact-website">Leave this field empty</label>
              <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="fullName" className={labelClass}>Full name <span className="text-cyan-300">*</span></label>
                <input id="fullName" name="fullName" autoComplete="name" required maxLength={100} placeholder="Your full name" className={inputClass} />
              </div>
              <div>
                <label htmlFor="email" className={labelClass}>Email address <span className="text-cyan-300">*</span></label>
                <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" className={inputClass} />
              </div>
            </div>

            <div>
              <label htmlFor="category" className={labelClass}>Support category <span className="text-cyan-300">*</span></label>
              <select id="category" name="category" required defaultValue="" className={inputClass}>
                <option value="" disabled className="bg-[#07111f]">Choose a category</option>
                {categories.map((category) => <option key={category} value={category} className="bg-[#07111f]">{category}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="subject" className={labelClass}>Subject <span className="text-cyan-300">*</span></label>
              <input id="subject" name="subject" required maxLength={160} placeholder="Briefly describe your question" className={inputClass} />
            </div>

            <div>
              <label htmlFor="message" className={labelClass}>Message <span className="text-cyan-300">*</span></label>
              <textarea id="message" name="message" required minLength={10} maxLength={4000} rows={6} placeholder="Tell us a little more about how we can help..." className={`${inputClass} resize-y leading-6`} />
              <p className="mt-2 text-xs leading-5 text-slate-500">Please don&apos;t include passwords, private keys, or recovery phrases.</p>
            </div>

            {sent && <div role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm leading-6 text-emerald-100">Your message has been sent to our support team. We&apos;ll reply to the email address you provided.</div>}
            {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] p-4 text-sm leading-6 text-rose-100">{error}</div>}

            <button type="submit" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-4 text-sm font-semibold text-[#06111e] transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_10px_35px_rgba(34,211,238,0.18)] focus:outline-none focus:ring-4 focus:ring-cyan-300/25 sm:w-auto">
              {sending ? "Sending message…" : "Send message"} <span aria-hidden="true">→</span>
            </button>
            <p className="text-xs leading-5 text-slate-500">Your request is emailed securely to our support team.</p>
            </fieldset>
          </form>
        </div>
      </section>

      <footer className="relative border-t border-white/10 bg-[#050d18]/80">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <Link href="/" className="font-semibold text-slate-300 transition hover:text-cyan-300">Custodial<span className="text-cyan-300">Support</span></Link>
          <p>Clear communication. Responsible support.</p>
          <div className="flex gap-5">
            <Link href="/services" className="transition hover:text-cyan-300">Services</Link>
            <Link href="/about" className="transition hover:text-cyan-300">About</Link>
            <Link href="/contact" className="transition hover:text-cyan-300">Contact</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
