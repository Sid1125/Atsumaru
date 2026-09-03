/**
 * Design tokens. Every value here is a deliberate choice, not a default —
 * "nothing is random" (Apple, Principles of Great Design §Craft).
 *
 * The palette keeps Atsumaru's warm, calm, activity-first direction
 * (docs/DESIGN.md §1) while adding the layered surfaces and material tints an
 * Apple-grade interface needs to express depth.
 */

import { Platform } from "react-native";

export const palette = {
  // Warm paper ground — the cream surface the product reads on (docs/DESIGN.md
  // §1). Warmer than before: the site's `#FAF7F2` pulled down slightly so cards
  // and hairline rules still separate on it.
  sand50: "#FDFBF8",
  sand100: "#F7F4EE",
  sand200: "#F0EBE2",
  sand300: "#E4DDD1",
  sand400: "#D0C6B6",

  ink900: "#171717",
  ink700: "#3A362F",
  ink500: "#77716A",
  ink300: "#9C9188",

  // Coral — the Atsumaru brand/action colour (site `--color-accent`). Coral is
  // THE one action register; it also carries the celebration payoff, elevated.
  clay500: "#FF432A",
  clay600: "#E02E17",
  clay100: "#FFF0ED",

  // Sage — the warm-nature secondary (trust / AI / compatibility / success).
  pine500: "#719B86",
  pine600: "#5E8570",
  pine100: "#E8F0EA",

  amber500: "#C98A2E",
  rose500: "#B3402C",

  // The electric band (site `--color-neon`). Lime is the Gen-Z register —
  // highlighter marks, tape badges, sticker highlights. It is never the action
  // colour: coral owns that. Lime appears only where the site wears it.
  lime500: "#C8FF00",

  // Category sticker band (site/globals.css). Each maps to a category; the pair
  // decides text colour per WCAG. These are DATA-ENCODED content accents only —
  // they never decorate generic UI chrome. Food lost the neon lime, settling on
  // a warm amber distinct from both brand coral and sage.
  neon500: "#FF432A",
  hotpink500: "#FF2E93",
  lilac500: "#8A4FFF",
  sage500: "#7A9E7E",
  /** Warm ink, used as text ON a sticker (site $000 ink rule). */
  stickerInk: "#171717",
} as const;

/**
 * Semantic colors. Screens reference these, never raw palette entries, so a
 * future dark theme is a single swap rather than a survey of every file.
 */
