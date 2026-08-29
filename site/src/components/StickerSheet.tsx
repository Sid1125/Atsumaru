"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Decal } from "@/components/ui/Decal";
import { StickerArt } from "@/components/ui/StickerArt";
import { COPY, DECALS } from "@/lib/constants";

/**
 * A sheet of die-cut decals, one per kind of gathering. The dashed slots stand for the
 * collectible badges on the roadmap (docs/IDEA.md §10), and the section says as much so
 * the page never implies a reward system that already ships.
 */
export function StickerSheet() {
  return (
    <section className="ambient-surface-dark relative overflow-hidden py-20 md:py-28">
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <Reveal>
            <span className="sticker-badge sticker-ink">{COPY.stickers.kicker}</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-5 text-4xl font-bold leading-[0.95] tracking-tight text-text-light sm:text-5xl md:text-6xl">
              {COPY.stickers.heading}{" "}
              <span
                className="marker text-[#09090B]"
                style={{ ["--marker-color" as string]: "#FF2E93" }}
              >
                {COPY.stickers.headingAccent}
              </span>
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-5 text-base text-text-muted-light md:text-lg">
              {COPY.stickers.sub}
            </p>
          </Reveal>
        </div>

        {/* Illustrated decals — the drawn half of the sheet */}
        <Reveal delay={0.16}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5 sm:gap-7">
            <StickerArt name="ramen" size={112} tilt={-8} />
            <StickerArt name="arcade" size={104} tilt={6} />
            <StickerArt name="coffee" size={108} tilt={-4} />
            <StickerArt name="trail" size={100} tilt={9} />
            <StickerArt name="camera" size={104} tilt={-7} />
            <StickerArt name="vinyl" size={108} tilt={5} />
            <StickerArt name="torii" size={100} tilt={-6} />
            <StickerArt name="hanko" size={104} tilt={8} />
          </div>
        </Reveal>

        {/* The sheet itself */}
        <Reveal delay={0.18}>
          <div className="decal-sheet mt-10 rounded-3xl border-2 border-white/12 p-6 sm:p-10">
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
              {DECALS.map((decal) => (
                <Decal
                  key={decal.label}
                  label={decal.label}
                  sub={"sub" in decal ? decal.sub : undefined}
                  icon={decal.icon}
                  bg={"bg" in decal ? decal.bg : undefined}
                  fg={"fg" in decal ? decal.fg : undefined}
                  tilt={decal.tilt}
                  shape={decal.shape}
                  locked={"locked" in decal ? decal.locked : false}
                />
              ))}
            </div>

            <p className="mt-8 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted-light/60">
              {COPY.stickers.note}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
