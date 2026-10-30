const services = [
  {
    number: "01",
    icon: "◎",
    title: "Account assistance",
    description:
      "Find guidance for account access, profile settings, and general account questions.",
    details: ["Account access and sign-in questions", "Profile and settings guidance", "Help identifying the right support route"],
  },
  {
    number: "02",
    icon: "↗",
    title: "Transaction support",
    description:
      "Get help understanding transaction status, confirmations, and common troubleshooting steps.",
    details: ["Understanding transaction status", "Finding confirmation information", "Guidance on where to report an issue"],
  },
  {
    number: "03",
    icon: "✳",
    title: "Customer care",
    description:
      "Explore support options and find clear direction for general questions or concerns.",
    details: ["Finding relevant support information", "Clarifying the next step", "Connecting with the support team"],
  },
];

const steps = [
  { number: "01", title: "Choose a category", text: "Start with the service area that most closely matches your question." },
  { number: "02", title: "Describe your question", text: "Share the relevant details clearly. Avoid sending passwords, private keys, or recovery phrases." },
  { number: "03", title: "Find your next step", text: "Use the available information or contact the support team if you need further direction." },
];

export default function ServicesPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070B14] text-white">
      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="hero-glow" style={{ top: "-100px", left: "8%" }} />
        <div className="hero-glow" style={{ top: "35%", right: "-120px" }} />
        <div className="hero-glow" style={{ top: "72%", left: "35%" }} />
      </div>

      {/* Shared navigation */}
      <header className="relative z-20 border-b border-white/[0.08] bg-[#070b14]/75 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:px-10 lg:py-5">
          <a href="/" aria-label="Custodial Support home" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-lg font-bold text-cyan-300 transition-colors duration-300 hover:border-cyan-300/60 hover:bg-cyan-400/20 sm:h-10 sm:w-10 sm:text-xl">C</span>
            <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight sm:text-lg">Custodial<span className="text-cyan-300">Support</span></span>
          </a>
          <div className="hidden items-center gap-9 text-sm text-slate-400 md:flex">
            <a href="/services" aria-current="page" className="text-cyan-300 transition-colors duration-200 hover:text-cyan-200">Services</a>
            <a href="/about" className="transition-colors duration-200 hover:text-cyan-300">About</a>
            <a href="/contact" className="transition-colors duration-200 hover:text-cyan-300">Contact</a>
          </div>
          <a href="/#contact" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-cyan-200/20 bg-cyan-300 px-2.5 py-2 text-[11px] font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20 active:translate-y-0 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm">
            Get Support <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      {/* Services hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pb-20 sm:pt-20 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200 sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
              How we can help
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-7xl">
              Support for <span className="text-cyan-300">what matters.</span>
            </h1>
            <div className="mt-7 h-1 w-20 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300" />
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Explore the support categories, find useful information, and identify the next step for your question.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Choose the area that best matches what you need. If you are unsure where to begin, contact the support team for direction.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="#service-categories" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20">Explore Services <span aria-hidden="true">↓</span></a>
              <a href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.07]">Contact Support <span aria-hidden="true" className="ml-2">↗</span></a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute inset-8 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-gradient-to-br from-emerald-300/[0.12] via-slate-900/90 to-cyan-300/[0.06] p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Support overview</p>
                  <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">A clearer way forward</h2>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-2xl text-cyan-200">✳</span>
              </div>
              <div className="mt-6 space-y-4">
                {steps.map((step) => (
                  <div key={step.number} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[#070B14]/45 p-4 transition-colors duration-300 hover:border-cyan-200/25 hover:bg-cyan-300/[0.04] sm:p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-200/[0.08] text-sm font-bold text-emerald-200">{step.number}</span>
                    <div><h3 className="font-semibold text-slate-100">{step.title}</h3><p className="mt-1 text-sm leading-6 text-slate-400">{step.text}</p></div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.06] px-4 py-3 text-sm text-emerald-100"><span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-300" />Clear information. Helpful direction.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Service categories */}
      <section id="service-categories" className="relative z-10 border-y border-white/[0.08] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div className="grid gap-5 md:grid-cols-[1fr_0.75fr] md:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 sm:text-sm">Support categories</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">Find the help you need.</h2></div>
            <p className="max-w-lg text-sm leading-7 text-slate-400 sm:text-base sm:leading-8 md:justify-self-end">Start with the category that best matches your question. Each one is designed to help you find relevant information and a sensible next step.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">
            {services.map((service) => (
              <article key={service.number} className="group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#101b2b] to-[#0a111d] p-5 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/30 sm:rounded-3xl sm:p-7">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 -z-10 h-40 w-40 rounded-full bg-cyan-300/[0.04] blur-3xl transition-colors duration-300 group-hover:bg-cyan-300/[0.13]" />
                <div className="flex items-center justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-2xl text-cyan-200 transition-all duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/[0.13]">{service.icon}</span><span className="font-mono text-xs tracking-[0.15em] text-slate-500">{service.number}</span></div>
                <h3 className="mt-7 text-lg font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-cyan-100 sm:text-xl">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{service.description}</p>
                <ul className="mt-5 space-y-3 border-t border-white/[0.08] pt-5">
                  {service.details.map((detail) => <li key={detail} className="flex gap-2 text-sm leading-6 text-slate-300"><span className="mt-0.5 text-emerald-300" aria-hidden="true">✓</span><span>{detail}</span></li>)}
                </ul>
                <a href="/#contact" className="mt-7 inline-flex items-center gap-2 border-t border-white/[0.08] pt-5 text-sm font-semibold text-cyan-200 transition-colors hover:text-cyan-100">Ask about this service <span aria-hidden="true">↗</span></a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Safe support guidance */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200 sm:text-sm">Before you reach out</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">A little detail goes a long way.</h2><p className="mt-5 text-sm leading-7 text-slate-400 sm:text-base">To help your question get to the right place, share only the information needed to explain the issue.</p></div>
          <div className="rounded-3xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/[0.07] to-slate-900/70 p-6 sm:p-8">
            <div className="flex gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-200/[0.08] text-xl text-emerald-200">✓</span><div><h3 className="font-semibold text-white">Helpful information to include</h3><p className="mt-2 text-sm leading-7 text-slate-400">Describe what you were trying to do, what happened, and any non-sensitive reference details that may help explain the issue.</p></div></div>
            <div className="mt-6 flex gap-4 border-t border-white/10 pt-6"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-200/20 bg-rose-200/[0.06] text-xl text-rose-200">!</span><div><h3 className="font-semibold text-white">Keep sensitive credentials private</h3><p className="mt-2 text-sm leading-7 text-slate-400">Never share passwords, one-time security codes, private keys, or wallet recovery phrases with anyone claiming to provide support.</p></div></div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10 lg:pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/20 bg-gradient-to-br from-emerald-300/[0.12] via-slate-900/80 to-cyan-300/[0.07] p-7 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-12">
          <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-cyan-300/[0.08] blur-3xl" aria-hidden="true" />
          <div className="relative max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Need a hand?</p><h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Let's find your next step.</h2><p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">If you're unsure which category fits your question, contact the support team for direction.</p></div>
          <div className="relative mt-7 shrink-0 lg:mt-0"><a href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20">Contact Support <span aria-hidden="true">↗</span></a><a href="mailto:Support@custodial.com" className="mt-3 block break-all text-sm text-slate-400 transition-colors hover:text-cyan-300">Support@custodial.com</a></div>
        </div>
      </section>

      {/* Shared footer */}
      <footer className="relative z-10 border-t border-white/[0.08] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><a href="/" className="font-semibold text-slate-300">Custodial<span className="text-cyan-300">Support</span></a><p>© 2026 Custodial Support. All rights reserved.</p><a href="/about" className="transition-colors hover:text-white">About us</a></div>
      </footer>
    </main>
  );
}
