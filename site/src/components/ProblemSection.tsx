"use client";

import { Square, Gem, Circle } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { StickerArt } from "@/components/ui/StickerArt";
import { COPY } from "@/lib/constants";

const approaches = [
  {
    label: "Swipe",
    style: "photo-first · 1:1 · appearance",
    desc: "Infinite deck, shallow signals, total burnout.",
    visual: Square,
    color: "#78716C",
    isTarget: false,
  },
  {
    label: "Serious",
    style: "marriage · commitment · pressure",
    desc: "Long forms, high stakes, the answer decided before you meet.",
    visual: Gem,
    color: "#6D5DA8",
    isTarget: false,
  },
  {
    label: "Atsumaru",
    style: "gather first · shared interests · real plans",
    desc: "Small groups doing the thing you were already going to do.",
    visual: Circle,
    color: "#FF432A",
    isTarget: true,
  },
];

export function ProblemSection() {
  return (
    <section id="why" className="ambient-surface relative overflow-hidden py-24 md:py-32 scroll-mt-24">
      <StickerArt name="ramen" size={112} tilt={9} className="pointer-events-none absolute right-[4%] top-24 hidden lg:block" />
      {/* Kept above the card row: at `top-[52%]` the Atsumaru tile covered it. */}
      <StickerArt name="coffee" size={88} tilt={-12} className="pointer-events-none absolute right-[19%] top-[9%] hidden xl:block" />

      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95] max-w-3xl">
            {COPY.problem.heading}{" "}
            <span className="marker" style={{ ["--marker-color" as string]: "#FF432A" }}>
              <span className="text-white">{COPY.problem.headingAccent}</span>
            </span>
            .
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 text-lg md:text-xl text-text-muted max-w-2xl leading-relaxed">
            {COPY.problem.sub}
          </p>
        </Reveal>

        {/* Editorial comparison */}
        <div className="mt-16 md:mt-24">
          <div className="grid md:grid-cols-3 gap-8 md:gap-10">
            {approaches.map((a, i) => (
              <Reveal key={a.label} delay={i * 0.12}>
                <div
                  className={`jiggle-hover h-full rounded-3xl p-7 ${
                    a.isTarget
                      ? "bg-white border-2 border-black shadow-[6px_8px_0_rgba(9,9,11,0.9)]"
                      : "bg-surface/60 border border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <a.visual size={28} style={{ color: a.color }} aria-hidden="true" />
                    {a.isTarget ? (
                      <span className="tape-badge">The middle</span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                        Traditional
                      </span>
                    )}
                  </div>

                  <h3 className={`text-2xl md:text-3xl font-bold ${a.isTarget ? "text-text" : "text-text/80"}`}>
                    {a.label}
                  </h3>
                  <p className="mt-2 font-mono text-[11px] md:text-xs uppercase tracking-wide text-text-muted">
                    {a.style}
                  </p>
                  <p className="mt-3 text-sm text-text-muted leading-relaxed">
                    {a.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

