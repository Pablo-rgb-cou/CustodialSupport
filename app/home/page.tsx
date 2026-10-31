"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const services = [
  {
    number: "01",
    icon: "◎",
    title: "Account assistance",
    description:
      "Get guidance with account access, profile settings, and general account questions.",
  },
  {
    number: "02",
    icon: "↗",
    title: "Transaction support",
    description:
      "Find guidance on transaction status, confirmations, and troubleshooting.",
  },
  {
    number: "03",
    icon: "✳",
    title: "Customer care",
    description:
      "Get help finding answers and navigating your support options.",
  },
];

type DemoTestimonial = {
  id: number;
  name: string;
  initials: string;
  message: string;
  rating: number;
};

const demoTestimonials: Omit<DemoTestimonial, "id">[] = [
  {
    name: "Megan Roberts",
    initials: "MR",
    message: "The follow-up helped me make sense of the account security steps I should follow. I appreciate the courteous support.",
    rating: 4,
  },
  {
    name: "Lucas Harris",
    initials: "LH",
    message: "I valued the straightforward communication about the steps for tracking a request. That made the process easier to understand.",
    rating: 4,
  },
  {
    name: "Karen Hall",
    initials: "KH",
    message: "I was glad to receive a clear update regarding the information available about my request. Thank you for taking the time to respond.",
    rating: 5,
  },
  {
    name: "Ava Mitchell",
    initials: "AM",
    message: "The team explained what information to check next and made the support process easy to follow.",
    rating: 5,
  },
  {
    name: "Daniel Wright",
    initials: "DW",
    message: "I received a helpful status update and a clear explanation of the next steps for my request.",
    rating: 4,
  },
  {
    name: "Olivia Carter",
    initials: "OC",
    message: "The response was courteous and practical. I appreciated having the details laid out clearly.",
    rating: 5,
  },
];

