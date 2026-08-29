"use client";

import { Reveal } from "@/components/ui/Reveal";
import { StickerArt } from "@/components/ui/StickerArt";
import { COPY, PHOTOS } from "@/lib/constants";
import { openWaitlistModal } from "@/components/WaitlistModal";
import { sound } from "@/lib/sound";

export function FinalCTA() {
  return (
    <section id="cta" className="relative py-0 overflow-hidden scroll-mt-24">
      <div className="relative h-[80vh] md:h-screen">
        <img
          src={PHOTOS.cta}
          alt="People laughing and connecting around an evening table in Japan"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

        <StickerArt name="trail" size={104} tilt={-10} className="pointer-events-none absolute left-[7%] top-[22%] hidden lg:block" />
        <StickerArt name="vinyl" size={96} tilt={12} className="pointer-events-none absolute right-[8%] bottom-[20%] hidden lg:block" />

        <div className="absolute inset-0 flex items-center">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full text-center">
            <Reveal>
              <span className="sticker-badge">{COPY.cta.kicker}</span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[0.9]"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                Your people are<br />probably out there.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-8 whitespace-pre-line text-lg md:text-xl text-white/80 max-w-xl mx-auto drop-shadow-md">
                {COPY.cta.sub}
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    sound.stamp();
                    openWaitlistModal();
                  }}
                  className="magnetic-btn h-16 px-10 text-base font-bold rounded-full bg-neon text-[#09090B] border-2 border-black shadow-[5px_6px_0_rgba(0,0,0,0.85)] hover:-translate-y-0.5 hover:shadow-[6px_8px_0_rgba(0,0,0,0.85)] transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
                >
                  Join Atsumaru
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <a href="#how-it-works" className="h-16 px-8 text-base font-medium rounded-full text-white/80 hover:text-white border border-white/20 hover:border-white/45 transition-all duration-200 inline-flex items-center">
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

