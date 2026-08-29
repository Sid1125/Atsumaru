"use client";

import { Square, Gem, Circle } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";

const approaches = [
  {
    label: "Swipe",
    style: "photo-first · 1:1 · appearance",
    visual: Square,
    color: "#A8A29E",
    dim: true,
  },
  {
    label: "Serious",
    style: "marriage · commitment · pressure",
    visual: Gem,
    color: "#8B7EC8",
    dim: true,
  },
  {
    label: "Atsumaru",
    style: "gather first · shared interests · real activities",
    visual: Circle,
    color: "#E8634D",
    dim: false,
  },
];

export function ProblemSection() {
  return (
    <section id="why" className="py-24 md:py-32 bg-bg">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95] max-w-3xl">
            Dating apps picked <Highlight>two extremes</Highlight>.
          </h2>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-6 text-lg md:text-xl text-text-muted max-w-2xl leading-relaxed">
            Swipe-first meets hook-up culture. Marriage-focused meets high pressure.
            Nobody owns the low-stakes, activity-first middle.
          </p>
        </Reveal>

        {/* Editorial comparison */}
        <div className="mt-16 md:mt-24">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {approaches.map((a, i) => (
              <Reveal key={a.label} delay={i * 0.12}>
                <div className={`relative ${a.dim ? "opacity-50" : ""}`}>
                  {a.dim && <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-border" />}
                  {!a.dim && <div className="absolute -left-4 top-0 bottom-0 w-1 bg-accent rounded-full" />}

                  <div className="pl-6">
                    <span className="mb-4 block">
                    <a.visual size={30} style={{ color: a.color }} />
                  </span>
                    <h3 className={`text-2xl md:text-3xl font-bold ${a.dim ? "text-text/40" : "text-text"}`}>
                      {a.label}
                    </h3>
                    <p className={`mt-2 text-sm md:text-base ${a.dim ? "text-text-muted/50" : "text-text-muted"}`}>
                      {a.style}
                    </p>
                  </div>

                  {!a.dim && (
                    <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-sm font-medium text-accent">The difference</span>
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
