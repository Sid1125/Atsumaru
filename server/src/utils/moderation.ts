/**
 * Minimal content gate for the three fields that become **public identity**:
 * `users.display_name`, `users.handle` and `events.title`.
 *
 * Before this existed, those fields were validated for *length only*, so a slur
 * could be — and was — published through the app's own onboarding and
 * create-event flows and shown to every other member (TRACKER §5j).
 *
 * Scope is deliberately narrow. This is not a moderation system:
 *   - it blocks a small list of unambiguous slurs, not profanity in general
 *   - it never edits or masks user text, it rejects the write
 *   - it is server-side, because the client is not a trust boundary
 *
 * Anything richer (reporting, review queues, per-locale lists) is a product
 * feature and belongs behind a real decision, not smuggled in here.
 */

/**
 * Unambiguous slurs, stored as lowercase fragments matched against a normalised
 * copy of the input. Kept small on purpose: every entry is a term with no
 * legitimate use as a public display name, so there are no false positives to
 * argue about. Fragments (not whole words) because the observed abuse was
 * `"<slur>'s Hideout"` — a whole-word match on a possessive would have missed it.
 */
const BLOCKED_FRAGMENTS: readonly string[] = [
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "chink",
  "spic",
  "kike",
  "tranny",
];

/**
 * Folds the tricks used to slip a term past a substring match: case, accents,
 * separators, and the common letter/digit homoglyphs.
 *
 * This is not meant to defeat a determined adversary — that is an arms race a
 * fragment list cannot win. It is meant to stop the casual variant, which is
 * what actually reaches a demo.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    // Strip diacritics so "nìgga" folds to "nigga".
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0]/g, "o")
    .replace(/[1|!]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    // Collapse anything that is not a letter or digit, so "n i g g a" and
    // "n-i-g-g-a" both fold to the bare term.
    .replace(/[^a-z0-9]/g, "");
}

/** True when the text contains a blocked term. */
export function containsBlockedTerm(value: string): boolean {
  const normalised = normalise(value);

  return BLOCKED_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

/**
 * Throws nothing and returns nothing — callers decide the error shape, because
 * the three call sites already have their own `HttpError` conventions and
 * error codes. Exported separately so it can be unit-tested without a route.
 */
export const BLOCKED_TERM_MESSAGE =
  "That name contains language we do not allow. Please choose another.";
