import { randomInt } from "node:crypto";

/**
 * Alphanumeric handle suggestions for the confirm step.
 *
 * The real-world shape is a readable base plus a random suffix (`drivinggames` ->
 * `drivinggames_a128df`). `base` is the handle text the user is typing; we sanitise it
 * to the allowed alphabet, then append `_` + a 5-char random suffix so the result stays
 * inside `HANDLE_RE` (`/^[a-z0-9_]{3,20}$/`) without ever needing a DB rule change.
 */

const BASE_RE = /^[a-z0-9_]+$/;
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LEN = 5;
const MAX_VARIANTS = 4;
const MAX_BASE = 14; // max handle 20 - ("_" + SUFFIX_LEN)

/** Lowercase and strip everything outside the allowed alphabet. Empty if nothing usable. */
export function sanitizeBase(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return cleaned.replace(/^_+|_+$/g, "").slice(0, MAX_BASE);
}

function randomSuffix(): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LEN; i++) {
    suffix += SUFFIX_CHARS[randomInt(0, SUFFIX_CHARS.length)];
  }
  return suffix;
}

/**
 * Return up to `MAX_VARIANTS` distinct `{base}_{suffix}` handles. The base is sanitised;
 * a base that survives sanitisation but is still empty (e.g. the user typed only
 * punctuation) yields no variants. Variants never collide with each other or repeat a
 * suffix, so they are safe to surface as independently-checkable suggestions.
 */
export function handleVariants(rawBase: string): string[] {
  const base = sanitizeBase(rawBase);
  if (!base || !BASE_RE.test(base)) return [];

  const seen = new Set<string>();
  for (let guard = 0; seen.size < MAX_VARIANTS && guard < 64; guard++) {
    const variant = `${base}_${randomSuffix()}`;
    if (BASE_RE.test(variant) && !seen.has(variant)) seen.add(variant);
  }
  return [...seen];
}
