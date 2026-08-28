"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { PHOTOS } from "@/lib/constants";
import { PhoneScreenUI } from "@/components/ui/PhoneScreenUI";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const heading = section.querySelector(".hero-heading");
    if (!heading) return;

    const lines = heading.querySelectorAll(".hero-line");
    lines.forEach((line) => {
      const text = line.textContent || "";
      line.innerHTML = "";
      text.split(/\s+/).forEach((word, wi, arr) => {
        const mask = document.createElement("span");
        mask.style.cssText = "display:inline-block;overflow:hidden;vertical-align:top;margin-right:0.3em";
        const inner = document.createElement("span");
        inner.style.display = "inline-block";
        inner.textContent = word;
        mask.appendChild(inner);
        line.appendChild(mask);
        if (wi < arr.length - 1) line.appendChild(document.createTextNode(" "));
      });
    });

    const wordInners = gsap.utils.toArray<HTMLElement>(heading.querySelectorAll(".hero-line span span"));
    const staggerEls = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hero-stagger"));
    const phone = section.querySelector<HTMLElement>(".hero-phone-wrapper");
    const cards = gsap.utils.toArray<HTMLElement>(section.querySelectorAll(".hero-float"));
    const bgImg = section.querySelector<HTMLElement>(".hero-bg-img");

    gsap.set(wordInners, { yPercent: 110 });
    gsap.set(staggerEls, { opacity: 0, y: 25 });
    if (phone) gsap.set(phone, { opacity: 0, scale: 0.8, y: 60, rotateY: -15 });
    gsap.set(cards, { opacity: 0, scale: 0.85, y: 15 });
    if (bgImg) gsap.set(bgImg, { scale: 1.1, opacity: 0 });

    const tl = gsap.timeline({ delay: 0.3 });

    if (bgImg) {
      tl.to(bgImg, { scale: 1, opacity: 0.35, duration: 2, ease: "expo.out" }, 0);
    }

    tl.to(wordInners, {
      yPercent: 0,
      duration: 1.3,
      ease: "expo.out",
      stagger: 0.05,
    }, 0.4);

    tl.to(staggerEls, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "expo.out",
      stagger: 0.08,
    }, "-=0.7");

    if (phone) {
      tl.to(phone, {
        opacity: 1,
        scale: 1,
        y: 0,
        rotateY: 0,
        duration: 1.6,
        ease: "expo.out",
      }, "-=0.6");
    }

    tl.to(cards, {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.6,
      ease: "back.out(1.4)",
      stagger: 0.07,
    }, "-=1.0");

    return () => { tl.kill(); };
  }, []);

  const floatingActivities = [
    { emoji: "🍜", label: "Ramen night", x: -80, y: 40, rotate: -8 },
    { emoji: "🎮", label: "Board games", x: -110, y: 210, rotate: 5 },
    { emoji: "🥾", label: "Weekend hike", x: 55, y: 380, rotate: -4 },
    { emoji: "☕", label: "Café hopping", x: -55, y: 520, rotate: 6 },
  ];

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-bg-dark" style={{ minHeight: "100vh" }}>
      <div className="absolute inset-0">
        <img src={PHOTOS.hero} alt="" className="hero-bg-img w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-dark/70 via-bg-dark/50 to-bg-dark" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-24 pb-16 md:pt-28 md:pb-20 flex items-center" style={{ minHeight: "100vh" }}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-6 items-center w-full">
          <div className="max-w-xl">
            <p className="hero-stagger text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-5">
              {`集まる — to gather, to come together`}
            </p>

            <h1 className="hero-heading text-5xl sm:text-6xl md:text-7xl lg:text-[6.5rem] font-bold tracking-tight leading-[0.88] text-text-light">
              <span className="hero-line block">Meet people.</span>
              <span className="hero-line block mt-1">Not profiles.</span>
            </h1>

            <p className="hero-stagger mt-7 text-base md:text-lg text-text-muted-light leading-relaxed max-w-md">
              Small groups. Real activities. Low-pressure connections.
              The social app that gets you out of your phone and into the world.
            </p>

            <div className="hero-stagger mt-8 flex flex-wrap items-center gap-3">
              <a href="#cta" className="magnetic-btn h-12 px-7 text-sm font-semibold rounded-full bg-accent text-white hover:bg-accent/90 transition-shadow duration-200 shadow-lg shadow-accent/30 hover:shadow-accent/40 inline-flex items-center">
                Join the waitlist
              </a>
              <a href="#how-it-works" className="h-12 px-5 text-sm font-medium rounded-full text-text-muted-light hover:text-text-light border border-border-dark hover:border-text-muted-light/30 transition-all duration-200 inline-flex items-center gap-2">
                See how it works
                <svg className="animate-bounce" width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="hidden lg:block absolute inset-0 pointer-events-none" style={{ width: "600px", height: "700px" }}>
              {floatingActivities.map((a) => (
                <div
                  key={a.label}
                  className="hero-float float-pill absolute bg-white/10 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/10 shadow-xl"
                  style={{
                    left: `${a.x}px`,
                    top: `${a.y}px`,
                    transform: `rotate(${a.rotate}deg)`,
                  }}
                >
                  <span className="text-xl">{a.emoji}</span>
                  <span className="text-xs font-medium text-text-light whitespace-nowrap">{a.label}</span>
                </div>
              ))}
            </div>

            <div className="hero-phone-wrapper relative" style={{ perspective: "1200px" }}>
              <div className="phone-tilt-wrapper">
                <div className="phone-tilt">
                  <div className="phone-realistic">
                    <div className="phone-realistic-screen">
                      <PhoneScreenUI />
                    </div>
                    <div className="phone-side" />
                    <div className="phone-bottom" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
