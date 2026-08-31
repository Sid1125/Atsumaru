/**
 * Vibe recap — the pure half (docs/AI.md §6a, docs/IDEA.md §10).
 *
 * After a meetup finishes, each member who left feedback gets one short line about what
 * their own ratings imply: "You clicked with people who love hiking and coffee." It is a
 * reflection of the caller's taste, not a report on the group.
 *
 * Two constraints shape everything here, both from docs/RULES.md §8 and §13:
 *
 * 1. **Nothing identifying may reach the model.** The prompt carries anonymised traits
 *    and counts only — never a handle, display name, user id, or rating-to-person
 *    mapping. `recapInput` is the only shape `vibeRecap()` accepts, and it cannot
 *    express a person.
 * 2. **A recap is per-caller.** It is built from the rows where `from_user` is the
 *    caller, so two members of one meetup see different text and neither learns who the
 *    other picked. `traitsFromRatings` never receives the other members' feedback.
 *
 * Everything in this file is deterministic and I/O-free, so the interesting cases are
 * unit-testable without a database or a model (see `vibe.test.ts`).
 */

import type { Language } from "../../types.js";
import type { Rating } from "../matching/score.js";

/** Traits a rating has to reach before it is worth naming; below this it is noise. */
const MIN_TRAIT_WEIGHT = 1;

/** A recap names a few traits, not a list. More than this reads like a data dump. */
export const MAX_RECAP_TRAITS = 3;

/** Matches the `check (length(recap) between 1 and 400)` on `meetup_recaps`. */
export const MAX_RECAP_CHARS = 400;

/** How much each rating pulls a trait toward "liked" (docs/AI.md §6). */
const RATING_WEIGHT: Record<Rating, number> = {
  fire: 2,
  good: 1,
  meh: -1,
};

export interface RatedMember {
  rating: Rating;
  /** The rated member's public interests + personality. Never their identity. */
  traits: string[];
}

export interface TraitSummary {
  /** Traits the caller rated positively, strongest first. */
  liked: string[];
  /** Traits the caller rated `meh`, and did not also like. */
  cooled: string[];
  /** How many people the caller rated. Used for wording, never to name anyone. */
  ratedCount: number;
}

/**
 * Aggregates the caller's own ratings into anonymised trait buckets.
 *
 * A trait can appear on several members, so weights sum: two `fire`s on people who both
 * like hiking is a stronger signal than one. Ties break alphabetically rather than by
 * input order, because input order is member join order — letting it leak through would
 * make the recap's wording a weak channel for *who* was rated.
 */
export function traitsFromRatings(rated: RatedMember[]): TraitSummary {
  const weights = new Map<string, number>();

  for (const member of rated) {
    // A trait repeated on one member must not count twice.
    for (const trait of new Set(member.traits.map(normalizeTrait).filter(Boolean))) {
      weights.set(trait, (weights.get(trait) ?? 0) + RATING_WEIGHT[member.rating]);
    }
  }

  const sorted = [...weights.entries()].sort(
    ([aTrait, aWeight], [bTrait, bWeight]) =>
      bWeight - aWeight || aTrait.localeCompare(bTrait)
  );

  return {
    liked: sorted
      .filter(([, weight]) => weight >= MIN_TRAIT_WEIGHT)
      .slice(0, MAX_RECAP_TRAITS)
      .map(([trait]) => trait),
    cooled: sorted
      .filter(([, weight]) => weight < 0)
      .slice(0, MAX_RECAP_TRAITS)
      .map(([trait]) => trait),
    ratedCount: rated.length,
  };
}

/** Trims and lowercases; an empty trait is dropped by the caller's `filter(Boolean)`. */
function normalizeTrait(trait: string): string {
  return trait.trim().toLowerCase();
}

interface RecapTemplates {
  clicked: (traits: string) => string;
  broad: string;
  quiet: string;
  /** Separator between all but the last two traits. */
  join: string;
  /** Separator before the final trait — English needs "and", CJK does not. */
  lastJoin: string;
}