export const colors = {
  background: "#F7F4EE",
  /** One step above background — grouped list backdrop. */
  backgroundElevated: "#F0EBE2",
  surface: "#FFFFFF",
  /** Surface resting on an image or the map; needs its own contrast. */
  surfaceRaised: "#FFFFFF",
  border: "#E4DDD1",
  /** Hairline used between rows inside a grouped card. */
  separator: "rgba(23,23,23,0.08)",

  text: "#171717",
  textSecondary: "#3A362F",
  textMuted: "#77716A",
  textOnColor: "#FFFFFF",

  primary: "#FF432A",
  primaryPressed: "#E02E17",
  primaryText: "#FFFFFF",
  primarySoft: "#FFF0ED",

  accent: "#719B86",
  accentPressed: "#5E8570",
  accentSoft: "#E8F0EA",

  danger: "#B3402C",
  dangerLight: "#FF8A7A",
  warning: "#C98A2E",

  /** LINE's brand green — used only for the LINE sign-in button and mark. */
  brandLine: "#06C755",

  // Night surfaces — the site's dark sections (site/globals.css `bg-dark` /
  // `bg-warm`), warmed toward the ink family: near-black `#09090B` became
  // `#171717` so dark chrome reads as warm Japanese ink, not cold black.
  // Login and the editorial chrome sit on these; content stays warm cream.
  night: "#171717",
  nightRaised: "#1E1C1A",
  /** One step up again — completed-meetup feedback tiles read clearly lighter. */
  nightRaisedSoft: "#2C2925",
  nightText: "#F7F4EE",
  nightMuted: "rgba(247,244,238,0.72)",
  nightSeparator: "#2A2724",
  /**
   * Payoff register — the celebration / Discover chrome / rep-value accents.
   * Neon lime is gone as a general-purpose accent (per the palette direction);
   * `neon` now ALIASES the brand coral so "best moment" resolves to the same
   * action coral as everything else — elevated by size and craft, not a second
   * hue. Cream ink clears ~4.2:1 on coral, AA for large button labels.
   */
  neon: "#FF432A",
  neonText: "#F7F4EE",

  /**
   * The electric band (site `--color-neon`). Lime is the Gen-Z register —
   * highlighter marks, tape badges, sticker highlights. Coral stays THE action
   * colour; lime only appears where the site wears it, never on generic chrome.
   */
  lime: "#C8FF00",
  /** Ink that clears WCAG AA on lime. */
  limeInk: "#171717",

  /**
   * Feedback rating stickers — data-encoded marks, one { bg, on } pair per
   * rating so ink stays legible on the specific colour (docs/DESIGN.md §10).
   */
  rating: {
    meh: { bg: "#E4DDD1", on: "#171717" },
    good: { bg: "#719B86", on: "#FFFFFF" },
    fire: { bg: "#FF432A", on: "#FFFFFF" },
  } as const,

  /** Scrim behind modal surfaces — dim to focus (skill §12). */
  scrim: "rgba(23,23,23,0.32)",

  /**
   * Category sticker palette (mirrors the site's electric rail). The sticker is
   * a data carrier, never decoration alone — colour always pairs with the glyph
   * and the label text beside it (docs/DESIGN.md §10). Each entry is its own
   * { bg, on } pair so ink stays WCAG-AA on the specific colour: warm amber and
   * hot pink take the ink text, lilac takes white (site rule: soft = ink, hot
   * = white).
   */
  sticker: {
    food: { bg: "#D9A441", on: "#171717" },
    gaming: { bg: "#FF2E93", on: "#171717" },
    arts: { bg: "#8A4FFF", on: "#FFFFFF" },
    outdoor: { bg: "#7A9E7E", on: "#171717" },
    music: { bg: "#00F0FF", on: "#171717" },
    wellness: { bg: "#2FBFB3", on: "#171717" },
    travel: { bg: "#2E6FB7", on: "#FFFFFF" },
    learning: { bg: "#5B5BD6", on: "#FFFFFF" },
    sports: { bg: "#46A84B", on: "#171717" },
  } as const,
} as const;

/** 4pt rhythm. Spacing is a scale, not arbitrary numbers. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
  /** Screen-level page padding — one step above `md` so forms and lists breathe. */
  page: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/**
 * Continuous-corner-ish radii. Larger surfaces take larger radii so corner
 * curvature reads consistent against the surface area.
 */
export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  sheet: 34,
  pill: 999,
} as const;

/**
 * Elevation. Bigger surfaces read as thicker: more blur and a deeper, softer
 * shadow than small chips (skill §12).
 */
export const elevation = {
  none: {},
  /** Chips, small controls resting on the page. */
  low: Platform.select({
    ios: {
      shadowColor: "#3D2F22",
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    default: { elevation: 1 },
  })!,
  /**
   * Cards. One step above `low` so a grouped card lifts off the page without
   * reaching sheet depth — buttons keep `low`, so cards and buttons read at
   * different levels.
   */
  card: Platform.select({
    ios: {
      shadowColor: "#3D2F22",
      shadowOpacity: 0.09,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 2 },
  })!,
  /** Sheets, floating chrome over the map. */
  medium: Platform.select({
    ios: {
      shadowColor: "#3D2F22",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 3 },
  })!,
  /** Sheets, floating chrome over the map. */
  high: Platform.select({
    ios: {
      shadowColor: "#3D2F22",
      shadowOpacity: 0.16,
      shadowRadius: 32,
      shadowOffset: { width: 0, height: 14 },
    },
    default: { elevation: 12 },
  })!,
} as const;

/** Minimum comfortable touch target (docs/DESIGN.md §10). */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TARGET = 44;
