"use client";

import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { PhoneScreenUI } from "@/components/ui/PhoneScreenUI";
import { Reveal } from "@/components/ui/Reveal";

export function ScrollShowcase() {
  return (
    <section className="bg-bg-dark relative">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 md:pt-20 text-center">
        <Reveal>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">
            The experience
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-3xl md:text-5xl font-bold text-text-light tracking-tight">
            Feels like an app,
            <br className="hidden sm:block" />
            {" "}not a chore
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-4 text-text-muted-light max-w-lg mx-auto text-sm md:text-base">
            Clean, fast, zero friction. Discover meetups, join groups, unlock
            connections — all in a few taps.
          </p>
        </Reveal>
      </div>

      <ContainerScroll
        titleComponent={
          <h3 className="text-2xl md:text-4xl font-semibold text-text-light text-center mb-4">
            Scroll to explore
          </h3>
        }
      >
        <div className="flex items-center justify-center h-full w-full bg-bg relative">
          <div className="phone-realistic" style={{ transform: "scale(0.85)" }}>
            <div className="phone-realistic-screen">
              <PhoneScreenUI />
            </div>
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
}
