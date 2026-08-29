"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const WORDS = ["やあ", "Hello", "你好", "Gather"];

export function Preloader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glow = glowRef.current;
    const brand = brandRef.current;
    const word = wordRef.current;
    const text = textRef.current;
    const tag = tagRef.current;
    const wave = waveRef.current;
    const path = pathRef.current;
    if (!root || !glow || !brand || !word || !text || !tag || !wave || !path) return;

    const hostRoot = root;
    const hostGlow = glow;
    const hostBrand = brand;
    const hostWord = word;
    const hostText = text;
    const hostTag = tag;
    const hostWave = wave;
    const hostPath = path;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      hostRoot.style.display = "none";
      return;
    }

    const dim = { w: window.innerWidth, h: window.innerHeight };
    const paths = () => ({
      initial: `M0 0 L${dim.w} 0 L${dim.w} ${dim.h} Q${dim.w / 2} ${dim.h + 300} 0 ${dim.h} L0 0`,
      target: `M0 0 L${dim.w} 0 L${dim.w} ${dim.h} Q${dim.w / 2} ${dim.h} 0 ${dim.h} L0 0`,
    });
    const setPath = () => hostPath.setAttribute("d", paths().initial);
    setPath();

    const html = document.documentElement;
    const body = document.body;
    const prev = { html: html.style.overflow, body: body.style.overflow };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    const dots = gsap.utils.toArray<HTMLElement>(hostWave.querySelectorAll(".pre-dot"));

    /* ── entrance ── */
    gsap.set([hostBrand, hostTag], { opacity: 0, y: 10 });
    gsap.set(hostWord, { opacity: 0, y: 20 });
    gsap.set(hostGlow, { opacity: 0, scale: 0.8 });
    gsap.set(dots, { opacity: 0, scale: 0.2, x: (i) => [-60, 55, 0][i], y: (i) => [18, -14, -48][i] });

    const intro = gsap.timeline({ delay: 0.15 });
    intro
      .to(hostGlow, { opacity: 1, scale: 1, duration: 1.6, ease: "expo.out" }, 0)
      .to(hostBrand, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.05)
      .to(hostWord, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0.15)
      .to(dots, { opacity: 1, scale: 1, x: 0, y: 0, duration: 1, stagger: 0.08, ease: "power2.out" }, 0.7)
      .to(hostTag, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }, 1.0);

    /* ── greeting cycle ── */
    let index = 0;
    hostText.textContent = WORDS[index];

    const flip = () =>
      gsap.fromTo(
        hostText,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.22, ease: "power2.out", overwrite: "auto" }
      );

    function cycle() {
      if (index === WORDS.length - 1) return;
      const delay = index === 0 ? 1.05 : 0.24;
      gsap.delayedCall(delay, () => {
        index += 1;
        hostText.textContent = WORDS[index];
        flip();
        cycle();
      });
    }
    cycle();

    const totalDelay = WORDS.length * 0.24 + 1.55;

    /* ── curtain exit ── */
    const tl = gsap.timeline({
      delay: totalDelay,
      defaults: { ease: "power4.inOut" },
      onComplete: () => {
        hostRoot.style.display = "none";
        html.style.overflow = prev.html;
        body.style.overflow = prev.body;
      },
    });

    tl.to([hostWord, hostBrand, hostTag], { opacity: 0, duration: 0.25 }, 0)
      .to(hostGlow, { opacity: 0, duration: 0.3 }, 0)
      .to(dots, { opacity: 0, scale: 0.4, duration: 0.25 }, 0)
      .to(hostRoot, { y: "-100vh", duration: 0.8, delay: 0.2 }, 0)
      .fromTo(
        hostPath,
        { attr: { d: paths().initial } },
        { attr: { d: paths().target }, duration: 0.7, delay: 0.3 },
        0
      );

    const onResize = () => {
      dim.w = window.innerWidth;
      dim.h = window.innerHeight;
      setPath();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      tl.kill();
      intro.kill();
      gsap.killTweensOf([hostRoot, hostWord, hostBrand, hostTag, hostGlow, ...dots]);
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="noise fixed inset-0 z-[200] flex items-center justify-center bg-bg-warm"
    >
      {/* curtain wipe */}
      <svg
        className="pointer-events-none absolute left-0 top-0 w-full"
        style={{ height: "calc(100% + 300px)" }}
        preserveAspectRatio="none"
        fill="none"
      >
        <path ref={pathRef} fill="#1A1714" />
      </svg>

      {/* vignette — keeps the eye on the center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(90% 72% at 50% 50%, transparent 48%, rgba(11,10,10,0.55) 100%)",
        }}
      />

      {/* coral glow behind word */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[52vmin] w-[52vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(232,99,77,0.24) 0%, rgba(232,99,77,0.07) 45%, transparent 70%)",
          opacity: 0,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* brand mark */}
        <div ref={brandRef} className="flex items-center gap-4" style={{ opacity: 0 }}>
          <span className="h-px w-10 bg-white/15" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.6em] text-text-muted-light">
            Atsumaru
          </span>
          <span className="h-px w-10 bg-white/15" />
        </div>

        {/* greeting */}
        <div ref={wordRef} className="flex items-center gap-5 text-white" style={{ fontSize: "clamp(48px, 9vw, 104px)", opacity: 0 }}>
          <span ref={waveRef} className="relative z-[2] h-4 w-4 shrink-0 rounded-full bg-accent shadow-[0_0_28px_rgba(232,99,77,0.95)]">
            <span className="pre-dot absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0" />
            <span className="pre-dot absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sage opacity-0" />
            <span className="pre-dot absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-light opacity-0" />
          </span>
          <span ref={textRef} className="font-jp font-semibold tracking-tight" style={{ textShadow: "0 2px 30px rgba(0,0,0,0.55)" }}>
            やあ
          </span>
        </div>

        {/* tagline */}
        <p ref={tagRef} className="text-[10px] font-semibold uppercase tracking-[0.5em] text-text-muted-light sm:text-xs" style={{ opacity: 0 }}>
          Gather around what you love
        </p>
      </div>
    </div>
  );
}