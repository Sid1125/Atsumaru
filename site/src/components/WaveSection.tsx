"use client";

import { WaveField } from "@/components/ui/wave-field";
import { Reveal } from "@/components/ui/Reveal";

export function WaveSection() {
  return (
    <section className="relative bg-bg-dark overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-20 md:pt-24 text-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">
            Feel the rhythm
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-3xl md:text-5xl font-bold text-text-light tracking-tight">
            Connections that move
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-4 text-text-muted-light max-w-lg mx-auto text-sm md:text-base">
            Every interaction has a pulse. Hover to feel the wave.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 md:mt-16 max-w-5xl mx-auto px-5 sm:px-8 pb-20 md:pb-24">
        <WaveField headline="集まる" dark className="h-[400px] md:h-[500px]" />
      </div>
    </section>
  );
}
