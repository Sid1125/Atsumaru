"use client";

import { Reveal } from "@/components/ui/Reveal";
import { PHOTOS } from "@/lib/constants";
import { Shield, Eye, Users, Lock } from "lucide-react";

const features = [
  { icon: Users, title: "4–6 people", desc: "Small groups mean you're never alone with a stranger." },
  { icon: Eye, title: "Pseudonymous", desc: "Your @handle is your identity. Real names stay private." },
  { icon: Lock, title: "Mutual consent", desc: "Chat only unlocks when both people choose each other." },
  { icon: Shield, title: "Private feedback", desc: "Your ratings stay between you and the system." },
];

export function SafetySection() {
  return (
    <section id="safety" className="relative py-0 overflow-hidden">
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
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-accent mb-4 drop-shadow-lg">
                Safety
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[0.95]"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)" }}
              >
                Meet together,<br />not alone.
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-lg text-white/80 max-w-md drop-shadow-md">
                Safety isn&apos;t a feature — it&apos;s the foundation.
              </p>
            </Reveal>

            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={0.2 + i * 0.08}>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10">
                    <f.icon size={24} className="text-accent mb-3" />
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
