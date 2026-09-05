/**
 * Design tokens. Every value here is a deliberate choice, not a default —
 * "nothing is random" (Apple, Principles of Great Design §Craft).
 *
 * ## Source palette — `assets/color pal.jpeg`
 *
 * | Swatch          | Hex       | Role here                                       |
 * |-----------------|-----------|-------------------------------------------------|
 * | Champagne Glow  | `#F5E5CC` | the page ground and the whole warm surface ramp  |
 * | Citrus Fizz     | `#FFCC99` | the mid tint — soft fills, pips, badges          |
 * | Neon Citrus     | `#FF9E0F` | the electric/highlight register (tape, marks)    |
 * | Orange Zest     | `#CE4503` | THE action colour                               |
 * | Berry Pop       | `#7D0000` | destructive, and the deep end of the ink ramp    |
 *
 * The sampled swatches match their printed hex exactly in four of five cases.
 * **Orange Zest's printed `#5E2638` is a typo in the source image** — that hex is
 * a dark plum, while the swatch it labels reads `#CE4503`. The swatch wins: it is
 * what the palette actually shows, and a plum would have no relationship to the
 * citrus ramp on either side of it.
 *
 * ## What the palette does not supply, and why this file adds it
 *
 * Five analogous warm swatches are a *brand* palette, not a complete interface
 * system. Stated in it: ground, tint, highlight, action, destructive. Absent: a
 * hue that is legibly NOT the action colour, which the product needs for trust /
 * AI / compatibility / success (match scores, the onboarding host, the "good"
 * rating). Rendering those in another orange would collapse the one distinction
 * they exist to make. So `accent` is an olive drawn to sit under the citrus ramp
 * rather than beside it — the classic complement to burnt orange on cream, and
 * the only hue in this file not derived from the palette.
 *
 * ## Every pair below is measured, not judged by eye
 *
 * Champagne is a full step darker than the cream it replaces, so text weights
 * that passed on `#F7F4EE` do not automatically pass on it — `textMuted` at its
 * old `#77716A` measures **3.90:1** here and fails AA. Each value was solved
 * against the actual ground rather than carried over.
 *
 * The one consequence worth knowing at a call site: **`primary` is a fill, not an
 * ink.** Orange Zest as small text on champagne is 3.79:1. Use `primaryInk` when
 * the action colour has to be *text* (5.83:1), and `citrus` (8.66:1) when it has
 * to be text on `night` — `primary` there is 3.82:1.
 */

import { Platform } from "react-native";

export const palette = {
  /**
   * Champagne Glow and its ramp. `champagne100` is the swatch itself and the page
   * ground; the rest are mixes toward warm ink, so every surface in the app is the
   * same colour at a different depth rather than five unrelated creams.
   */
  champagne50: "#FDF8EF",
  champagne100: "#F5E5CC",
  champagne200: "#E6D7BF",
  champagne300: "#D3C4AE",
  champagne400: "#B9AB97",

  /**
   * Warm ink. Pulled off neutral toward the champagne/berry axis so the dark
   * family belongs to the same world as the ground — a neutral `#171717` reads
   * blue against this much yellow.
   */
  ink900: "#1E1710",
  ink700: "#3F372B",
  ink500: "#6B6053",
  ink300: "#A2937E",

  /** Orange Zest — THE one action register. `zest600` is also its text weight. */
  zest500: "#CE4503",
  zest600: "#9C3406",
  zest100: "#F0CFB0",

  /** Neon Citrus — the electric/highlight band. Always takes ink, never white. */
  citrus500: "#FF9E0F",
  /** Citrus Fizz — the mid tint between the ground and the action colour. */
  fizz300: "#FFCC99",
  /** Berry Pop — destructive, and the deepest note in the ramp. */
  berry700: "#7D0000",

  /**
   * Olive — the single non-palette hue (see the header). Warm and low enough in
   * chroma to read as part of the citrus world rather than an import from a
   * different system.
   */
  olive500: "#4F6B3A",
  olive600: "#3F562C",
  olive100: "#DED4B8",

  /** Warm ink, used as text ON a sticker (site $000 ink rule). */
  stickerInk: "#1E1710",
} as const;

/**
 * Semantic colors. Screens reference these, never raw palette entries, so a
 * future dark theme is a single swap rather than a survey of every file.
 */