/**
 * The fallback recap, in the member's own language (docs/RULES.md §12).
 *
 * This is not a degraded path so much as the floor: no `GROQ_API_KEY`, an unusable model
 * answer, or a rate-limited caller all land here, and the member still gets a real
 * sentence. Onboarding can afford to 503 because the user is sitting there waiting; a
 * recap is passive, so an empty card would just look broken.
 */
const TEMPLATES = {
  en: {
    clicked: (traits) => `You clicked with people who love ${traits}.`,
    broad: "You matched with a mix of different vibes.",
    quiet: "A quieter meetup — your next group will tune to your taste.",
    join: ", ",
    lastJoin: " and ",
  },
  ja: {
    clicked: (traits) => `${traits}が好きな人と気が合ったようです。`,
    broad: "いろいろなタイプの人と気が合いました。",
    quiet: "今回は静かな集まりでした。次のグループはもっと好みに近づきます。",
    join: "、",
    lastJoin: "、",
  },
  zh: {
    clicked: (traits) => `你和喜欢${traits}的人很投缘。`,
    broad: "你和不同类型的人都聊得来。",
    quiet: "这次比较安静，下一个小组会更贴近你的喜好。",
    join: "、",
    lastJoin: "、",
  },
} as const satisfies Record<Language, RecapTemplates>;

export function templateRecap(language: Language, summary: TraitSummary): string {
  const text: RecapTemplates = TEMPLATES[language] ?? TEMPLATES.en;

  if (summary.ratedCount === 0) return text.quiet;

  // Rated people, but nothing positive came through: say so without implying a verdict
  // on anyone. "quiet" is deliberately about the meetup, not about the members.
  if (summary.liked.length === 0) return text.quiet;

  // One trait is a claim; several are a pattern. Both read better than a bare list.
  if (summary.liked.length === 1) return text.clicked(summary.liked[0]!);

  // "a, b and c" — `join` for the run, `lastJoin` once. Using one separator for both
  // produced "ramen and coffee and hiking" in English.
  const listed = summary.liked.slice(0, MAX_RECAP_TRAITS);
  const tail = listed.pop()!;

  return text.clicked(`${listed.join(text.join)}${text.lastJoin}${tail}`);
}

/**
 * The exact payload allowed to reach Groq. Anonymous by construction — there is no field
 * a handle or user id could travel in, which is a stronger guarantee than remembering to
 * strip them at the call site.
 */
export interface RecapPrompt {
  language: Language;
  liked: string[];
  cooled: string[];
  ratedCount: number;
  /** The meetup's category, e.g. "outdoor". Public, and not member-specific. */
  category: string;
}

export function recapPrompt(
  language: Language,
  category: string,
  summary: TraitSummary
): RecapPrompt {
  return {
    language,
    liked: summary.liked,
    cooled: summary.cooled,
    ratedCount: summary.ratedCount,
    category,
  };
}

/**
 * Last gate on model output before it is stored or rendered (docs/RULES.md §13).
 *
 * Groq is instructed to answer with one short sentence, but instructions are not
 * guarantees: it can return markdown, a paragraph, a JSON fragment, or — the case that
 * actually matters — a handle it hallucinated. Returns null when the text is unusable,
 * which the route reads as "use the template".
 */
export function sanitizeRecap(
  raw: string,
  banned: string[] = []
): string | null {
  // Collapse newlines first: a multi-line answer is a formatting failure, not a reason
  // to discard content the member would otherwise have found useful. `\s` misses the
  // unicode NEL separator (U+0085), which a model can emit around an em-dash; guard it.
  const text = raw.replace(/[\s\u0085]+/g, " ").trim();

  if (text.length === 0 || text.length > MAX_RECAP_CHARS) return null;

  // A model that emitted an @handle is inventing identity, and identity is exactly what
  // a recap must never carry. Reject rather than strip: a sentence built around a name
  // reads wrong with the name cut out.
  if (/@[a-z0-9_]{3,}/i.test(text)) return null;

  const lowered = text.toLowerCase();

  // Anything caller-identifying that was never in the prompt can only be hallucinated,
  // but check anyway — a real handle appearing here would be a privacy leak, not a typo.
  for (const term of banned) {
    const needle = term.trim().toLowerCase();
    if (needle.length >= 3 && lowered.includes(needle)) return null;
  }

  return text;
}
