/**
 * Type scale.
 *
 * The rule that matters (skill §15): **tracking and leading are size-specific.**
 * Large display text needs negative tracking because letters read too far apart as
 * they grow; small text needs slightly positive tracking to stay legible. Leading
 * moves inversely to size — tight on headings, generous on body copy.
 *
 * The previous scale used one weight/size pair per role and no tracking at all,
 * which is what made the app read as "default React Native" rather than designed.
 *
 * Hierarchy is built from weight + size + leading as a set, never size alone.
 */

import { Platform, type TextStyle } from "react-native";

/**
 * The platform's own face ships optical sizing and legibility tuning that a
 * bundled font would have to re-earn (skill §15). Override only with a reason.
 */
const systemFont = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: "System",
});

const systemFontMedium = Platform.select({
  ios: "System",
  android: "sans-serif-medium",
  default: "System",
});

type Role =
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
  | "captionEmphasized";

/**
 * letterSpacing in RN is absolute points, not em — so each entry is computed for
 * its own size. Roughly: -0.022em at display sizes easing to +0.01em at caption.
 */
export const type: Record<Role, TextStyle> = {
  display: {
    fontFamily: systemFont,
    fontSize: 34,
    lineHeight: 40, // 1.18 — tight, large text needs less air
    letterSpacing: -0.8,
    fontWeight: "700",
  },
  title1: {
    fontFamily: systemFont,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontWeight: "700",
  },
  title2: {
    fontFamily: systemFont,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontWeight: "700",
  },
  title3: {
    fontFamily: systemFont,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.2,
    fontWeight: "600",
  },
  headline: {
    fontFamily: systemFontMedium,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
    fontWeight: "600",
  },
  body: {
    fontFamily: systemFont,
    fontSize: 17,
    lineHeight: 24, // 1.41 — comfortable for reading
    letterSpacing: 0,
    fontWeight: "400",
  },
  bodyEmphasized: {
    fontFamily: systemFontMedium,
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: 0,
    fontWeight: "600",
  },
  callout: {
    fontFamily: systemFont,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontWeight: "400",
  },
  subhead: {
    fontFamily: systemFont,
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.05,
    fontWeight: "400",
  },
  footnote: {
    fontFamily: systemFont,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    fontWeight: "400",
  },
  caption: {
    fontFamily: systemFont,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.15, // positive tracking — small text needs air between letters
    fontWeight: "400",
  },
  captionEmphasized: {
    fontFamily: systemFontMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.3,
    fontWeight: "600",
  },
};

/**
 * Section headers in grouped lists: small, wide-tracked, uppercase. The wide
 * tracking is what stops uppercase micro-text from reading as a solid block.
 */
export const sectionHeader: TextStyle = {
  ...type.captionEmphasized,
  letterSpacing: 0.7,
  textTransform: "uppercase",
  color: undefined,
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
