"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { StickerArt } from "@/components/ui/StickerArt";
import { ACTIVITIES } from "@/lib/constants";

export function Activities() {
  return (
    <section className="py-24 md:py-32 bg-[#0E0E0E] text-[#FAF7F2] relative overflow-hidden ambient-surface-dark">
      <StickerArt name="vinyl" size={100} tilt={12} className="pointer-events-none absolute right-[6%] top-24 hidden lg:block" />
      <StickerArt name="camera" size={84} tilt={-9} className="pointer-events-none absolute left-[-22px] top-[46%] hidden xl:block" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#FAF7F2] leading-[0.95]">
            What could you<br /><Highlight>gather around?</Highlight>
          </h2>
        </Reveal>

        {/* Masonry grid with 3D perspective hover physics */}
        <div className="mt-16 md:mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {ACTIVITIES.map((a, i) => (
            <Reveal key={a.label} delay={i * 0.05} className="perspective-card">
              <div className={`perspective-card-inner relative rounded-3xl overflow-hidden group cursor-pointer border border-white/10 shadow-lg ${
                i === 0 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" :
                i === 3 ? "md:row-span-2 aspect-[3/4] md:aspect-auto" :
                "aspect-square"
              }`}>
                <img
                  src={a.photo}
                  alt={`Activity gathering for ${a.label}`}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent transition-opacity duration-300 group-hover:opacity-90" />
                <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md mb-3 border border-white/15 text-white transition-transform duration-300 group-hover:scale-110">
                    <a.icon size={22} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <p className="text-base md:text-xl font-bold text-white tracking-tight">{a.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