export const colors = {
  background: "#F5E5CC",
  /** One step above background — grouped list backdrop. */
  backgroundElevated: "#E6D7BF",
  surface: "#FFFFFF",
  /** Surface resting on an image or the map; needs its own contrast. */
  surfaceRaised: "#FFFFFF",
  border: "#D3C4AE",
  /** Hairline used between rows inside a grouped card. */
  separator: "rgba(30,23,16,0.10)",

  text: "#1E1710",
  textSecondary: "#3F372B",
  textMuted: "#6B6053",
  textOnColor: "#FFFFFF",

  /**
   * Orange Zest. White on it clears 4.69:1, so it carries button labels — but it
   * is a **fill**. As small text on the champagne ground it is 3.79:1; reach for
   * `primaryInk` there.
   */
  primary: "#CE4503",
  primaryPressed: "#9C3406",
  primaryText: "#FFFFFF",
  /** Citrus Fizz pulled toward the ground — soft fills behind action content. */
  primarySoft: "#F0CFB0",
  /**
   * The action colour at a weight that survives being text: 5.83:1 on the ground,
   * 7.22:1 on white. Match scores, inline emphasis, error-adjacent text.
   */
  primaryInk: "#9C3406",

  accent: "#4F6B3A",
  accentPressed: "#3F562C",
  /**
   * Olive pulled most of the way to the ground. Tinted toward olive rather than
   * split evenly with champagne: at a 50/50 mix the block reads as dirty cream
   * instead of "a quiet green panel", which is the whole job.
   */
  accentSoft: "#DBDCB2",
  /**
   * Olive at a weight that survives being text ON `accentSoft` (5.77:1). The
   * same split `primary`/`primaryInk` makes, and for the same measured reason:
   * `accent` on `accentSoft` is **4.07:1** and fails AA — which is what the match
   * card's "group fit" label and its reason bullets were rendering at.
   */
  accentInk: "#3F562C",

  /**
   * Berry Pop. Deliberately far darker than `primary` rather than a redder sibling
   * of it — destructive has to be distinguishable from the action colour at a
   * glance, and in an all-warm palette weight is the only axis left.
   */
  danger: "#7D0000",
  /** Berry lifted for legibility on `night` (8.75:1 there). */
  dangerLight: "#FF9B80",
  warning: "#8F5606",

  /** LINE's brand green — used only for the LINE sign-in button and mark. */
  brandLine: "#06C755",

  /**
   * Night surfaces. Not black, and not Berry Pop at full strength — `#7D0000` as a
   * full-bleed ground is loud enough to read as an error state. This is the berry
   * desaturated and taken down to ink weight, so dark chrome is recognisably the
   * same palette rather than a neutral hole punched in it.
   */
  night: "#231310",
  nightRaised: "#31201B",
  /** One step up again — completed-meetup feedback tiles read clearly lighter. */
  nightRaisedSoft: "#422C24",
  nightText: "#F5E5CC",
  nightMuted: "rgba(245,229,204,0.72)",
  nightSeparator: "#3E2822",

  /**
   * Neon Citrus — the electric register. Highlighter marks, tape badges, sticker
   * highlights, the payoff moment. It is never the action colour: Orange Zest owns
   * that. White on it is 2.07:1, so it takes `citrusInk` and only `citrusInk`.
   *
   * (This replaces the old `lime` / `neon` pair. `neon` had decayed into a plain
   * alias of `primary` — two names, one colour, nothing to choose between them —
   * and `lime` named a hue this palette does not contain.)
   */
  citrus: "#FF9E0F",
  /** Ink that clears WCAG AA on citrus (8.66:1). */
  citrusInk: "#1E1710",
  /** Citrus Fizz at full strength — the mid tint. Takes ink (12.25:1). */
  fizz: "#FFCC99",

  /**
   * The hard offset under every vinyl/sticker surface. Warm, so the offset belongs
   * to the same world as the ink rather than being a cold near-black pasted under
   * a warm palette.
   */
  vinylShadow: "rgba(30,17,10,0.92)",

  /** Translucent-chrome fills for `components/ui/Material`. */
  materialThin: "rgba(245,229,204,0.86)",
  materialRegular: "rgba(245,229,204,0.94)",
  /** Bright top lip — light catching the edge of the material. */
  materialEdge: "rgba(255,252,245,0.70)",
  /** Night equivalents, so the same primitive can back chrome over the map. */
  materialNightThin: "rgba(35,19,16,0.72)",
  materialNightRegular: "rgba(35,19,16,0.88)",
  materialNightEdge: "rgba(245,229,204,0.10)",

  /**
   * Ambient full-screen washes (Login's ground). Named for their **role**, not
   * their hue — the previous `washCoral` / `washSage` had to be renamed the moment
   * the palette moved, which is the whole argument against colour-named tokens.
   */
  washPrimary: "rgba(206,69,3,0.10)",
  washAccent: "rgba(79,107,58,0.12)",

  /**
   * Avatar fallback grounds — one `{ bg, on }` pair per slot, deterministically
   * chosen from the handle so a person keeps their colour.
   *
   * Drawn from the ink / zest / berry / olive families and **not** the `sticker`
   * band, so a person is never painted in a data-encoded category colour purely as
   * decoration. Every pair clears WCAG AA for the initial, which is the meaning
   * carrier when there is no photo.
   */
  avatar: [
    { bg: "#CE4503", on: "#FFFFFF" },
    { bg: "#4F6B3A", on: "#FFFFFF" },
    { bg: "#7D0000", on: "#FFFFFF" },
    { bg: "#3F372B", on: "#FFFFFF" },
    { bg: "#8A5A1C", on: "#FFFFFF" },
    { bg: "#FFCC99", on: "#1E1710" },
  ] as const,

  /**
   * Feedback rating stickers — data-encoded marks, one { bg, on } pair per rating
   * so ink stays legible on the specific colour (docs/DESIGN.md §10).
   */
  rating: {
    meh: { bg: "#D3C4AE", on: "#1E1710" },
    good: { bg: "#4F6B3A", on: "#FFFFFF" },
    fire: { bg: "#CE4503", on: "#FFFFFF" },
  } as const,

  /**
   * Sheet grabbers. Two tokens rather than one with an opacity, because the light
   * and dark cases are different colours, not the same colour at two strengths.
   * These were the last two retired literals in `src/` — `rgba(250,247,242,…)`
   * and `rgba(26,22,19,…)`, both hues this palette no longer contains.
   */
  grabber: "rgba(30,23,16,0.18)",
  grabberNight: "rgba(245,229,204,0.20)",

  /** Scrim behind modal surfaces — dim to focus (skill §12). */
  scrim: "rgba(30,17,10,0.36)",

  /**
   * Category sticker palette. The sticker is a data carrier, never decoration
   * alone — colour always pairs with the glyph and the label text beside it
   * (docs/DESIGN.md §10).
   *
   * Nine categories need nine *distinguishable* hues, so this band cannot be folded
   * into the warm ramp without destroying the thing it exists to do. What changed
   * instead is register: the previous values were screen-neons (`#00F0FF`,
   * `#FF2E93`, `#8A4FFF`) chosen against a near-white ground, and they read as
   * radioactive on champagne. Each is retuned toward the palette's
   * vintage-citrus-poster weight — same hue, pigment rather than backlight — and
   * `food` resolves to Neon Citrus itself, which the palette hands us outright.
   *
   * Each entry is its own `{ bg, on }` pair, and every pair clears AA.
   */
  sticker: {
    food: { bg: "#FF9E0F", on: "#1E1710" },
    gaming: { bg: "#D62F73", on: "#FFFFFF" },
    arts: { bg: "#7A4FD0", on: "#FFFFFF" },
    outdoor: { bg: "#4F6B3A", on: "#FFFFFF" },
    music: { bg: "#2BB3AE", on: "#1E1710" },
    wellness: { bg: "#2E9B8A", on: "#1E1710" },
    travel: { bg: "#2C5E9E", on: "#FFFFFF" },
    learning: { bg: "#4A4FB0", on: "#FFFFFF" },
    sports: { bg: "#5FA84A", on: "#1E1710" },
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
 *
 * The shadow colour is a warm brown rather than black — on a champagne ground a
 * neutral shadow greys the surface it falls on instead of deepening it.
 */
export const elevation = {
  none: {},
  /** Chips, small controls resting on the page. */
  low: Platform.select({
    ios: {
      shadowColor: "#5A3A18",
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
      shadowColor: "#5A3A18",
      shadowOpacity: 0.09,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    default: { elevation: 2 },
  })!,
  /** Sheets, floating chrome over the map. */
  medium: Platform.select({
    ios: {
      shadowColor: "#5A3A18",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 3 },
  })!,
  /** Sheets, floating chrome over the map. */
  high: Platform.select({
    ios: {
      shadowColor: "#5A3A18",
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