function CustomerFeedbackCard() {
  const [testimonials, setTestimonials] = useState<DemoTestimonial[]>([]);
  const [counter, setCounter] = useState(1);
  const nextId = useRef(4);

  useEffect(() => {
    const makeTestimonial = (id: number): DemoTestimonial => ({
      ...demoTestimonials[(id - 1) % demoTestimonials.length],
      id,
    });

    setTestimonials([1, 2, 3].map(makeTestimonial));
    nextId.current = 4;

    const testimonialTimer = window.setInterval(() => {
      const newTestimonial = makeTestimonial(nextId.current++);
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
        </div>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M8.25 6.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM15.75 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2.25 9.75a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM6.31 15.117A6.745 6.745 0 0 1 12 12a6.745 6.745 0 0 1 6.709 7.498.75.75 0 0 1-.372.568A12.696 12.696 0 0 1 12 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 0 1-.372-.568 6.787 6.787 0 0 1 1.019-4.38Z"
            />
            <path d="M5.082 14.254a8.287 8.287 0 0 0-1.308 5.135 9.687 9.687 0 0 1-1.764-.44l-.115-.04a.563.563 0 0 1-.373-.487l-.01-.121a3.75 3.75 0 0 1 3.57-4.047ZM20.226 19.389a8.287 8.287 0 0 0-1.308-5.135 3.75 3.75 0 0 1 3.57 4.047l-.01.121a.563.563 0 0 1-.373.486l-.115.04c-.567.2-1.156.349-1.764.441Z" />
          </svg>
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
        <span className="ml-auto shrink-0 text-xs text-cyan-200">
          {counter} new reviews
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

function SupportIllustration() {
  return (
    <svg
      viewBox="0 0 640 520"
      className="h-auto w-full"
      role="img"
      aria-label="Digital customer support dashboard illustration"
      fill="none"
    >
      <defs>
        <linearGradient id="panel" x1="70" y1="40" x2="560" y2="460">
          <stop stopColor="#123A50" stopOpacity=".96" />
          <stop offset="1" stopColor="#081827" stopOpacity=".92" />
        </linearGradient>
        <linearGradient id="mint" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6FFFF0" />
          <stop offset="1" stopColor="#28A9FF" />
        </linearGradient>
        <radialGradient id="halo">
          <stop stopColor="#20D9E8" stopOpacity=".34" />
          <stop offset="1" stopColor="#20D9E8" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <circle cx="300" cy="260" r="240" fill="url(#halo)" />
      <g stroke="#39DCEB" strokeOpacity=".24" strokeWidth="1.2">
        <path d="M12 350H98L142 306H204" />
        <path d="M408 90H474L522 138H624" />
        <path d="M430 410H510L552 368H630" />
        <path d="M70 120H122L160 158" />
        <path d="M290 12V62L324 96" />
      </g>
      <g fill="#65F5D0">
        <circle cx="98" cy="350" r="4" />
        <circle cx="204" cy="306" r="4" />
        <circle cx="408" cy="90" r="4" />
        <circle cx="624" cy="138" r="4" />
        <circle cx="510" cy="410" r="4" />
        <circle cx="160" cy="158" r="4" />
      </g>

      {/* Isometric platform */}
      <path
        d="M90 355L330 226L565 351L323 482Z"
        fill="#071522"
        stroke="#1C8DA8"
        strokeOpacity=".75"
      />
      <path
        d="M90 355L323 482V498L90 371Z"
        fill="#0A2A3D"
        stroke="#167A99"
        strokeOpacity=".7"
      />
      <path
        d="M323 482L565 351V368L323 498Z"
        fill="#0B1F31"
        stroke="#167A99"
        strokeOpacity=".7"
      />
      <path
        d="M113 356L330 241L539 353L323 468Z"
        fill="#0D2B40"
        fillOpacity=".65"
        stroke="#22D3EE"
        strokeOpacity=".5"
      />

      {/* Main glass support screen */}
      <path
        d="M162 290V147Q162 136 173 130L359 31Q372 25 372 40V235L182 340Z"
        fill="#0C344A"
        fillOpacity=".84"
        stroke="url(#mint)"
        strokeWidth="2"
      />
      <path
        d="M174 145L357 47V224L174 324Z"
        fill="url(#panel)"
        stroke="#3ADCEB"
        strokeOpacity=".5"
      />
      <path d="M190 161L340 81" stroke="#5EF4E0" strokeOpacity=".55" />
      <circle cx="331" cy="65" r="3" fill="#65F5D0" />
      <circle cx="341" cy="60" r="3" fill="#65F5D0" fillOpacity=".6" />

      {/* Profile avatar */}
      <rect
        x="193"
        y="177"
        width="62"
        height="68"
        rx="12"
        fill="#0D5572"
        stroke="#2EDCF0"
        strokeOpacity=".8"
      />
      <circle cx="224" cy="198" r="11" fill="#8DF8F1" />
      <path d="M205 231Q224 204 243 231V235H205Z" fill="#8DF8F1" />
      <path d="M270 187L329 156" stroke="#D8F9FF" strokeWidth="4" strokeLinecap="round" />
      <path d="M270 202L313 179" stroke="#9CB8C9" strokeWidth="3" strokeLinecap="round" />
      <path d="M195 267L326 197" stroke="#4A7892" strokeWidth="6" strokeLinecap="round" />
      <path d="M195 282L299 226" stroke="#4A7892" strokeWidth="6" strokeLinecap="round" />

      {/* Floating account card */}
      <g transform="translate(355 118)">
        <rect x="0" y="0" width="150" height="104" rx="14" fill="#0B293A" stroke="#42E8E1" strokeWidth="1.5" />
        <path d="M22 37L34 49L55 23" stroke="#65F5D0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M70 31H126" stroke="#E5F7FF" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 45H114" stroke="#83AFC2" strokeWidth="3" strokeLinecap="round" />
        <path d="M22 72H125" stroke="#2D647A" strokeWidth="5" strokeLinecap="round" />
        <path d="M22 85H94" stroke="#2D647A" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Floating transaction card */}
      <g transform="translate(375 265)">
        <rect x="0" y="0" width="162" height="105" rx="14" fill="#0A2234" stroke="#2EBDE0" strokeWidth="1.5" />
        <path d="M22 70L44 48L61 59L91 25" stroke="url(#mint)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M78 25H91V38" stroke="#65F5D0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 84H135" stroke="#2D647A" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Database stacks */}
      <g>
        <ellipse cx="125" cy="372" rx="33" ry="13" fill="#126B88" stroke="#50F4E7" strokeWidth="2" />
        <path d="M92 372V424C92 432 107 439 125 439S158 432 158 424V372" fill="#0A3851" stroke="#31D7E7" strokeWidth="2" />
        <path d="M92 390C92 398 107 405 125 405S158 398 158 390M92 407C92 415 107 422 125 422S158 415 158 407" stroke="#36CDE4" strokeWidth="2" />
        <ellipse cx="125" cy="372" rx="33" ry="13" fill="#0E526D" stroke="#65F5D0" strokeWidth="2" />
        <ellipse cx="125" cy="372" rx="13" ry="5" fill="#65F5D0" fillOpacity=".8" />
      </g>
      <g>
        <ellipse cx="188" cy="405" rx="27" ry="11" fill="#126B88" stroke="#50F4E7" strokeWidth="2" />
        <path d="M161 405V443C161 450 173 456 188 456S215 450 215 443V405" fill="#0A3851" stroke="#31D7E7" strokeWidth="2" />
        <path d="M161 420C161 427 173 433 188 433S215 427 215 420M161 435C161 442 173 448 188 448S215 442 215 435" stroke="#36CDE4" strokeWidth="2" />
        <ellipse cx="188" cy="405" rx="27" ry="11" fill="#0E526D" stroke="#65F5D0" strokeWidth="2" />
      </g>

      {/* Accent light trails */}
      <path d="M75 452L143 489L204 456" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" />
      <path d="M75 452L143 489L204 456" stroke="#22D3EE" strokeWidth="7" strokeOpacity=".28" filter="url(#softGlow)" />
      <circle cx="75" cy="452" r="4" fill="#65F5D0" />
      <circle cx="204" cy="456" r="4" fill="#65F5D0" />
    </svg>
  );
}

function SupportOrbit() {
  return (
    <svg
      viewBox="0 0 420 300"
      className="h-auto w-full"
      role="img"
      aria-label="Connected digital support icons"
      fill="none"
    >
      <defs>
        <linearGradient id="orbit-card" x1="20" y1="20" x2="380" y2="270">
          <stop stopColor="#0D3448" />
          <stop offset="1" stopColor="#101A2D" />
        </linearGradient>
        <linearGradient id="orbit-line" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#65F5D0" />
          <stop offset="1" stopColor="#38BDF8" />
        </linearGradient>
      </defs>
      <circle cx="210" cy="150" r="118" stroke="#2DD4BF" strokeOpacity=".12" strokeDasharray="4 8" />
      <circle cx="210" cy="150" r="84" stroke="#38BDF8" strokeOpacity=".16" />
      <path d="M210 58V100M210 200V242M118 150H160M260 150H302M145 85L175 115M245 185L275 215M275 85L245 115M175 185L145 215" stroke="url(#orbit-line)" strokeOpacity=".55" strokeWidth="2" />
      <g transform="translate(143 86)">
        <rect width="134" height="128" rx="22" fill="url(#orbit-card)" stroke="#47E8DD" strokeOpacity=".7" />
        <rect x="28" y="26" width="78" height="54" rx="10" fill="#123C50" stroke="#38DDEB" />
        <path d="M40 42H93M40 54H82M40 66H72" stroke="#65F5D0" strokeWidth="4" strokeLinecap="round" />
        <path d="M45 96H89" stroke="#7EA6BA" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform="translate(28 35)">
        <rect width="92" height="72" rx="16" fill="#0C2638" stroke="#38DDEB" strokeOpacity=".7" />
        <circle cx="26" cy="27" r="9" stroke="#65F5D0" strokeWidth="3" />
        <path d="M12 51Q26 34 40 51" stroke="#65F5D0" strokeWidth="3" strokeLinecap="round" />
        <path d="M50 24H76M50 36H70M50 48H76" stroke="#8AAABD" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="translate(302 34)">
        <rect width="88" height="72" rx="16" fill="#0C2638" stroke="#38DDEB" strokeOpacity=".7" />
        <path d="M20 37L31 48L51 23" stroke="#65F5D0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M59 26H72M59 39H72M59 52H68" stroke="#8AAABD" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="translate(28 193)">
        <rect width="92" height="72" rx="16" fill="#0C2638" stroke="#38DDEB" strokeOpacity=".7" />
        <path d="M19 25H73V48H48L35 59V48H19Z" stroke="#65F5D0" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="35" cy="37" r="2.5" fill="#65F5D0" />
        <circle cx="46" cy="37" r="2.5" fill="#65F5D0" />
        <circle cx="57" cy="37" r="2.5" fill="#65F5D0" />
      </g>
      <g transform="translate(302 193)">
        <rect width="88" height="72" rx="16" fill="#0C2638" stroke="#38DDEB" strokeOpacity=".7" />
        <path d="M44 17L63 24V39C63 50 54 57 44 61C34 57 25 50 25 39V24Z" stroke="#65F5D0" strokeWidth="3" strokeLinejoin="round" />
        <path d="M35 38L42 45L54 32" stroke="#65F5D0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="#65F5D0">
        <circle cx="210" cy="58" r="4" />
        <circle cx="210" cy="242" r="4" />
        <circle cx="118" cy="150" r="4" />
        <circle cx="302" cy="150" r="4" />
      </g>
    </svg>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const desktopViewport = window.matchMedia("(min-width: 768px)");
    const restorePageScroll = () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        restorePageScroll();
        setMenuOpen(false);
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
  }, [menuOpen]);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070B14] text-white">
      {/* Background atmosphere */}
      <div className="site-background pointer-events-none" aria-hidden="true">
        <div
          className="hero-glow"
          style={{ top: "-100px", left: "10%" }}
        />
        <div
          className="hero-glow"
          style={{ top: "35%", right: "-120px" }}
        />
      </div>

      {/* Navigation */}

      <header className={`relative border-b border-white/[0.08] bg-[#070b14]/75 backdrop-blur-xl ${menuOpen ? "z-[60]" : "z-20"}`}>
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6 sm:py-4 lg:px-10 lg:py-5">


          {/* Logo */}
          <a
            href="#home"
            aria-label="Custodial Support home"
            className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 text-lg font-bold text-cyan-300 transition-colors duration-300 hover:border-cyan-300/60 hover:bg-cyan-400/20 sm:h-10 sm:w-10 sm:text-xl">
              C
            </span>

            <span className="whitespace-nowrap text-[13px] font-semibold tracking-tight sm:text-lg">
              Custodial<span className="text-cyan-300">Support</span>
            </span>
          </a>

          {/* Desktop navigation links */}
          <div className="hidden items-center gap-9 text-sm text-slate-400 md:flex">
            <a
              href="/services"
              className="transition-colors duration-200 hover:text-cyan-300"
            >
              Services
            </a>

            <a
              href="/about"
              className="transition-colors duration-200 hover:text-cyan-300"
            >
              About
            </a>

            <a
              href="#contact"
              className="transition-colors duration-200 hover:text-cyan-300"
            >
              Contact
            </a>
          </div>

          {/* Desktop account actions */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-200 hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Sign up
            </Link>
          </div>

          {/* Support button */}
          <a
            href="#contact"
            className="hidden min-h-10 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-cyan-200/20 bg-cyan-300 px-2.5 py-2 text-[11px] font-semibold text-slate-950 transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-lg hover:shadow-cyan-300/20 active:translate-y-0 md:inline-flex sm:min-h-11 sm:px-5 sm:py-3 sm:text-sm"
          >
            Get Support
            <span aria-hidden="true">↗</span>
          </a>


          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "mobile-navigation" : undefined}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-white/[0.04] text-cyan-300 transition hover:border-cyan-300/50 hover:bg-cyan-300/10 md:hidden"
          >
            {menuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path
                  d="M4 7H20M4 12H20M4 17H20"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>

        </nav>

        
      </header>

      {/* Keep the mobile menu attached to the viewport while the page is locked. */}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/55 md:hidden"
          />
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="fixed left-3 right-3 top-[5.5rem] z-50 max-h-[calc(100dvh-6.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0b1220]/[0.98] p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl md:hidden"
          >
            <Link
              href="/services"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center justify-between rounded-xl px-4 py-3.5 text-sm text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Services <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/about"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center justify-between rounded-xl px-4 py-3.5 text-sm text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              About <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/contact"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center justify-between rounded-xl px-4 py-3.5 text-sm text-slate-300 transition hover:bg-cyan-300/10 hover:text-cyan-300 focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              Contact <span aria-hidden="true">↗</span>
            </Link>

            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.08] hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-cyan-200/20 bg-cyan-300 px-3 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-300"
              >
                Sign up
              </Link>
            </div>
          </nav>
        </>
      )}


      {/* Hero: illustration fills the space before the heading */}
      <section
        id="home"
        className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-10 lg:py-20"
      >
        <div className="relative order-2 mx-auto w-full max-w-[590px] lg:order-1">
          <div aria-hidden="true" className="hero-ambient-glow" />
          <div className="relative hero-illustration-float">
            <SupportIllustration />
          </div>
          <div className="hero-status-float absolute left-2 top-8 rounded-xl border border-cyan-300/20 bg-[#0B1A2A]/90 px-4 py-3 shadow-xl shadow-cyan-950/30 sm:left-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Support network</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#65F5D0]" />
              Connected and ready
            </p>
          </div>
          <div className="absolute bottom-5 right-1 rounded-xl border border-white/10 bg-[#101D2D]/95 px-4 py-3 shadow-xl sm:right-0">
            <p className="text-xs text-slate-400">Support channels</p>
            <p className="mt-1 text-sm font-semibold text-white">Account · Transactions</p>
          </div>
        </div>

        <div className="relative order-1 z-10 lg:order-2">
          <div className="mb-7 inline-flex items-center gap-3 rounded-full border border-emerald-300/25 bg-emerald-300/[0.06] px-4 py-2.5 shadow-[0_0_30px_rgba(101,245,208,0.04)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-30" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            <span className="text-xs font-semibold tracking-[0.12em] text-emerald-200 sm:text-sm">
              YOUR CUSTOMER SUPPORT CENTER
            </span>
          </div>

          <h1 className="max-w-2xl text-[clamp(2.1rem,8.8vw,3.5rem)] font-bold leading-[1.06] tracking-[-0.055em] sm:text-6xl lg:text-[68px] xl:text-[76px]">
            Support that puts
            <span className="text-gradient mt-1 block">you first.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg sm:leading-9">
            A central place to find assistance, navigate account questions,
            and get clear guidance with transaction-related concerns.
          </p>

          {/* Hero action buttons */}
          <div className="mt-7 grid w-full grid-cols-2 gap-2 sm:mt-9 sm:flex sm:w-auto sm:items-center sm:gap-4">

            {/* Primary button */}
            <Link
              href="/signup"
              className="hero-button-primary group inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-cyan-300 px-2 text-[12px] font-semibold text-slate-950 transition-all duration-200 hover:-translate-y-1 hover:bg-cyan-200 hover:shadow-xl hover:shadow-cyan-300/10 min-[390px]:text-sm sm:h-auto sm:w-auto sm:gap-3 sm:px-6 sm:py-4 sm:text-base"
            >
              <span>Contact Support</span>

              <span className="shrink-0 transition-transform duration-200 group-hover:translate-x-1">
                →
              </span>
            </Link>

            {/* Secondary button */}
            <a
              href="#services"
              className="hero-button-secondary inline-flex h-12 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[12px] font-semibold text-white transition-all duration-200 hover:border-cyan-300/30 hover:bg-white/[0.07] min-[390px]:text-sm sm:h-auto sm:w-auto sm:px-6 sm:py-4 sm:text-base"
            >
              Explore Services
            </a>

          </div>

          <div className="mt-10 flex items-center gap-4 border-t border-white/[0.08] pt-6">
            <div className="flex -space-x-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#070B14] bg-slate-700 text-sm">C</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#070B14] bg-slate-600 text-sm">S</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#070B14] bg-cyan-900 text-sm text-cyan-200">+</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Support, made simpler</p>
              <p className="mt-1 text-xs text-slate-500">Clear guidance for your questions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Support Overview */}

      <section
        id="overview"
        className="relative isolate overflow-hidden border-y border-white/[0.08] bg-gradient-to-b from-[#0a1220] via-[#09111e] to-[#070b14] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      >
        {/* Background lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-cyan-400/[0.07] blur-[100px]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-blue-500/[0.08] blur-[110px]"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">


          {/* LEFT: Interactive support dashboard */}
          <div className="relative min-w-0">

            {/* Outer glow */}
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[32px] bg-cyan-400/[0.06] blur-2xl"
            />

            <div className="glass-panel relative overflow-hidden rounded-2xl shadow-2xl shadow-black/30 sm:rounded-3xl">

              {/* Dashboard header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-4 sm:px-6 sm:py-5">

                <div className="flex min-w-0 items-center gap-3">

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-lg text-cyan-200">
                    C
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      Support overview
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Your help center
                    </p>
                  </div>

                </div>

                <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1.5 text-[10px] font-medium text-cyan-200 sm:text-xs">
                  LIVE PREVIEW
                </span>

              </div>

              <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">

                {/* Featured support card */}
                <div className="group relative isolate overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300/[0.12] via-[#102438] to-blue-500/[0.08] p-5 transition-colors duration-300 hover:border-cyan-300/35 sm:p-6">

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-10 -top-12 -z-10 h-40 w-40 rounded-full bg-cyan-300/[0.10] blur-3xl transition-opacity duration-300 group-hover:bg-cyan-300/[0.16]"
                  />

                  <div className="flex items-center justify-between gap-3">

                    <span className="text-xs font-medium tracking-wide text-slate-300 sm:text-sm">
                      HOW CAN WE HELP?
                    </span>

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] text-lg text-cyan-200">
                      ✳
                    </span>

                  </div>

                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                    Find the right support.
                  </h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                    Choose a support category to explore your options and find the right direction.
                  </p>

                  <a
                    href="#services"
                    className="group/link mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
                  >
                    Browse support options

                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover/link:translate-x-1"
                    >
                      →
                    </span>
                  </a>

                </div>

                {/* Support category shortcuts */}
                <div className="space-y-3">

                  <a
                    href="#services"
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] sm:gap-4 sm:p-4"
                  >

                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-400/[0.09] text-xl text-blue-200 transition-colors duration-300 group-hover:bg-blue-400/[0.16]">
                      ◎
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-100">
                        Account assistance
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        Access and account questions
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className="shrink-0 text-lg text-slate-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-cyan-200"
                    >
                      →
                    </span>

                  </a>

                  <a
                    href="#services"
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] sm:gap-4 sm:p-4"
                  >

                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08] text-xl text-cyan-200 transition-colors duration-300 group-hover:bg-cyan-300/[0.16]">
                      ↗
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-100">
                        Transaction questions
                      </span>

                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        Status and confirmations
                      </span>
                    </span>

                    <span
                      aria-hidden="true"
                      className="shrink-0 text-lg text-slate-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-cyan-200"
                    >
                      →
                    </span>

                  </a>

                </div>

                {/* Security reminder */}
                <div className="flex items-start gap-3 rounded-xl border border-amber-200/[0.10] bg-amber-200/[0.025] p-4">

                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-200/15 bg-amber-200/[0.06] text-sm text-amber-200">
                    i
                  </span>

                  <p className="text-xs leading-6 text-slate-400">
                    <span className="font-semibold text-slate-200">
                      Stay safe online.
                    </span>{" "}
                    Never share your password, private keys, or wallet recovery phrase with anyone claiming to provide support.
                  </p>

                </div>

              </div>
            </div>

            {/* Decorative dashboard accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-3 left-8 right-8 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent"
            />

          </div>

          {/* RIGHT: Digital support illustration */}
          <div className="relative mx-auto w-full max-w-[480px] lg:max-w-none">

            {/* Illustration lighting */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-8 rounded-full bg-cyan-400/[0.10] blur-[70px]"
            />

            <div className="relative">

              <SupportOrbit />

              {/* Floating status panel */}
              <div className="hero-status-float absolute left-0 top-[12%] max-w-[190px] rounded-xl border border-cyan-300/20 bg-[#0b1727]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-4">

                <div className="flex items-center gap-2">

                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-40" />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  </span>

                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300 sm:text-xs">
                    Support network
                  </span>

                </div>

                <p className="mt-2 text-xs font-semibold text-cyan-200 sm:text-sm">
                  Connected and ready
                </p>

              </div>

              {/* Floating channels panel */}
              <div className="absolute bottom-[8%] right-0 max-w-[210px] rounded-xl border border-white/[0.12] bg-[#101b2b]/95 p-3 shadow-xl shadow-black/30 backdrop-blur-xl sm:p-4">

                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:text-xs">
                  Support channels
                </p>

                <div className="mt-2 flex flex-wrap gap-2">

                  <span className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] px-2 py-1 text-[10px] text-cyan-100 sm:text-xs">
                    Account
                  </span>

                  <span className="rounded-lg border border-blue-300/15 bg-blue-300/[0.07] px-2 py-1 text-[10px] text-blue-100 sm:text-xs">
                    Transactions
                  </span>

                </div>

              </div>

            </div>

            {/* Illustration caption */}
            <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4 text-center backdrop-blur-xl sm:mt-7">

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                One connected experience
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Account guidance, transaction help, and customer care in one place.
              </p>

            </div>

          </div>


        </div>
      </section>

      {/* Customer feedback sits between the illustration and support categories. */}
      <section className="px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <CustomerFeedbackCard />
        </div>
      </section>

      {/* Services */}

      <section
        id="services"
        className="relative isolate overflow-hidden bg-white/[0.015] px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      >
        {/* Subtle background lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-0 h-72 w-72 rounded-full bg-cyan-400/[0.05] blur-[100px]"
        />

        <div className="relative mx-auto max-w-7xl">


          {/* Section heading */}
          <div className="grid gap-5 md:grid-cols-[1fr_0.75fr] md:items-end">

            <div>

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1.5">

                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200 sm:text-xs">
                  HOW WE CAN HELP
                </span>

              </div>

              <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Support for{" "}
                <span className="text-gradient">what matters.</span>
              </h2>

            </div>

            <p className="max-w-lg text-sm leading-7 text-slate-400 sm:text-base sm:leading-8 md:justify-self-end">
              Explore our support categories and find the guidance that best matches your question.
            </p>

          </div>

          {/* Service cards */}
          <div className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 md:grid-cols-3">

            {services.map((service) => (

              <a
                key={service.number}
                href="#contact"
                className="interactive-card group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#101b2b] to-[#0a111d] p-5 shadow-lg shadow-black/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300 sm:rounded-3xl sm:p-7"
              >

                {/* Card hover lighting */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 -z-10 h-40 w-40 rounded-full bg-cyan-300/[0.04] blur-3xl transition-colors duration-300 group-hover:bg-cyan-300/[0.13]"
                />

                {/* Top row */}
                <div className="flex items-center justify-between gap-4">

                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-2xl text-cyan-200 transition-all duration-300 group-hover:border-cyan-300/30 group-hover:bg-cyan-300/[0.13] group-hover:text-white">
                    {service.icon}
                  </span>

                  <span className="font-mono text-xs tracking-[0.15em] text-slate-500 transition-colors duration-300 group-hover:text-cyan-200">
                    {service.number}
                  </span>

                </div>

                {/* Card content */}
                <h3 className="mt-7 text-lg font-semibold tracking-tight text-white transition-colors duration-300 group-hover:text-cyan-100 sm:text-xl">
                  {service.title}
                </h3>

                <p className="mt-3 flex-1 text-sm leading-7 text-slate-400">
                  {service.description}
                </p>

                {/* Card footer */}
                <div className="mt-7 flex items-center justify-between border-t border-white/[0.08] pt-5">

                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                    Find out more

                    <span
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1.5"
                    >
                      →
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] text-sm text-slate-400 transition-all duration-300 group-hover:border-cyan-300/25 group-hover:bg-cyan-300/[0.08] group-hover:text-cyan-200"
                  >
                    ↗
                  </span>

                </div>

                {/* Bottom accent */}
                <div
                  aria-hidden="true"
                  className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-cyan-300/0 to-transparent transition-all duration-300 group-hover:via-cyan-300/60 sm:left-7 sm:right-7"
                />

              </a>

            ))}

          </div>

          {/* Bottom reassurance strip */}
          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

            <div className="flex items-center gap-3">

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-200">
                ✓
              </span>

              <div>

                <p className="text-sm font-medium text-slate-200">
                  Clear guidance, one step at a time
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose the category that best matches your question.
                </p>

              </div>

            </div>

            <a
              href="#contact"
              className="inline-flex min-h-10 shrink-0 items-center gap-2 text-sm font-semibold text-cyan-200 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
            >
              Contact Support

              <span aria-hidden="true">→</span>
            </a>

          </div>

        </div>
      </section>


      {/* Support Overview / Contact Card */}
      <section
        id="contact"
        className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-10 lg:py-24"
      >
        {/* Background atmosphere */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 15% 50%, rgba(101,245,208,0.07), transparent 45%)",
          }}
        />

        {/* Main card */}
        <div
          className="group relative mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 transition-all duration-300 hover:border-cyan-300/25"
          style={{
            background:
              "linear-gradient(125deg, rgba(19,38,48,0.94) 0%, rgba(13,21,34,0.97) 55%, rgba(19,25,38,0.96) 100%)",
            boxShadow:
              "0 24px 70px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Subtle teal reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-32 h-64 w-64 rounded-full opacity-60 blur-[100px] transition-opacity duration-500 group-hover:opacity-90"
            style={{
              background: "rgba(101,245,208,0.13)",
            }}
          />

          {/* Fine decorative highlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(101,245,208,0.5), rgba(255,255,255,0.15), transparent)",
            }}
          />

          {/* Card content */}
          <div className="relative grid gap-8 p-6 sm:p-9 md:grid-cols-2 md:items-center md:gap-12 lg:gap-20 lg:p-14">

            {/* Left column: Heading */}
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300 sm:text-sm">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                  style={{
                    boxShadow: "0 0 10px rgba(101,245,208,0.65)",
                  }}
                />

                Here to help
              </p>

              <h2 className="mt-5 max-w-md text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-5xl">
                A clearer path
                <br className="hidden md:block" /> to{" "}
                <span className="text-gradient">support.</span>
              </h2>

              {/* Small decorative accent */}
              <div
                aria-hidden="true"
                className="mt-6 h-1 w-14 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, #65f5d0, rgba(101,245,208,0.12))",
                }}
              />
            </div>

            {/* Right column: Description and contact */}
            <div className="min-w-0 md:max-w-lg md:justify-self-end">
              <p className="text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
                Find helpful information, explore support categories, and get
                direction on your next step. Clear communication and careful
                handling of sensitive information matter.
              </p>

              {/* Contact button */}
              <div className="mt-7">
                <a
                  href="mailto:Support@custodial.com"
                  className="button-primary group/button inline-flex min-h-12 items-center justify-center gap-3 rounded-xl border border-cyan-200/20 px-5 py-3 text-sm font-semibold sm:px-6 sm:text-base"
                >
                  Contact Support

                  <span
                    aria-hidden="true"
                    className="inline-block transition-transform duration-200 group-hover/button:translate-x-1 group-hover/button:-translate-y-0.5"
                  >
                    ↗
                  </span>
                </a>
              </div>

              {/* Support email */}
              <a
                href="mailto:Support@custodial.com"
                className="mt-4 inline-flex max-w-full break-all text-sm text-slate-400 transition-colors duration-200 hover:text-cyan-300"
              >
                Support@custodial.com
              </a>
            </div>
          </div>

          {/* Bottom edge highlight */}
          <div
            aria-hidden="true"
            className="absolute inset-x-8 bottom-0 h-px opacity-60"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(101,245,208,0.25), transparent)",
            }}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <a href="#home" className="font-semibold text-slate-300">
            Custodial<span className="text-cyan-300">Support</span>
          </a>
          <p>© 2026 Custodial Support. All rights reserved.</p>
          <a href="#about" className="transition-colors hover:text-white">Support information</a>
        </div>
      </footer>
    </main>
  );
}
