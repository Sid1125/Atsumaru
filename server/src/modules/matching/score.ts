/**
 * Authoritative match scoring (docs/AI.md §5). The app displays this result;
 * it must not compute its own score.
 *
 *   match_score = 0.6 * fit + 0.2 * group_balance + 0.2 * normalized_reputation
 *
 * `fit` measures the caller against the people actually in the group, not against
 * an averaged ghost: it is the mean cosine between the caller's preference vector
 * and each current member's vector, so a group where most members align with you
 * and one does not scores honestly lower than a group where everyone does. When
 * either side has no vector yet (a brand-new profile, or a cold group), fit falls
 * back to set-overlap similarity over the interest/personality tags, which exist
 * after onboarding even when the embedding did not land — that keeps a fresh user
 * from being hard-capped at the 0.40 ceiling the old centroid-only cosine imposed.
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Peaks when the group is nearly full but still has room for the joiner. */
export function groupBalance(currentSize: number, maxSize: number): number {
  if (maxSize <= 0) return 0;
  if (currentSize >= maxSize) return 0;

  return (currentSize + 1) / maxSize;
}

export function normalizeReputation(score: number): number {
  return Math.min(1, Math.max(0, score / 100));
}

/**
 * Set-overlap similarity over tag lists (interests + personality). This is the
 * cold-start stand-in for cosine when vectors are missing — the same shape the
 * demo mirror has always used — so an unembedded user still gets a real fit
 * signal from the tags onboarding collected.
 */
export function tagSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const left = new Set(a.map((v) => v.toLowerCase().trim()));
  const right = new Set(b.map((v) => v.toLowerCase().trim()));
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;

  return shared / Math.sqrt(left.size * right.size);
}

/**
 * Mean cosine between the caller's vector and each current member's vector.
 * Members without a vector are skipped; with nothing usable the fit is 0. The
 * mean is clamped at 0 so one opposite member cannot zero the whole score — a
 * neutral, no-data group should never outrank a genuinely bad fit.
 */
export function pairwiseFit(
  userVector: number[] | null,
  memberVectors: (number[] | null)[]
): number {
  if (!userVector) return 0;

  const usable = memberVectors.filter(
    (vector): vector is number[] => vector !== null && vector.length > 0
  );
  if (usable.length === 0) return 0;

  const sum = usable.reduce(
    (acc, vector) => acc + cosineSimilarity(userVector, vector),
    0
  );

  return Math.max(0, sum / usable.length);
}

/** Cold-start fit: mean tag similarity against each member with tags. */
export function tagFit(userTags: string[], memberTags: string[][]): number {
  const usable = memberTags.filter((tags) => tags.length > 0);
  if (userTags.length === 0 || usable.length === 0) return 0;

  const sum = usable.reduce((acc, tags) => acc + tagSimilarity(userTags, tags), 0);
  return sum / usable.length;
}

export function matchScore(input: {
  /** The caller's preference vector, or null when onboarding never embedded it. */
  userVector: number[] | null;
  /** The caller's interests + personality — the cold-start fit fallback. */
  userTags: string[];
  /** Each current member's vector, aligned with `memberTags`; null when absent. */
  memberVectors: (number[] | null)[];
  /** Each current member's interests + personality, aligned with `memberVectors`. */
  memberTags: string[][];
  currentSize: number;
  maxSize: number;
  reputation: number;
}): number {
  // Choose the fit signal by data availability, not by value: if both sides have
  // vectors, pairwise cosine is authoritative; only when one side is unembedded
  // does the score fall back to the tag overlap.
  const hasVectors =
    input.userVector !== null &&
    input.memberVectors.some((vector) => vector !== null);

  const fit = hasVectors
    ? pairwiseFit(input.userVector, input.memberVectors)
    : tagFit(input.userTags, input.memberTags);

  return (
    0.6 * fit +
    0.2 * groupBalance(input.currentSize, input.maxSize) +
    0.2 * normalizeReputation(input.reputation)
  );
}

/**
 * Feedback nudges the preference vector toward liked profiles and away from
 * disliked ones: new = old + lr * liked - lr * disliked (docs/AI.md §6).
 */
export function updatePreferenceVector(
  current: number[],
  liked: number[][],
  disliked: number[][],
  lr = 0.1
): number[] {
  const next = [...current];

  for (const vector of liked) {
    for (let i = 0; i < next.length && i < vector.length; i++) {
      next[i]! += lr * vector[i]!;
    }
  }

  for (const vector of disliked) {
    for (let i = 0; i < next.length && i < vector.length; i++) {
      next[i]! -= lr * vector[i]!;
    }
  }

  return next;
}

export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];

  const length = vectors[0]!.length;
  const sum = new Array<number>(length).fill(0);

  for (const vector of vectors) {
    for (let i = 0; i < length; i++) {
      sum[i]! += vector[i] ?? 0;
    }
  }

  return sum.map((value) => value / vectors.length);
}

export type Rating = "meh" | "good" | "fire";

/**
 * Reputation tracks participation and reliability, not popularity (docs/AI.md §7):
 * submitting feedback at all earns credit, skipping it costs a little, and ratings
 * received nudge it.
 */
export const REPUTATION_DELTA = {
  submittedFeedback: 2,
  missedFeedback: -2,
  fire: 3,
  good: 1,
  meh: -2,
} as const;

export function ratingDelta(rating: Rating): number {
  return REPUTATION_DELTA[rating];
}

export function applyReputation(current: number, delta: number): number {
  return Math.min(100, Math.max(0, current + delta));
}

/** `good` is a mild positive signal, so it moves the vector at half rate. */
export const GOOD_RATING_LR_FACTOR = 0.5;
