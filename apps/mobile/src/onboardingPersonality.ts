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

import en from "./i18n/locales/en.json";
import ja from "./i18n/locales/ja.json";
import zh from "./i18n/locales/zh.json";
import type { Language } from "./types/api";

const TRAIT_LABELS: Record<Language, Record<PersonalityKey, string>> = {
  en: en.onboarding.traits,
  ja: ja.onboarding.traits,
  zh: zh.onboarding.traits,
};

/**
 * Every surface spelling a trait can arrive as. The AI host returns tags in the
 * user's *chat* language (ja labels for a Japanese speaker), which may differ
 * from the current app language, so matching is over all three locales plus the
 * canonical key — never a single-language equality.
 */
const TRAIT_ALIASES: Record<PersonalityKey, string[]> = (() => {
  const aliases = {} as Record<PersonalityKey, string[]>;
  for (const key of PERSONALITY_KEYS) {
    aliases[key] = [
      ...new Set(
        [
          key,
          ...(["en", "ja", "zh"] as Language[]).map((lang) => TRAIT_LABELS[lang][key]),
        ].map((value) => value.toLowerCase())
      ),
    ];
  }
  return aliases;
})();

/** Which fixed trait a stored tag is, across all locales — or null for a stray. */
export function traitKeyFor(tag: string): PersonalityKey | null {
  const lower = tag.toLowerCase().trim();
  for (const key of PERSONALITY_KEYS) {
    if (TRAIT_ALIASES[key].includes(lower)) return key;
  }
  return null;
}

/**
 * The tag in the caller's language when it matches the vocabulary, else the raw
 * tag — used when displaying a stored profile so a ja tag reads as its en label
 * for an English speaker, and an out-of-vocab tag is never silently rewritten.
 */
export function traitLabel(tag: string, language: Language): string {
  const key = traitKeyFor(tag);
  return key ? TRAIT_LABELS[language][key] : tag;
}