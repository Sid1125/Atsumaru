"use client";

/**
 * Hand-drawn die-cut stickers. Each one is real artwork (inline SVG) inside a white
 * cut line with a gloss sweep, so they read as vinyl decals stuck onto the page rather
 * than as UI chips.
 *
 * Decorative by default: `aria-hidden`, and every sticker's message exists as real copy
 * in the section it sits on.
 */

export type StickerArtName =
  | "ramen"
  | "arcade"
  | "coffee"
  | "trail"
  | "camera"
  | "vinyl"
  | "hanko"
  | "torii";

interface Props {
  name: StickerArtName;
  /** Rendered size in px; the artwork scales with it. */
  size?: number;
  tilt?: number;
  className?: string;
}

const ART: Record<StickerArtName, { bg: string; ink: string; body: React.ReactNode; caption: string }> = {
  ramen: {
    bg: "#FF432A",
    ink: "#FFFFFF",
    caption: "RAMEN",
    body: (
      <>
        {/* steam */}
        <path d="M38 30c-4-5 4-8 0-13M50 27c-4-5 4-9 0-14M62 30c-4-5 4-8 0-13" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        {/* bowl */}
        <path d="M22 48h56c0 15-12 26-28 26S22 63 22 48z" fill="currentColor" />
        <path d="M18 47h64" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        {/* chopsticks */}
        <path d="M60 22 78 40M67 18 84 36" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      </>
    ),
  },
  arcade: {
    bg: "#C8FF00",
    ink: "#09090B",
    caption: "ARCADE",
    body: (
      <>
        {/* stick */}
        <path d="M50 26v22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="50" cy="22" r="9" fill="currentColor" />
        {/* base */}
        <path d="M24 50h52c3 0 5 2 5 5v14c0 3-2 5-5 5H24c-3 0-5-2-5-5V55c0-3 2-5 5-5z" fill="currentColor" />
        <circle cx="64" cy="62" r="4" fill="#C8FF00" />
        <circle cx="74" cy="62" r="4" fill="#C8FF00" />
      </>
    ),
  },
  coffee: {
    bg: "#8A4FFF",
    ink: "#FFFFFF",
    caption: "CAFÉ",
    body: (
      <>
        <path d="M28 34h38v22c0 10-8 18-19 18s-19-8-19-18V34z" fill="currentColor" />
        <path d="M66 40h8c5 0 9 4 9 9s-4 9-9 9h-8" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M26 80h44" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 24c-3-4 3-6 0-10M52 24c-3-4 3-6 0-10" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      </>
    ),
  },
  trail: {
    bg: "#5BE49B",
    ink: "#09090B",
    caption: "TRAIL",
    body: (
      <>
        <circle cx="70" cy="26" r="8" fill="currentColor" />
        <path d="M14 74 38 36l16 24 8-11 22 25H14z" fill="currentColor" />
      </>
    ),
  },
  camera: {
    bg: "#00F0FF",
    ink: "#09090B",
    caption: "35MM",
    body: (
      <>
        <path d="M20 34h12l5-8h26l5 8h12c3 0 5 2 5 5v32c0 3-2 5-5 5H20c-3 0-5-2-5-5V39c0-3 2-5 5-5z" fill="currentColor" />
        <circle cx="50" cy="55" r="15" fill="#00F0FF" />
        <circle cx="50" cy="55" r="8" fill="currentColor" />
        <circle cx="74" cy="42" r="3" fill="#00F0FF" />
      </>
    ),
  },
  vinyl: {
    bg: "#FF2E93",
    ink: "#FFFFFF",
    caption: "VINYL",
    body: (
      <>
        <circle cx="50" cy="52" r="32" fill="currentColor" />
        <circle cx="50" cy="52" r="20" fill="#FF2E93" />
        <circle cx="50" cy="52" r="7" fill="currentColor" />
        <path d="M70 24 84 20l-4 14" fill="currentColor" />
      </>
    ),
  },
  hanko: {
    bg: "#FAF7F2",
    ink: "#E02E17",
    caption: "ATSUMARU",
    body: (
      <>
        <circle cx="50" cy="48" r="30" fill="none" stroke="currentColor" strokeWidth="5" />
        <text
          x="50"
          y="60"
          textAnchor="middle"
          fontSize="34"
          fontWeight="700"
          fill="currentColor"
          fontFamily="var(--font-jp), sans-serif"
        >
          集
        </text>
      </>
    ),
  },
  torii: {
    bg: "#E4C25C",
    ink: "#09090B",
    caption: "TOKYO",
    body: (
      <>
        <path d="M14 28h72l-6 9H20l-6-9z" fill="currentColor" />
        <path d="M24 44h52v7H24z" fill="currentColor" />
        <path d="M30 37h9v41h-9zM61 37h9v41h-9z" fill="currentColor" />
      </>
    ),
  },
};

export function StickerArt({ name, size = 104, tilt = -6, className = "" }: Props) {
  const art = ART[name];

  return (
    // Outer span carries the caller's positioning: `.decal` sets `position: relative`
    // for its gloss layer, which would otherwise beat an `absolute` utility class.
    <span aria-hidden="true" className={className}>
      <span
        style={{
          ["--decal-bg" as string]: art.bg,
          ["--decal-fg" as string]: art.ink,
          ["--decal-tilt" as string]: `${tilt}deg`,
          width: size,
          height: size,
        }}
        className="decal rounded-full"
      >
        <svg
          viewBox="0 0 100 92"
          width={size * 0.62}
          height={size * 0.57}
          style={{ color: art.ink }}
        >
          {art.body}
        </svg>
        <span className="font-mono text-[8px] font-black uppercase tracking-[0.18em]">
          {art.caption}
        </span>
      </span>
    </span>
  );
}
