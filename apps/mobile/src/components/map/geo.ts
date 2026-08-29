/**
 * Projection + the generated street network for the stylised Shibuya map.
 *
 * `@rnmapbox/maps` needs a native dev build and a paid token, and rendering a
 * dashed placeholder box was the single least finished thing in the app. This is
 * a hand-authored vector map instead: real enough to browse, cheap enough to run
 * in Expo Go, and it doubles as the offline map for demo mode.
 *
 * Everything here is computed once at module load — the gesture layer transforms
 * a container, so none of this recomputes while panning.
 */

import type { Coords } from "../../types/api";

/** The map's world square, in SVG user units. */
export const WORLD = 1400;

/** Centre of the modelled area — Shibuya Station. */
export const CENTER: Coords = { lat: 35.6595, lng: 139.7005 };

/** Degrees covered edge-to-edge. ~3.3 km tall, so streets stay legible. */
const SPAN_LAT = 0.03;
const SPAN_LNG = 0.037;

/** Geo → world units. Y is flipped: latitude grows north, SVG grows down. */
export function project({ lat, lng }: Coords): { x: number; y: number } {
  return {
    x: ((lng - CENTER.lng) / SPAN_LNG + 0.5) * WORLD,
    y: (0.5 - (lat - CENTER.lat) / SPAN_LAT) * WORLD,
  };
}

/** Deterministic jitter — a fixed seed keeps the city identical between runs. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export interface Street {
  d: string;
  /** 0 = arterial, 1 = secondary, 2 = residential. */
  rank: 0 | 1 | 2;
}

const random = makeRandom(20260829);

/**
 * Arterials, hand-placed so the map has a recognisable structure: a wide avenue
 * running NE–SW past the station, a ring, and radial spokes fanning out from the
 * scramble. Real cities are radial near a hub and gridded further out.
 */
const ARTERIALS: string[] = [
  // Meiji-dori equivalent, running north–south with a slight lean.
  "M 690 0 L 705 300 L 730 640 L 745 980 L 760 1400",
  // Aoyama-dori equivalent, east–west through the hub.
  "M 0 660 L 340 650 L 700 665 L 1060 640 L 1400 620",
  // Dogenzaka, climbing west out of the hub.
  "M 700 665 L 560 720 L 420 800 L 280 900 L 120 1010",
  // Koen-dori, north to the park.
  "M 700 665 L 660 520 L 620 380 L 590 250 L 570 120",
  // Outer ring, east side.
  "M 1060 640 L 1110 420 L 1090 200 L 1010 40",
  "M 1060 640 L 1120 860 L 1080 1090 L 990 1300",
];

const SECONDARY: string[] = [
  "M 340 650 L 320 430 L 330 220 L 360 40",
  "M 340 650 L 300 880 L 320 1120 L 380 1360",
  "M 560 720 L 600 900 L 640 1080 L 700 1280",
  "M 620 380 L 820 350 L 1010 320 L 1180 280",
  "M 660 520 L 860 500 L 1050 480 L 1240 450",
  "M 730 640 L 900 700 L 1060 780 L 1210 880",
  "M 420 800 L 520 960 L 600 1130 L 660 1300",
  "M 120 1010 L 300 1080 L 470 1180 L 620 1300",
  "M 0 380 L 200 400 L 330 420",
  "M 0 900 L 160 940 L 300 990",
];

/**
 * Residential grid. Generated rather than authored: a dense hand-written grid
 * would be thousands of characters of noise, and the jitter is what stops it
 * reading as graph paper.
 */
function buildResidential(): Street[] {
  const streets: Street[] = [];
  const step = 92;

  for (let i = 1; i < WORLD / step; i++) {
    const base = i * step;

    // Horizontal runs, broken into segments that stop and start like real blocks.
    let x = random() * 120;
    while (x < WORLD) {
      const length = 140 + random() * 220;
      const y = base + (random() - 0.5) * 26;
      const endX = Math.min(WORLD, x + length);

      if (endX - x > 60) {
        streets.push({
          d: `M ${x.toFixed(0)} ${y.toFixed(0)} L ${endX.toFixed(0)} ${(
            y + (random() - 0.5) * 16
          ).toFixed(0)}`,
          rank: 2,
        });
      }

      x = endX + 40 + random() * 130;
    }

    // Vertical runs.
    let y = random() * 120;
    while (y < WORLD) {
      const length = 120 + random() * 200;
      const vx = base + (random() - 0.5) * 26;
      const endY = Math.min(WORLD, y + length);

      if (endY - y > 60) {
        streets.push({
          d: `M ${vx.toFixed(0)} ${y.toFixed(0)} L ${(
            vx + (random() - 0.5) * 16
          ).toFixed(0)} ${endY.toFixed(0)}`,
          rank: 2,
        });
      }

      y = endY + 40 + random() * 130;
    }
  }

  return streets;
}

export const streets: Street[] = [
  ...buildResidential(),
  ...SECONDARY.map((d) => ({ d, rank: 1 as const })),
  ...ARTERIALS.map((d) => ({ d, rank: 0 as const })),
];

/** Yoyogi-park-shaped green mass to the north-west. */
export const PARK =
  "M 300 60 C 420 30 560 60 600 150 C 640 240 600 330 500 360 C 380 396 260 350 230 260 C 205 180 220 90 300 60 Z";

/** A second, smaller green square east of the hub. */
export const PLAZA =
  "M 960 700 C 1020 690 1075 715 1080 760 C 1085 810 1040 845 980 840 C 925 835 895 800 900 760 C 905 725 925 706 960 700 Z";

/** The river, running south-east. */
export const RIVER =
  "M 1400 300 C 1250 360 1160 470 1120 600 C 1080 740 1020 880 900 1000 C 800 1100 700 1200 640 1400";

/** Rail corridor through the station. */
export const RAIL =
  "M 120 200 C 320 330 520 520 700 665 C 880 810 1060 1000 1200 1220";

export interface MapLabel {
  text: string;
  x: number;
  y: number;
  size: "district" | "area" | "feature";
}

/** District names give the map somewhere to *be* rather than abstract geometry. */
export const LABELS: MapLabel[] = [
  { text: "SHIBUYA", x: 700, y: 700, size: "district" },
  { text: "Yoyogi Park", x: 415, y: 215, size: "feature" },
  { text: "Harajuku", x: 560, y: 140, size: "area" },
  { text: "Ebisu", x: 800, y: 1130, size: "area" },
  { text: "Aoyama", x: 1080, y: 545, size: "area" },
  { text: "Dogenzaka", x: 355, y: 880, size: "area" },
  { text: "Nonbei", x: 880, y: 640, size: "feature" },
  { text: "Miyashita", x: 830, y: 480, size: "feature" },
  { text: "Sakuragaoka", x: 520, y: 980, size: "feature" },
  { text: "Jinnan", x: 620, y: 430, size: "feature" },
];

/** City blocks — faint fills that give the streets something to cut between. */
export function buildBlocks(): { x: number; y: number; w: number; h: number }[] {
  const blockRandom = makeRandom(77712);
  const blocks: { x: number; y: number; w: number; h: number }[] = [];

  for (let i = 0; i < 90; i++) {
    const w = 40 + blockRandom() * 90;
    const h = 40 + blockRandom() * 90;
    blocks.push({
      x: blockRandom() * (WORLD - w),
      y: blockRandom() * (WORLD - h),
      w,
      h,
    });
  }

  return blocks;
}

export const blocks = buildBlocks();
