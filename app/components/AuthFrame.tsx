import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthFrame({ title, eyebrow, description, children, backHref = "/", backLabel = "Back to home" }: {
  title: string;
  eyebrow: string;
  description: ReactNode;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="auth-viewport relative flex items-center justify-center bg-[#07111f] px-4 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 -top-28 size-80 rounded-full bg-cyan-400/[0.08] blur-3xl" />
        <div className="absolute -bottom-32 -right-28 size-80 rounded-full bg-blue-500/[0.08] blur-3xl" />
      </div>
      <div className="auth-content relative z-10 w-full max-w-[440px]">
        <Link href={backHref} className="auth-back mb-4 inline-flex min-h-9 items-center gap-2 text-sm text-slate-300 transition hover:text-cyan-200">
          <span aria-hidden="true">←</span>{backLabel}
        </Link>
        <section className="auth-card rounded-3xl border border-cyan-100/[0.10] bg-gradient-to-br from-[#112235]/95 via-[#0b1828]/95 to-[#101f32]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,.24)] sm:p-8">
          <header className="auth-heading-block mb-5">
            <Link href="/" className="auth-brand mb-5 inline-flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/[0.10] text-cyan-200">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-6"><path d="m12 2 8 3.3V11c0 5-3.3 8.7-8 11-4.7-2.3-8-6-8-11V5.3L12 2Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeWidth="1.5"/><path d="m8.5 11.5 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <span className="text-base font-bold tracking-tight">Custodial<span className="text-cyan-300">Support</span></span>
            </Link>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.2em] text-cyan-300">{eyebrow}</p>
            <h1 className="auth-heading text-[1.85rem] font-semibold leading-[1.12] tracking-tight">{title}</h1>
            <div className="auth-description mt-2 text-sm leading-6 text-slate-400">{description}</div>
          </header>
          {children}
        </section>
        <p className="auth-footer mt-4 px-2 text-center text-[11px] leading-5 text-slate-500">Keep your password and verification codes private.</p>
      </div>
    </main>
  );
}
