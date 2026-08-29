"use client";

import { Reveal } from "@/components/ui/Reveal";
import { StickerArt } from "@/components/ui/StickerArt";
import { COPY, HOW_STEPS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="ambient-surface-dark py-24 md:py-32 text-text-light relative overflow-hidden scroll-mt-24">
      <StickerArt name="arcade" size={104} tilt={-11} className="pointer-events-none absolute right-[5%] top-20 hidden lg:block" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <span className="sticker-badge sticker-cyan">5 steps</span>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text-light leading-[0.95]">
            {COPY.how.heading}<br />
            <span className="marker text-[#09090B]" style={{ ["--marker-color" as string]: "#C8FF00" }}>
              {COPY.how.headingAccent}
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mt-6 max-w-xl text-lg text-text-muted-light">{COPY.how.sub}</p>
        </Reveal>

        {/* Timeline */}
        <div className="mt-16 md:mt-24 relative">
          {/* Vertical line */}
          <div className="hidden md:block absolute left-8 top-0 bottom-0 w-px bg-white/10" />

          <div className="space-y-0">
            {HOW_STEPS.map((step, i) => {
              const isLast = i === HOW_STEPS.length - 1;

              return (
                <Reveal key={step.num} delay={i * 0.08}>
                  <div className="relative grid md:grid-cols-[80px_1fr_1fr] gap-6 md:gap-12 items-center py-12 md:py-16 border-b border-white/10 last:border-b-0">
                    {/* Step number — the payoff step gets the neon treatment */}
                    <div className="hidden md:flex relative z-10">
                      <div
                        className={`flex h-16 w-16 -rotate-3 items-center justify-center rounded-2xl border-2 border-black font-mono text-lg font-black shadow-[3px_4px_0_rgba(0,0,0,0.9)] ${
                          isLast ? "bg-neon text-[#09090B]" : "bg-accent-strong text-white"
                        }`}
                      >
                        {step.num}
                      </div>
                    </div>

                    {/* Text */}
                    <div>
                      <span className="md:hidden font-mono text-sm font-bold text-neon mb-2 block">{step.num}</span>
                      <h3 className="text-2xl md:text-3xl font-bold text-text-light mb-3">{step.title}</h3>
                      <p className="text-base text-text-light/75 leading-relaxed">{step.desc}</p>
                    </div>

                    {/* Photo */}
                    <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-surface-dark border border-white/10">
                      <img
                        src={step.photo}
                        alt={step.title}
                        className="w-full h-full object-cover opacity-85 hover:opacity-100 hover:scale-105 transition-all duration-700"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
