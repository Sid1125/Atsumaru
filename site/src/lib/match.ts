/**
 * Match-score colour ramp. One place decides how a percentage reads, so the same score
 * never shows up green in one mock-up and red in another.
 *
 *   ≥ 95  strong fit   → green
 *   90–94 good fit     → amber
 *   < 90  looser fit   → red
 */

export const MATCH_COLORS = {
  high: "#2E9E68",
  mid: "#B98A00",
  low: "#E02E17",
} as const;

export function matchColor(score: number): string {
  if (score >= 95) return MATCH_COLORS.high;
  if (score >= 90) return MATCH_COLORS.mid;

  return MATCH_COLORS.low;
}
