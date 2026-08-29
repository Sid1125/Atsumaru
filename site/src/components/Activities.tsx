"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { ACTIVITIES } from "@/lib/constants";

export function Activities() {
  return (
    <section className="py-24 md:py-32 bg-bg-dark text-text-light relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern-dark" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            What could you<br /><Highlight>gather around?</Highlight>
          </h2>
        </Reveal>

        {/* Masonry grid */}
        <div className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {ACTIVITIES.map((a, i) => (
            <Reveal key={a.label} delay={i * 0.05}>
              <div className={`activity-card relative rounded-2xl overflow-hidden group cursor-default ${
                i === 0 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" :
                i === 3 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" :
                "aspect-square"
              }`}>
                <img
                  src={a.photo}
                  alt={a.label}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
                  <a.icon size={34} className="mb-2 text-white" strokeWidth={1.8} />
                  <p className="text-base md:text-lg font-bold text-white">{a.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
