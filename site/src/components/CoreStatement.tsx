"use client";

import { Reveal } from "@/components/ui/Reveal";
import { PHOTOS } from "@/lib/constants";

export function CoreStatement() {
  return (
    <section className="relative py-0 overflow-hidden">
      {/* Full-bleed photo */}
      <div className="relative h-[70vh] md:h-[80vh]">
        <img
          src={PHOTOS.groupRamen}
          alt="Friends sharing ramen"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {/* Stronger gradient for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

        {/* Typography overlay */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 md:pb-24 w-full">
            <Reveal>
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-accent mb-4 drop-shadow-lg">
                The truth
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[0.95] max-w-3xl"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                Maybe you don&apos;t want a date.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p
                className="mt-6 text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight max-w-2xl"
                style={{ textShadow: "0 2px 16px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)" }}
              >
                Maybe you just want people to grab ramen with.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="mt-6 text-base md:text-lg text-white/80 max-w-xl leading-relaxed drop-shadow-md">
                You don&apos;t have to decide what a relationship is before meeting
                someone. You can simply play games, grab coffee, go hiking, explore a
                new place, and meet people who like the same things.
              </p>
            </Reveal>
            <Reveal delay={0.4}>
              <p className="mt-3 text-base text-white/60 drop-shadow-md">
                Romance can happen. But it is never the requirement.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
