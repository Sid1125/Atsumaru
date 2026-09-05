/**
 * Type scale.
 *
 * The rule that matters (skill §15): **tracking and leading are size-specific.**
 * Large display text needs negative tracking because letters read too far apart as
 * they grow; small text needs slightly positive tracking to stay legible. Leading
 * moves inversely to size — tight on headings, generous on body copy.
 *
 * Hierarchy is built from weight + size + leading as a set, never size alone.
 *
 * ## The face
 *
 * Inter, bundled, matching `site/` — which `CLAUDE.md` names as the north star and
 * which loads `Inter` + `Noto Sans JP` through `next/font`. The app had been on the
 * platform system face, so the two halves of the product were set in different
 * typefaces.
 *
 * `apple-design` §15 says to default to the platform face and "override only with a
 * reason": the platform face ships optical sizing and legibility tuning a bundled
 * font has to re-earn. Brand continuity with the marketing site is that reason, and
 * Inter is specifically designed for UI at small sizes, so little is given up.
 *
 * **RN has no font fallback chain and no synthetic weights.** `fontWeight` is
 * ignored once `fontFamily` names a concrete face, so every weight is its own
 * family string and each role names the exact face it wants. `fontWeight` is kept
 * beside it anyway: it is what renders if the font fails to load, and it is what
 * accessibility services read.
 *
 * **CJK falls through to the platform.** Inter has no kana or hanzi, so iOS and
 * Android substitute their own Japanese face per glyph — which is the correct
 * result, and why `Noto Sans JP` is deliberately not bundled: a Japanese face costs
 * megabytes and the system already has a good one. If the substituted face ever
 * looks wrong beside Inter, that is the moment to reconsider, not before.
 */

import { Platform, type TextStyle } from "react-native";

/**
 * Bundled Inter. These strings must match the keys in `useFonts()` in `App.tsx`
 * exactly, and those keys must match the export names from
 * `@expo-google-fonts/inter` — a typo renders as the system face with no error.
 */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

/**
 * The editorial label face stays the platform's fixed-width stack rather than a
 * bundled mono. Kickers are short upper-case Latin strings at 9–11pt where the
 * differences between grotesque monos are invisible, and it saves a face.
 */
const monoFont = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/** Numerals that do not change width as they change value. */
const TABULAR: TextStyle = { fontVariant: ["tabular-nums"] };

type Role =
  | "displayLarge"
  | "display"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "bodyEmphasized"
  | "callout"
  | "subhead"
  | "footnote"
  | "caption"
  | "captionEmphasized"
  | "kicker"
  | "overline";

/**
 * letterSpacing in RN is absolute points, not em — so each entry is computed for
 * its own size. Roughly: -0.046em at `displayLarge` easing to +0.012em at caption.
 *
 * The display tier is where this pass spends its budget. The old scale topped out
 * at 36pt/-1.5, which is a large *heading*; an editorial layout wants a size that
 * is unmistakably the subject of the screen. Inter at 56pt needs -2.6 to hold
 * together — the negative tracking is not a style choice, it is what stops the
 * letterforms drifting apart as they scale.
 */
export const type: Record<Role, TextStyle> = {
  /** The subject of a screen. Meetup hero, login wordmark. One per screen, at most. */
  displayLarge: {
    fontFamily: fonts.extrabold,
    fontSize: 56,
    lineHeight: 54, // sub-1.0 leading — display text stacks tighter than it is tall
    letterSpacing: -2.6,
    fontWeight: "800",
  },
  display: {
    fontFamily: fonts.extrabold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -2.2,
    fontWeight: "800",
  },
  title1: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.2,
    fontWeight: "700",
  },
  title2: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontWeight: "700",
  },
  title3: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.2,
    fontWeight: "600",
  },
  headline: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.1,
    fontWeight: "600",
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24, // 1.41 — comfortable for reading
    letterSpacing: 0,
    fontWeight: "400",
  },
  bodyEmphasized: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: "600",
  },
  callout: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontWeight: "400",
  },
  subhead: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.05,
    fontWeight: "400",
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    fontWeight: "400",
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.15, // positive tracking — small text needs air between letters
    fontWeight: "400",
    // Caption is where counts, scores and times live. Proportional numerals make a
    // "4/6" jitter as it becomes "5/6", and a clock tick shift the row beside it.
    ...TABULAR,
  },
  captionEmphasized: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: "600",
    ...TABULAR,
  },

  /**
   * ## The two editorial labels
   *
   * There used to be three — `kicker`, `overline` and a separate `sectionHeader` —
   * across 39 call sites doing four different jobs, which is why every surface in
   * the app opened with a row of tracked caps. Two roles, one job each:
   *
   * `kicker` names a screen or a section. **At most one per three sections** — it
   * is the loudest quiet thing in the system, and spraying it is what makes an
   * interface read as generated rather than designed.
   */
  kicker: {
    fontFamily: monoFont,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.6,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  /**
   * `overline` labels a *datum* — a category on a card, a stat under a number.
   * It is attached to the thing it names and never floats above a section.
   */
  overline: {
    fontFamily: monoFont,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 3.0,
    fontWeight: "800",
    textTransform: "uppercase",
  },
};

/**
 * Kept so existing screens compile while they migrate to `type`.
 * @deprecated use `type` — these carry no tracking and no considered leading.
 */
export const typography = {
  title: type.title1,
  heading: type.title3,
  body: type.body,
  caption: type.footnote,
};
