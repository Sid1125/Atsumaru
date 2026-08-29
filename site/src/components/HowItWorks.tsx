"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { HOW_STEPS } from "@/lib/constants";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-bg-dark text-text-light relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-dark" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            Five steps to your<br />
            <Highlight>next gathering</Highlight>
          </h2>
        </Reveal>

        {/* Timeline */}
        <div className="mt-16 md:mt-24 relative">
          {/* Vertical line */}
          <div className="hidden md:block absolute left-8 top-0 bottom-0 w-px bg-border-dark" />

          <div className="space-y-0">
            {HOW_STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.08}>
                <div className="relative grid md:grid-cols-[80px_1fr_1fr] gap-6 md:gap-12 items-center py-12 md:py-16 border-b border-border-dark/50 last:border-b-0">
                  {/* Step number */}
                  <div className="hidden md:flex relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-accent-strong flex items-center justify-center text-lg font-bold text-white">
                      {step.num}
                    </div>
                  </div>

                  {/* Text */}
                  <div>
                    <span className="md:hidden text-sm font-bold text-accent mb-2 block">{step.num}</span>
                    <h3 className="text-2xl md:text-3xl font-bold mb-3">{step.title}</h3>
                    <p className="text-base text-text-muted-light leading-relaxed">{step.desc}</p>
                  </div>

                  {/* Photo */}
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-surface-dark">
                    <img
                      src={step.photo}
                      alt={step.title}
                      className="w-full h-full object-cover opacity-80 hover:opacity-100 hover:scale-105 transition-all duration-700"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/40 to-transparent" />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
