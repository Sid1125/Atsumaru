"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/ui/Reveal";
import { AI_FLOW, COPY } from "@/lib/constants";
import { AIChatDemo } from "@/components/ui/ai-chat-demo";

gsap.registerPlugin(ScrollTrigger);

export function AISection() {
  const sectionRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const chipsEl = chipsRef.current;
      if (chipsEl) {
        const chips = gsap.utils.toArray<HTMLElement>(chipsEl.querySelectorAll(".ai-chip"));
        gsap.set(chips, { opacity: 0, scale: 0.7, y: 15 });
        gsap.to(chips, {
          opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "back.out(1.7)", stagger: 0.1,
          scrollTrigger: { trigger: chipsEl, start: "top 80%", toggleActions: "play none none none" },
        });
      }

      const scoreEl = scoreRef.current;
      if (scoreEl) {
        const numEl = scoreEl.querySelector<HTMLElement>(".score-num");
        if (numEl) {
          const obj = { val: 0 };
          gsap.to(obj, {
            val: AI_FLOW.match.score,
            duration: 2,
            ease: "power2.out",
            onUpdate: () => { numEl.textContent = `${Math.round(obj.val)}%`; },
            scrollTrigger: { trigger: scoreEl, start: "top 80%", toggleActions: "play none none none" },
          });
        }
        const ring = scoreEl.querySelector<HTMLElement>(".score-ring");
        if (ring) {
          gsap.to(ring, {
            strokeDashoffset: 283 - (283 * AI_FLOW.match.score / 100),
            duration: 2,
            ease: "power2.out",
            scrollTrigger: { trigger: scoreEl, start: "top 80%", toggleActions: "play none none none" },
          });
        }
      }
    }, section);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="ambient-surface-dark py-24 md:py-32 text-text-light relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <span className="sticker-badge sticker-lilac">Two-minute chat</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text-light leading-[0.95]">
            {COPY.ai.heading}<br />
            <span className="marker text-[#09090B]" style={{ ["--marker-color" as string]: "#00F0FF" }}>
              {COPY.ai.headingAccent}
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 text-lg text-text-muted-light max-w-xl">{COPY.ai.sub}</p>
        </Reveal>

        <div className="mt-16 md:mt-24 grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left: Flow */}
          <div className="space-y-6">
            <Reveal from="left">
              <div className="bg-surface-dark rounded-2xl p-6 border border-border-dark">
                <p className="text-xs font-medium text-text-muted-light mb-3 uppercase tracking-wide">You say</p>
                <p className="text-base text-text-light leading-relaxed italic">&ldquo;{AI_FLOW.userSays}&rdquo;</p>
              </div>
            </Reveal>

            <div className="flex justify-center">
              <div className="w-px h-8 bg-accent/40 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-r-2 border-b-2 border-accent rotate-45 -translate-y-1" />
              </div>
            </div>

            <Reveal from="left" delay={0.1}>
              <div ref={chipsRef} className="flex flex-wrap gap-2">
                {AI_FLOW.extracted.map((chip) => (
                  <span key={chip} className="ai-chip sticker-badge sticker-cyan">
                    {chip}
                  </span>
                ))}
              </div>
            </Reveal>

            <div className="flex justify-center">
              <div className="w-px h-8 bg-accent/40 relative">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-r-2 border-b-2 border-accent rotate-45 -translate-y-1" />
              </div>
            </div>

            <Reveal from="left" delay={0.2}>
              <div className="bg-surface-dark rounded-2xl p-6 border border-accent/20">
                <p className="text-xs font-medium text-text-muted-light mb-4 uppercase tracking-wide">Suggested for you</p>

                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xl font-bold text-text-light">{AI_FLOW.match.title}</p>
                    <p className="text-sm text-text-muted-light mt-1">Shibuya · Sat 7 PM</p>
                    <div className="mt-4 space-y-2">
                      {AI_FLOW.match.reasons.map((r) => (
                        <div key={r} className="flex items-center gap-2 text-sm text-text-muted-light">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div ref={scoreRef} className="flex-shrink-0 relative w-24 h-24">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
                      <circle
                        className="score-ring"
                        cx="50" cy="50" r="45"
                        fill="none"
                        stroke="var(--color-accent)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        style={{ strokeDashoffset: 283 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="score-num text-2xl font-bold text-accent">0%</span>
                      <span className="text-[9px] text-text-muted-light uppercase">fit</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: Live chat demo */}
          <div className="lg:sticky lg:top-32">
            <Reveal from="right">
              <AIChatDemo />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
