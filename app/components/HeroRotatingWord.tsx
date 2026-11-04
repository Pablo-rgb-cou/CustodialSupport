"use client";

import { useEffect, useState, type CSSProperties } from "react";

const phrases = ["Your next step,", "Your wallet,", "Your transfer,", "Your account,", "Your questions,"];

export default function HeroRotatingWord() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;
    const update = () => {
      window.clearInterval(timer);
      if (!motion.matches) timer = window.setInterval(() => setStep((value) => value + 1), 7000);
    };
    update();
    motion.addEventListener("change", update);
    return () => { window.clearInterval(timer); motion.removeEventListener("change", update); };
  }, []);

  const active = step % phrases.length;
  const previous = step > 0 ? (active + phrases.length - 1) % phrases.length : -1;

  return <span className="hero-word-stage">
    <span className="sr-only">Your next step,</span>
    <span aria-hidden="true" className="hero-word-visual">
      {phrases.map((phrase, index) => <span key={phrase} className={`hero-rotating-word ${index === active ? "is-current" : index === previous ? "is-previous" : ""}`}>
        {Array.from(phrase).map((letter, position) => <span key={`${step}-${position}`} className={`hero-rotating-letter ${step === 0 ? "is-initial" : ""}`} style={{ "--letter-delay": `${position * 55}ms`, "--letter-turn": `${position % 2 === 0 ? -90 : 90}deg`, "--letter-travel": `${position % 2 === 0 ? 1 : -1}em` } as CSSProperties}>{letter === " " ? "\u00a0" : letter}</span>)}
      </span>)}
    </span>
  </span>;
}
