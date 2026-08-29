"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Soup, Gamepad2, Footprints, Coffee } from "lucide-react";
import { COPY, HERO_STICKERS, PHOTOS } from "@/lib/constants";
import { PhoneScreenUI } from "@/components/ui/PhoneScreenUI";
import { DraggableSticker } from "@/components/ui/DraggableSticker";
import { openWaitlistModal } from "@/components/WaitlistModal";

gsap.registerPlugin(ScrollTrigger);

type Pill = {
  icon: typeof Soup;
  label: string;
  cls: string;
  sz: number;
};

const PILLS: Pill[] = [
  { icon: Soup, label: "Ramen night", cls: "hp-a", sz: 15 },
  { icon: Gamepad2, label: "Board games", cls: "hp-b", sz: 13 },
  { icon: Footprints, label: "Weekend hike", cls: "hp-c", sz: 13 },
  { icon: Coffee, label: "Café hopping", cls: "hp-d", sz: 14 },
];

const SOCIAL = [
  { letter: "Y", bg: "linear-gradient(135deg,#E8634D,#F08A5D)" },
  { letter: "S", bg: "linear-gradient(135deg,#7A9E7E,#A8C3AB)" },
  { letter: "A", bg: "linear-gradient(135deg,#E4C25C,#EECF7A)" },
  { letter: "M", bg: "linear-gradient(135deg,#8B7EC8,#B3A9DB)" },
];

