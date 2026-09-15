/**
 * Turns a stored interest/personality tag into something a person can read.
 *
 * ## Why this exists
 *
 * Interests are extracted by the onboarding model, and it returns machine-shaped
 * slugs: `curry_rice`, `jazzy_cafe`, `matcha_sweets`, `cozy_hideaway`,
 * `shinjuku_cafe_crawl`. Those were rendering verbatim, underscores and all, on the
 * profile-confirm screen and on the profile itself — the one place the product
 * shows a person the words it thinks describe them.
 *
 * The demo layer hides this: `demo/world.ts` hands back a clean vocabulary
 * ("board games", "retro games"), so the bug only appears against the live API.
 * That is exactly why the fix belongs at the render layer rather than in the
 * extraction — it has to hold whatever any future model returns.
 *
 * ## What it deliberately does not do
 *
 * No Title Case. A tag is a noun phrase inside a sentence-case interface, and
 * "Curry Rice" reads like a proper noun. Only the separators change and only the
 * first letter is raised, so `curry_rice` becomes "Curry rice" and an already-clean
 * "board games" is returned untouched.
 *
 * Tags the member typed themselves pass through unchanged, because they contain no
 * separators to convert.
 */
export function tagLabel(tag: string): string {
  const spaced = tag
    // `_` and `-` are both used as slug separators by different models.
    .replace(/[_-]+/g, " ")
    // Defensive against `curryRice`: split camelCase before lowercasing it away.
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!spaced) return tag;

  // Sentence case, not Title Case — and only touch the first character, so an
  // acronym or a proper noun the member typed ("Shibuya", "JR") keeps its shape.
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
