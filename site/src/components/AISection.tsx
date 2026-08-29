"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { AI_FLOW } from "@/lib/constants";
import { AIChatDemo } from "@/components/ui/ai-chat-demo";

gsap.registerPlugin(ScrollTrigger);

export function AISection() {
  const chipsRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

  return (
    <section className="py-24 md:py-32 bg-bg-dark text-text-light relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-dark" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            AI that gets<br />the <Highlight>vibe</Highlight>.
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 text-lg text-text-muted-light max-w-xl">
            Not a generic algorithm. A short conversation that understands who you are and what you&apos;re looking for.
          </p>
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
                  <span key={chip} className="ai-chip inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent/15 text-accent text-sm font-medium border border-accent/20">
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
                        <p key={r} className="text-sm text-text-muted-light">{r}</p>
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
