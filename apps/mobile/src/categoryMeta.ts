/**
 * One source of truth for how a category looks everywhere — card, map pin,
 * filter chip, meetup hero. Before this, each surface kept its own glyph map
 * and drifted apart. The mark is an SVG icon (never an emoji), and colour is
 * `colors.sticker`, keyed by category, so the gauge of a category is
 * consistent across the whole app.
 */

import type { ComponentType } from "react";

import {
  IconArts,
  IconFood,
  IconGaming,
  IconLearning,
  IconMusic,
  IconOutdoor,
  IconSports,
  IconTravel,
  IconWellness,
  type IconProps,
} from "./components/ui/Icons";
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

export const CATEGORY_ICON: Record<string, ComponentType<IconProps>> = {
  food: IconFood,
  gaming: IconGaming,
  arts: IconArts,
  outdoor: IconOutdoor,
  music: IconMusic,
  wellness: IconWellness,
  travel: IconTravel,
  learning: IconLearning,
  sports: IconSports,
};

/** Unknown category degrades to the first icon rather than a crash. */
export function categoryIcon(category: string): ComponentType<IconProps> {
  return CATEGORY_ICON[category] ?? IconFood;
}

/** Unknown category degrades to the first sticker rather than a crash. */
export function categorySticker(category: string): {
  bg: string;
  on: string;
} {
  return colors.sticker[category as keyof typeof colors.sticker] ?? colors.sticker.food;
}