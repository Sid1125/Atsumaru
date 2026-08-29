"use client";

import { Reveal } from "@/components/ui/Reveal";
import { PHOTOS } from "@/lib/constants";

export function FinalCTA() {
  return (
    <section id="cta" className="relative py-0 overflow-hidden">
      <div className="relative h-[80vh] md:h-screen">
        <img
          src={PHOTOS.cta}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full text-center">
            <Reveal>
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-accent mb-6 drop-shadow-lg">
                Ready to gather?
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.9]"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                Your people are<br />probably out there.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-8 text-lg md:text-xl text-white/80 max-w-xl mx-auto drop-shadow-md">
                Not dating. Not swiping. Not pressure.<br />
                Just gathering around something you love.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <a href="#" className="magnetic-btn h-16 px-10 text-base font-semibold rounded-full bg-accent-strong text-white hover:bg-accent-strong/90 transition-shadow duration-200 shadow-xl shadow-accent/30 hover:shadow-accent/40 inline-flex items-center gap-2">
                  Join Atsumaru
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <a href="#how-it-works" className="h-16 px-8 text-base font-medium rounded-full text-white/80 hover:text-white border border-white/20 hover:border-white/40 transition-all duration-200 inline-flex items-center">
                  Explore how it works
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
