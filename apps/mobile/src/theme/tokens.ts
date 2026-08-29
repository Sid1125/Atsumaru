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
  // Warm paper ground — the product should read calm, not clinical.
  sand50: "#FDFBF8",
  sand100: "#FBF7F2",
  sand200: "#F4EEE6",
  sand300: "#E8DFD4",
  sand400: "#D5C8B8",

  ink900: "#1A1613",
  ink700: "#3D362F",
  ink500: "#6E655C",
  ink300: "#9C9188",

  clay500: "#D9603B",
  clay600: "#C4522F",
  clay100: "#FBEAE3",

  pine500: "#2F6F62",
  pine600: "#265A50",
  pine100: "#E3EFEB",

  amber500: "#C98A2E",
  rose500: "#B3402C",
} as const;

/**
 * Semantic colors. Screens reference these, never raw palette entries, so a
 * future dark theme is a single swap rather than a survey of every file.
 */
export const colors = {
  background: "#FBF7F2",
  /** One step above background — grouped list backdrop. */
  backgroundElevated: "#F4EEE6",
  surface: "#FFFFFF",
  /** Surface resting on an image or the map; needs its own contrast. */
  surfaceRaised: "#FFFFFF",
  border: "#E8DFD4",
  /** Hairline used between rows inside a grouped card. */
  separator: "rgba(26,22,19,0.08)",

  text: "#1A1613",
  textSecondary: "#3D362F",
  textMuted: "#6E655C",
  textOnColor: "#FFFFFF",

  primary: "#D9603B",
  primaryPressed: "#C4522F",
  primaryText: "#FFFFFF",
  primarySoft: "#FBEAE3",

  accent: "#2F6F62",
  accentPressed: "#265A50",
  accentSoft: "#E3EFEB",

  danger: "#B3402C",
  warning: "#C98A2E",

  /** Scrim behind modal surfaces — dim to focus (skill §12). */
  scrim: "rgba(26,22,19,0.32)",
} as const;

/** 4pt rhythm. Spacing is a scale, not arbitrary numbers. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 16,
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
  /** Cards. */
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
