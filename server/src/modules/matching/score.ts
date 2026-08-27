/**
 * Authoritative match scoring (docs/AI.md §5). The app displays this result;
 * it must not compute its own score.
 *
 *   match_score = 0.6 * cosine + 0.2 * group_balance + 0.2 * normalized_reputation
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

export function matchScore(input: {
  userVector: number[];
  groupVector: number[];
  currentSize: number;
  maxSize: number;
  reputation: number;
}): number {
  const similarity = Math.max(
    0,
    cosineSimilarity(input.userVector, input.groupVector)
  );

  return (
    0.6 * similarity +
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
