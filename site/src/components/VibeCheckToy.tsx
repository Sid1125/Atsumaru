"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Flame } from "lucide-react";
import { VIBE_CHOICES } from "@/lib/constants";
import { sound } from "@/lib/sound";
import { openWaitlistModal } from "@/components/WaitlistModal";

const MAX_PICKS = 3;

/** Areas are suggested per vibe, so the card never claims a plan that isn't seeded. */
const AREAS: Record<string, string> = {
  ramen: "Shibuya",
  arcade: "Akihabara",
  coffee: "Nakameguro",
  film: "Yanaka",
  boulder: "Shinjuku",
  thrift: "Shimokitazawa",
  boardgames: "Kōenji",
  gallery: "Kiyosumi",
};

type Squad = {
  title: string;
  area: string;
  fit: number;
  size: number;
};

/**
 * Deterministic stand-in for the real matcher: the score rewards committing to three
 * vibes, because a fuller profile is what actually sharpens matching in the app.
 */
function buildSquad(selected: readonly string[]): Squad | null {
  if (selected.length === 0) return null;

  const picks = selected
    .map((id) => VIBE_CHOICES.find((choice) => choice.id === id))
    .filter((choice): choice is (typeof VIBE_CHOICES)[number] => Boolean(choice));

  if (picks.length === 0) return null;

  const groups = picks.map((pick) => pick.group);
  const title =
    groups.length === 1
      ? `${groups[0]} crew`
      : `${groups.slice(0, -1).join(", ")} & ${groups[groups.length - 1]} crew`;

  return {
    title,
    area: AREAS[picks[0]!.id] ?? "Tokyo",
    fit: 74 + picks.length * 7,
    size: Math.min(6, 3 + picks.length),
  };
}

export function VibeCheckToy() {
  const [selected, setSelected] = useState<string[]>(["ramen", "arcade"]);

  const squad = useMemo(() => buildSquad(selected), [selected]);

  const toggle = (id: string) => {
    const isOn = selected.includes(id);

    sound.pop(isOn ? 380 : 640);

    setSelected((current) => {
      if (isOn) return current.filter((item) => item !== id);

      // At the cap, the oldest pick drops out so tapping always does something.
      return current.length < MAX_PICKS
        ? [...current, id]
        : [...current.slice(1), id];
    });
  };

  const claim = () => {
    sound.stamp();
    openWaitlistModal();
  };

  return (
    <section className="relative overflow-hidden bg-bg-dark py-20 md:py-28 ambient-surface-dark">
      <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
        <div className="text-center">
          <span className="sticker-badge">
            <Flame className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Vibe check
          </span>

          <h2 className="mt-6 text-4xl font-bold leading-[0.95] tracking-tight text-text-light sm:text-5xl md:text-6xl">
            Pick your{" "}
            <span className="marker text-[#09090B]" style={{ ["--marker-color" as string]: "#C8FF00" }}>
              3 weekend vibes
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base text-text-muted-light">
            Tap what your Saturday actually looks like. Here&apos;s the kind of squad
            Atsumaru would put you in.
          </p>
        </div>

        <div
          role="group"
          aria-label="Weekend vibes"
          className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2.5 sm:gap-3"
        >
          {VIBE_CHOICES.map((vibe) => {
            const isSelected = selected.includes(vibe.id);

            return (
              <button
                key={vibe.id}
                type="button"
                onClick={() => toggle(vibe.id)}
                aria-pressed={isSelected}
                className={`jiggle-hover rounded-full border px-4 py-2.5 text-xs font-semibold transition-colors duration-200 cursor-pointer sm:text-sm ${
                  isSelected
                    ? "border-neon bg-neon text-[#09090B] shadow-[2px_3px_0_rgba(0,0,0,0.9)]"
                    : "border-white/15 bg-white/[0.04] text-text-light hover:border-white/40"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                  )}
                  {vibe.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted-light/70">
          {selected.length}/{MAX_PICKS} picked
        </p>

        {/* Generated squad pass */}
        <div className="mx-auto mt-10 max-w-md -rotate-[0.6deg] rounded-2xl border-2 border-black bg-surface-dark p-6 shadow-[6px_8px_0_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
              Squad match pass
            </span>
            <span className="tape-badge">
              {squad ? `${squad.fit}% fit` : "waiting"}
            </span>
          </div>

          {squad ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted-light">
                Your likely gathering
              </p>
              <p className="mt-1 text-xl font-bold text-text-light">{squad.title}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-text-light">
                  📍 {squad.area}
                </span>
                <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-text-light">
                  👥 {squad.size} people
                </span>
                <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-text-light">
                  🕕 Sat evening
                </span>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-text-muted-light">
                {selected.length < MAX_PICKS
                  ? "Add one more vibe — the more it knows, the sharper the squad."
                  : "That's a full picture. This is roughly what your first group looks like."}
              </p>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-text-muted-light">
              Tap a vibe above to build your pass.
            </p>
          )}

          <button
            type="button"
            onClick={claim}
            className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent/25 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Save my spot
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted-light/60">
            Illustrative preview · real matching happens in the app
          </p>
        </div>
      </div>
    </section>
  );
}
