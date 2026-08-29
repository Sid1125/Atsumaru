"use client";

import type { LucideIcon } from "lucide-react";
import { Lock } from "lucide-react";
import { sound } from "@/lib/sound";

export type DecalShape = "round" | "shield" | "square";

interface Props {
  label: string;
  sub?: string;
  icon: LucideIcon;
  /** Fill colour; the white cut line and gloss are handled by `.decal`. */
  bg?: string;
  fg?: string;
  tilt?: number;
  shape?: DecalShape;
  /** Renders as an empty slot on the sheet — nothing is claimed as earned. */
  locked?: boolean;
}

const SHAPE_CLASS: Record<DecalShape, string> = {
  round: "rounded-full",
  // Squircle: reads as a third die-cut outline next to the circle and the rounded square.
  shield: "rounded-[38%]",
  square: "rounded-3xl",
};

/**
 * A die-cut vinyl decal, in the spirit of the collectible stickers racing games hand out
 * for exploring. Purely decorative chrome: the label text is repeated as real copy in
 * the surrounding section, so screen readers do not get a wall of badge names.
 */
export function Decal({
  label,
  sub,
  icon: Icon,
  bg = "#C8FF00",
  fg = "#09090B",
  tilt = -4,
  shape = "round",
  locked = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={() => sound.pop(locked ? 300 : 620)}
      aria-label={locked ? `${label} — not available yet` : label}
      style={{
        ["--decal-bg" as string]: bg,
        ["--decal-fg" as string]: fg,
        ["--decal-tilt" as string]: `${tilt}deg`,
      }}
      className={`decal ${locked ? "decal-locked" : ""} ${SHAPE_CLASS[shape]} h-28 w-28 cursor-pointer px-3 sm:h-32 sm:w-32`}
    >
      {locked ? (
        <Lock size={20} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <Icon size={26} strokeWidth={2.4} aria-hidden="true" />
      )}
      <span className="mt-1 font-mono text-[10px] font-black uppercase leading-tight tracking-wider">
        {label}
      </span>
      {sub && !locked ? (
        <span className="font-mono text-[8px] font-bold uppercase tracking-widest opacity-70">
          {sub}
        </span>
      ) : null}
    </button>
  );
}