function HeroCtas({ className }: { className: string }) {
  return (
    <div className={`hero-fade flex flex-wrap items-center gap-3.5 ${className}`}>
      <button
        type="button"
        onClick={openWaitlistModal}
        className="inline-flex h-12 items-center px-8 text-sm font-semibold rounded-full bg-accent-strong text-white ring-1 ring-white/15 shadow-[0_12px_34px_-10px_rgba(232,99,77,0.75)] hover:bg-accent-strong/90 hover:shadow-[0_14px_38px_-8px_rgba(232,99,77,0.9)] transition-all duration-300 cursor-pointer"
      >
        Join the waitlist
      </button>
      <a
        href="#how-it-works"
        className="inline-flex h-12 items-center gap-2 px-6 text-sm font-medium rounded-full text-text-light/85 border border-white/20 hover:border-white/45 hover:text-text-light transition-all duration-300"
      >
        See how it works
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const host: HTMLElement = section;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const bg = section.querySelector<HTMLElement>(".hero-bg-pan");
      const bgImg = section.querySelector<HTMLElement>(".hero-bg-img");
      const brand = section.querySelector<HTMLElement>(".hero-brand");
      const innerLines = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hero-line .hero-inner"));
      const underline = section.querySelector<SVGPathElement>(".hero-underline path");
      const doodles = gsap.utils.toArray<SVGPathElement>(section.querySelectorAll(".hero-doodle"));
      const heart = section.querySelector<SVGPathElement>(".hero-heart path");
      const copy = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hero-fade"));
      const phone = section.querySelector<HTMLElement>(".hero-phone-float");
      const halo = section.querySelector<HTMLElement>(".hero-phone-halo");
      const brush = section.querySelector<HTMLElement>(".hero-brush");
      const shadow = section.querySelector<HTMLElement>(".hero-phone-shadow");
      const pills = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hp-pill"));
      const dots = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hero-dot"));
      const connects = section.querySelectorAll<SVGPathElement>(".hp-connects path");
      const strip = section.querySelector<HTMLElement>(".hero-edge-strip");

      if (reduce) {
        gsap.set([bgImg, brand, innerLines, copy, phone, pills, dots, halo, brush, shadow], { opacity: 1, y: 0, scale: 1 });
        return;
      }

      gsap.set(bgImg, { scale: 1.12, opacity: 0 });
      gsap.set(bg, { yPercent: 4 });
      gsap.set(brand, { opacity: 0, y: 22 });
      gsap.set(innerLines, { yPercent: 112 });
      gsap.set(copy, { opacity: 0, y: 22 });
      gsap.set(phone, { opacity: 0, y: 130, scale: 0.82, rotateY: -34, rotateX: 10 });
      gsap.set(halo, { opacity: 0, scale: 0.7 });
      gsap.set(brush, { opacity: 0, scale: 0.7 });
      gsap.set(shadow, { opacity: 0, scaleX: 0.4 });
      gsap.set(pills, { opacity: 0, y: 26, scale: 0.82 });
      gsap.set(dots, { opacity: 0, x: (i) => -10 - i * 6, y: 4 });
      gsap.set(connects, { strokeDashoffset: 200 });
      gsap.set(underline, { strokeDashoffset: 300 });
      gsap.set(doodles, { strokeDashoffset: 160 });
      gsap.set(heart, { strokeDashoffset: 160, opacity: 0 });
      gsap.set(strip, { opacity: 0 });

      const tl = gsap.timeline({ delay: 0.25 });

      tl.to(bgImg, { scale: 1, opacity: 1, duration: 2.2, ease: "expo.out" }, 0)
        .to(halo, { opacity: 1, scale: 1, duration: 1.6, ease: "expo.out" }, 0.4)
        .to(brand, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out" }, 0.45)
        .to(innerLines, { yPercent: 0, duration: 1.25, ease: "expo.out", stagger: 0.09 }, 0.55)
        .to(underline, { strokeDashoffset: 0, duration: 0.8, ease: "power2.out" }, 1.15)
        .to(heart, { strokeDashoffset: 0, opacity: 1, duration: 0.7, ease: "power2.out" }, 1.35)
        .to(copy, { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", stagger: 0.09 }, "-=0.4")
        .to(phone, { opacity: 1, y: 0, scale: 1, rotateY: 0, rotateX: 0, duration: 1.9, ease: "expo.out" }, 0.9)
        .to(shadow, { opacity: 1, scaleX: 1, duration: 1.2, ease: "expo.out" }, 1.4)
        .to(brush, { opacity: 1, scale: 1, duration: 1.4, ease: "expo.out" }, 1.5)
        .to(pills, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.6)", stagger: 0.1 }, "-=1.1")
        .to(connects, { strokeDashoffset: 0, duration: 1.3, ease: "power1.inOut", stagger: 0.2 }, "-=0.9")
        .to(dots, { opacity: 1, x: 0, y: 0, duration: 0.8, ease: "power2.out", stagger: 0.12 }, "-=0.7")
        .to(doodles, { strokeDashoffset: 0, duration: 1.1, ease: "power1.inOut" }, "-=0.8")
        .to(strip, { opacity: 1, duration: 1.2, ease: "power1.out" }, "-=0.8");

      gsap.timeline({
        scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
      }).to(bg, { yPercent: -8, ease: "none" }, 0);

      const pointerX = gsap.quickTo(phone, "x", { duration: 0.7, ease: "power3.out" });
      const pointerRy = gsap.quickTo(phone, "rotationY", { duration: 0.7, ease: "power3.out" });
      const pointerRx = gsap.quickTo(phone, "rotationX", { duration: 0.7, ease: "power3.out" });

      function onMove(e: PointerEvent) {
        if (window.innerWidth < 1024) return;
        const r = host.getBoundingClientRect();
        const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
        pointerX(nx * 14);
        pointerRy(nx * -7);
        pointerRx(ny * 4);
      }

      host.addEventListener("pointermove", onMove, { passive: true });
    }, section);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="noise relative flex min-h-dvh items-center overflow-hidden bg-[#0B0A0A] xl:h-dvh"
    >
      {/* LAYER 1 · background */}
      <div className="hero-bg-pan absolute inset-0">
        <img
          src={PHOTOS.hero}
          alt="A small group of friends gathered around a table at dusk in Osaka"
          className="hero-bg-img w-full h-full object-cover"
          style={{ objectPosition: "68% 46%" }}
          fetchPriority="high"
          decoding="async"
        />
      </div>

      {/* LAYER 2 · cinematic grade */}
      <div className="absolute inset-0" style={{
        background:
          "linear-gradient(180deg, rgba(10,9,9,0.92) 0%, rgba(10,9,9,0.42) 34%, rgba(10,9,9,0.55) 62%, rgba(10,9,9,0.94) 100%)",
      }} />
      <div className="absolute inset-0" style={{
        background:
          "linear-gradient(94deg, rgba(10,9,9,0.94) 0%, rgba(10,9,9,0.55) 34%, rgba(10,9,9,0.12) 56%, rgba(10,9,9,0.75) 94%)",
      }} />
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(52% 46% at 66% 46%, rgba(255,190,124,0.14) 0%, transparent 70%)",
      }} />
      <div className="absolute inset-0" style={{
        background:
          "radial-gradient(70% 62% at 80% 58%, transparent 26%, rgba(8,7,7,0.62) 100%)",
      }} />

      {/* distant city-lights glints */}
      <div className="pointer-events-none absolute inset-0 opacity-50" aria-hidden="true">
        <span className="absolute left-[62%] top-[26%] h-1 w-1 rounded-full bg-[#FFD9A0]" />
        <span className="absolute left-[76%] top-[34%] h-1.5 w-1.5 rounded-full bg-[#FFC9A0]" />
        <span className="absolute left-[70%] top-[58%] h-1 w-1 rounded-full bg-[#FFE3B8]" />
        <span className="absolute left-[86%] top-[48%] h-0.5 w-0.5 rounded-full bg-white/90" />
        <span className="absolute left-[58%] top-[66%] h-0.5 w-0.5 rounded-full bg-[#FFD9A0]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 md:py-14 xl:py-8">
        <div className="grid items-center gap-14 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-8">
          {/* ── Left · typographic column ── */}
          {/* The fixed navbar sits over the hero, and at xl the section is height-locked
              (py-8), so the column is nudged down to clear the wordmark. */}
          <div className="max-w-2xl xl:mt-16">
            {/* brand detail */}
            <div className="hero-brand flex items-baseline gap-3">
              <span className="font-jp text-[26px] font-bold tracking-tight text-accent md:text-[30px]">
                集まる
              </span>
              <span className="hidden h-px w-8 bg-white/20 sm:block" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-text-muted-light sm:text-[11px]">
                To gather · to come together
              </span>
              <svg className="hero-heart mt-1 hidden sm:block" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 20.5c-4.6-3-7.5-6-7.5-9a4.2 4.2 0 0 1 7.5-2.6A4.2 4.2 0 0 1 19.5 11.5c0 3-2.9 6-7.5 9z"
                  stroke="#E8634D" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>

            {/* sticker kicker */}
            <div className="hero-fade mt-4 flex flex-wrap items-center gap-2.5">
              <span className="sticker-badge">{COPY.hero.kicker}</span>
              <span className="sticker-badge sticker-lilac">Friendship first</span>
            </div>

            {/* headline */}
            <h1 className="hero-heading mt-4 font-bold uppercase leading-[0.9] tracking-tight text-text-light md:mt-5"
              style={{ fontSize: "clamp(2.5rem, 6.6vw, 5.4rem)" }}>
              <span className="hero-line block overflow-hidden">
                <span className="hero-inner inline-block pb-[0.3em]">Meet people.</span>
              </span>
              <span className="hero-line block overflow-hidden">
                <span className="hero-inner inline-block pb-[0.3em]">
                  <span className="relative inline-block pr-[0.24em]">
                    <span className="relative inline-block -rotate-2 text-accent" style={{ marginRight: "-0.24em" }}>
                      Not
                    </span>
                    <svg className="hero-underline absolute -bottom-[0.2em] left-0 w-[0.9em] overflow-visible" viewBox="0 0 120 16" fill="none" aria-hidden="true">
                      <path d="M5 11 C 22 4, 40 13, 58 9 S 92 5, 115 10" stroke="#C8FF00" strokeWidth="7" strokeLinecap="round" />
                    </svg>
                  </span>
                </span>
              </span>
              <span className="hero-line block overflow-hidden">
                <span className="hero-inner inline-block pb-[0.3em]">profiles.</span>
              </span>
            </h1>

            {/* supporting copy */}
            <p className="hero-fade mt-4 max-w-md text-base font-semibold leading-relaxed text-text-light md:text-lg">
              {COPY.hero.sub}
            </p>
            <p className="hero-fade mt-3 max-w-md text-sm leading-relaxed text-text-muted-light/80 md:text-base">
              {COPY.hero.subQuiet}
            </p>

            <HeroCtas className="mt-7 hidden md:flex" />

            {/* social proof */}
            <div className="hero-fade mt-8 flex items-center gap-3.5 md:mt-9">
              <div className="flex -space-x-2">
                {SOCIAL.map((s) => (
                  <span
                    key={s.letter}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/50 text-[10px] font-bold text-white shadow-lg"
                    style={{ background: s.bg }}
                  >
                    {s.letter}
                  </span>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-light">Early community</p>
                <p className="text-[11px] text-text-muted-light">Growing every day</p>
              </div>
            </div>
          </div>

          {/* ── Right · phone stage ── */}
          <div className="hero-stage relative mx-auto w-full max-w-[420px] xl:mx-0 xl:w-[520px] xl:max-w-none xl:h-[min(754px,calc(100dvh-4rem))]">
            {/* doodles + connectors behind phone */}
            <svg className="hp-connects pointer-events-none absolute inset-0 hidden xl:block" viewBox="0 0 520 690" fill="none" aria-hidden="true">
              <path d="M46 96 C 130 150, 150 250, 190 330" stroke="rgba(255,255,255,0.28)" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
              <path d="M474 44 C 385 84, 318 150, 282 232" stroke="rgba(232,99,77,0.55)" strokeWidth="2.5" strokeDasharray="1 9" strokeLinecap="round" />
              <path d="M470 618 C 400 560, 360 470, 330 400" stroke="rgba(122,158,126,0.4)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
            </svg>

            {/* halo + brush behind phone */}
            <div className="hero-phone-halo pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[78%] w-[86%] rounded-full" style={{
                background: "radial-gradient(circle, rgba(232,99,77,0.20) 0%, rgba(232,99,77,0.05) 45%, transparent 70%)",
              }} />
            </div>

            <svg className="hero-brush pointer-events-none absolute right-[-6%] bottom-[-8%] w-[58%] opacity-25 blur-md" viewBox="0 0 300 260" fill="none" aria-hidden="true">
              <path d="M36 84 C 96 34, 176 26, 226 62 C 274 96, 272 162, 222 196 C 174 228, 86 226, 46 180 C 10 138, 8 108, 36 84z"
                fill="#E8634D" opacity="0.55" />
              <path d="M64 120 C 100 74, 168 66, 208 92 C 246 118, 236 174, 192 200 C 150 224, 84 220, 60 184 C 40 154, 42 146, 64 120z"
                fill="#7A9E7E" opacity="0.35" />
            </svg>

            {/* ground shadow */}
            <div className="hero-phone-shadow pointer-events-none absolute -bottom-2 left-1/2 h-8 w-[52%] -translate-x-1/2 rounded-[50%]" style={{
              background: "radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, transparent 70%)",
              filter: "blur(10px)",
            }} />

            {/* the phone (scaled, tilted, lit) */}
            <div className="hero-phone-float relative flex items-end justify-center lg:h-full" style={{ perspective: "1400px" }}>
              <div className="hero-phone-scale relative">
                <div className="hero-phone-scene">
                  <div className="phone-tilt-wrapper">
                    <div className="phone-tilt">
                      <div className="phone-realistic">
                        <div className="phone-realistic-screen">
                          <PhoneScreenUI />
                        </div>
                        {/* Extruded flanks with their physical buttons */}
                        <div className="phone-side-left">
                          <span className="phone-btn phone-btn-mute" />
                          <span className="phone-btn phone-btn-vol-up" />
                          <span className="phone-btn phone-btn-vol-down" />
                        </div>
                        <div className="phone-side">
                          <span className="phone-btn phone-btn-power" />
                        </div>
                        <div className="phone-bottom" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* gathering dots */}
            <span className="hero-dot pointer-events-none absolute left-[24%] bottom-[16%] h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="hero-dot pointer-events-none absolute left-[33%] bottom-[11%] h-2 w-2 rounded-full bg-accent/55" />
            <span className="hero-dot pointer-events-none absolute left-[42%] bottom-[7%] h-1.5 w-1.5 rounded-full bg-accent/40" />

            {/* activity pills */}
            {PILLS.map((p) => (
              <div
                key={p.label}
                className={`float-pill hp-pill ${p.cls} absolute z-20 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5`}
              >
                <span className="flex items-center justify-center">
                  <p.icon size={p.sz} strokeWidth={2.1} />
                </span>
                <span className="text-xs font-semibold whitespace-nowrap text-text-light" style={{ fontSize: `${p.sz - 2}px` }}>
                  {p.label}
                </span>
              </div>
            ))}

            {/* draggable stickers — desktop only, where there is room to toss them */}
            {HERO_STICKERS.map((sticker) => (
              // The wrapper owns the entrance animation so GSAP never fights the
              // sticker's own drag transform.
              <div
                key={sticker.text}
                className={`hero-fade absolute z-30 hidden lg:block ${sticker.pos}`}
              >
                <DraggableSticker
                  text={sticker.text}
                  tone={sticker.tone}
                  tilt={sticker.tilt}
                />
              </div>
            ))}

            {/* doodle arrow → phone */}
            <svg className="hero-doodle pointer-events-none absolute hidden xl:block" style={{ left: "6%", top: "calc(8% + var(--hp-gap))" }} width="46" height="52" viewBox="0 0 46 52" fill="none" aria-hidden="true">
              <path d="M4 6 C 12 22, 26 30, 38 44 M30 36 l10 8 -12 3" stroke="rgba(255,255,255,0.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* mobile CTAs below the phone */}
        <HeroCtas className="mt-10 flex md:hidden" />
      </div>

      {/* editorial vertical strip */}
      <div className="hero-edge-strip pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rotate-90 xl:block" aria-hidden="true">
        <span className="text-[10px] font-semibold uppercase tracking-[0.5em] text-white/25">
          No profiles — real plans —
        </span>
      </div>
    </section>
  );
}