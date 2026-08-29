"use client";

import { TICKER_PULSES } from "@/lib/constants";

type Pulse = (typeof TICKER_PULSES)[number];

function Tape({ items, reverse }: { items: readonly Pulse[]; reverse?: boolean }) {
  return (
    <div className="flex overflow-hidden whitespace-nowrap">
      {/* Duplicated once so the -50% keyframe loops seamlessly. */}
      <div
        className={`${reverse ? "animate-marquee-reverse" : "animate-marquee"} items-center gap-3`}
      >
        {[...items, ...items].map((pulse, index) => (
          <span
            key={`${pulse.city}-${index}`}
            className="inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-neon" />
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-neon">
              {pulse.city}
            </span>
            <span className="text-xs font-semibold text-text-light">{pulse.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted-light">
              {pulse.tag}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Kinetic tape between sections: two rows running opposite ways, paused on hover and
 * parked entirely under `prefers-reduced-motion`. Decorative, so it is hidden from
 * assistive tech — the same plans appear as real content in the sections around it.
 */
export function MarqueeTicker({ label = "Sample plans" }: { label?: string }) {
  return (
    // Outer clip: the tape is rotated and slightly wider than the page, and without
    // this the extra width would add a horizontal scrollbar on small screens.
    <div aria-hidden="true" className="relative overflow-hidden bg-bg-dark">
      <div className="relative -mx-[2%] w-[104%] -rotate-[0.7deg] select-none border-y-2 border-black bg-bg-dark py-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-bg-dark to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-bg-dark to-transparent" />

        <p className="mb-2 px-6 font-mono text-[9px] font-bold uppercase tracking-[0.4em] text-text-muted-light/60">
          {label}
        </p>

        <Tape items={TICKER_PULSES} />
        <div className="h-2" />
        <Tape items={[...TICKER_PULSES].reverse()} reverse />
      </div>
    </div>
  );
}
