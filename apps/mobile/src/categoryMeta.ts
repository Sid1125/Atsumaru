/**
 * One source of truth for how a category looks everywhere — card, map pin,
 * filter chip, meetup hero. Before this, each surface kept its own glyph map
 * and drifted apart. Colour is `colors.sticker`, keyed by category, so the
 * gauge of a category is consistent across the whole app.
 */

import { colors } from "./theme";

export const CATEGORY_ORDER = [
  "food",
  "gaming",
  "arts",
  "outdoor",
  "music",
  "wellness",
  "travel",
  "learning",
  "sports",
] as const;

export const CATEGORY_GLYPH: Record<string, string> = {
  food: "🍜",
  gaming: "🎮",
  arts: "🎨",
  outdoor: "🥾",
  music: "🎸",
  wellness: "🧘",
  travel: "🗺️",
  learning: "📚",
  sports: "⚽",
};

export function categoryGlyph(category: string): string {
  return CATEGORY_GLYPH[category] ?? "📍";
}

/** Unknown category degrades to the first sticker rather than a crash. */
export function categorySticker(category: string): {
  bg: string;
  on: string;
} {
  return colors.sticker[category as keyof typeof colors.sticker] ?? colors.sticker.food;
}