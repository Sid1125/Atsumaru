/**
 * The fixed, localised personality vocabulary offered as quick-reply chips during
 * onboarding. `key` is the canonical (English) trait used to align with the server
 * SYSTEM_PROMPT and the demo `PERSONALITY_VOCAB`; the display label for a given
 * language lives in i18n under `onboarding.traits.<key>`, so every user-facing
 * string stays in the locale files (CLAUDE.md). The order here is the order the
 * chips render. Adding a trait means adding it here, its `onboarding.traits.<key>`
 * label in all three locales, and its keyword(s) to the demo PERSONALITY_VOCAB.
 */
export const PERSONALITY_KEYS = [
  "bubbly",
  "laidBack",
  "selfContained",
  "outgoing",
  "curious",
  "energetic",
  "thoughtful",
  "adventurous",
  "creative",
  "easygoing",
] as const;

export type PersonalityKey = (typeof PERSONALITY_KEYS)[number];
