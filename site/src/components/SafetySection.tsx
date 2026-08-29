"use client";

import { Reveal } from "@/components/ui/Reveal";
import { COPY, PHOTOS } from "@/lib/constants";
import { Shield, Eye, Users, Lock } from "lucide-react";

const features = [
  { icon: Users, title: "4–6 people", desc: "Never alone with a stranger — the group is the point." },
  { icon: Eye, title: "Pseudonymous", desc: "Your @handle is your identity. Real names stay private." },
  { icon: Lock, title: "Mutual only", desc: "1:1 chat unlocks when you both pick each other. Never one-sided." },
  { icon: Shield, title: "Private feedback", desc: "Nobody is told who rated them, or who didn't pick them." },
];

export function SafetySection() {
  return (
    <section id="safety" className="relative py-0 overflow-hidden scroll-mt-24">
      <div className="relative h-[60vh] md:h-[70vh]">
        <img
          src={PHOTOS.groupCafe}
          alt="Friends at a café"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20" />

        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 md:pb-24 w-full">
            <Reveal>
              <span className="sticker-badge sticker-pink">{COPY.safety.kicker}</span>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="mt-5 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[0.95]"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                {COPY.safety.heading}<br />{COPY.safety.headingSecond}
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-lg text-white/80 max-w-md drop-shadow-md">
                {COPY.safety.sub}
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={0.2 + i * 0.08}>
                  <div className="jiggle-hover bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                    <f.icon size={24} className="text-neon mb-3" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-text-light mb-1">{f.title}</h3>
                    <p className="text-xs text-text-muted-light leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
