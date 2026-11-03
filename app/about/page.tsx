import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="public-details-shell relative min-h-screen overflow-hidden bg-[#070B14] text-white">
      {/* Shared background atmosphere */}
      <div className="site-background pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="hero-glow" style={{ top: "-100px", left: "8%" }} />
        <div className="hero-glow" style={{ top: "38%", right: "-120px" }} />
        <div className="hero-glow" style={{ top: "72%", left: "38%" }} />
      </div>

      {/* Shared navigation */}
      <header className="public-details-header fixed inset-x-0 top-0 z-40 border-b border-white/[0.08] bg-[#070b14]/95 backdrop-blur-xl">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:px-10 lg:py-5">
          <Link href="/" aria-label="Custodial Support home" className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-lg font-bold text-cyan-300 transition-colors duration-300 hover:border-cyan-300/60 hover:bg-cyan-400/20 sm:h-10 sm:w-10 sm:text-xl">C</span>
            <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight sm:text-lg">Custodial<span className="text-cyan-300">Support</span></span>
          </Link>

          <div className="hidden items-center gap-9 text-sm text-slate-400 md:flex">
            <Link href="/services" className="transition-colors duration-200 hover:text-cyan-300">Services</Link>
            <Link href="/about" aria-current="page" className="text-cyan-300 transition-colors duration-200 hover:text-cyan-200">About</Link>
            <Link href="/contact" className="transition-colors duration-200 hover:text-cyan-300">Contact</Link>
          </div>

          <Link href="/home#contact" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-cyan-200/20 bg-cyan-300 px-2.5 py-2 text-[11px] font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20 active:translate-y-0 sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm">
            Get Support <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>

      {/* About hero */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200 sm:text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
            About CustodialSupport
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-7xl">
            Support that helps you find your <span className="text-cyan-300">next step.</span>
          </h1>
          <div className="mt-7 h-1 w-20 rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300" />
          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
            CustodialSupport is designed to make it easier to find support information, understand available help options, and know where to go when you have a question.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
            Our focus is clear communication, straightforward guidance, and a support experience that helps people navigate their questions with greater confidence.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20">
              Contact Support <span aria-hidden="true">↗</span>
            </Link>
            <Link href="/home#services" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.07]">
              Explore Services
            </Link>
          </div>
        </div>

        {/* Decorative support panel */}
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
              {[
                { number: "01", title: "Find information", text: "Explore support topics and useful guidance." },
                { number: "02", title: "Understand your options", text: "Review the next steps available for your question." },
                { number: "03", title: "Reach out for help", text: "Use the contact route when you need assistance." },
              ].map((item) => (
                <div key={item.number} className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[#070B14]/45 p-4 transition-colors duration-300 hover:border-cyan-200/25 hover:bg-cyan-300/[0.04] sm:p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-200/[0.08] text-sm font-bold text-emerald-200">{item.number}</span>
                  <div>
                    <h3 className="font-semibold text-slate-100">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.06] px-4 py-3 text-sm text-emerald-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              Clear information. Helpful direction.
            </div>
          </div>
        </div>
      </section>

      {/* Mission and approach */}
      <section className="relative z-10 border-y border-white/[0.08] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 sm:text-sm">What guides us</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">Built around clarity and care.</h2>
            <p className="mt-5 text-base leading-8 text-slate-400">A good support experience should make information easier to understand and the next step easier to identify.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
            {[
              { icon: "◎", title: "Clarity first", text: "Present information in a straightforward way, so visitors can understand where to begin." },
              { icon: "◇", title: "Responsible guidance", text: "Help visitors identify appropriate support options without promising outcomes we cannot guarantee." },
              { icon: "↗", title: "A simpler journey", text: "Make support information and contact routes easier to find across the website." },
            ].map((item) => (
              <article key={item.title} className="group rounded-2xl border border-white/[0.09] bg-slate-900/45 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200/25 hover:bg-slate-900/70 sm:p-7">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] text-2xl text-cyan-200 transition-colors duration-300 group-hover:bg-cyan-300/[0.14]">{item.icon}</span>
                <h3 className="mt-6 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/20 bg-gradient-to-br from-emerald-300/[0.12] via-slate-900/80 to-cyan-300/[0.07] p-7 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-12">
          <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full bg-cyan-300/[0.08] blur-3xl" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Here to help</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">A clearer path to support.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">Have a question or need help finding the right information? Get in touch with the support team.</p>
          </div>
          <div className="relative mt-7 shrink-0 lg:mt-0">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20">Contact Support <span aria-hidden="true">↗</span></Link>
            <a href="mailto:support@custodialmanagement.net" className="mt-3 block break-all text-sm text-slate-400 transition-colors hover:text-cyan-300">support@custodialmanagement.net</a>
          </div>
        </div>
      </section>

      {/* Shared footer */}
      <footer className="relative z-10 border-t border-white/[0.08] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="font-semibold text-slate-300">Custodial<span className="text-cyan-300">Support</span></Link>
          <p>© 2026 Custodial Support. All rights reserved.</p>
          <Link href="/about" className="transition-colors hover:text-white">Support information</Link>
        </div>
      </footer>
    </main>
  );
}
