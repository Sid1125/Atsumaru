/** pgvector round-trips as a "[1,2,3]" string through supabase-js. */
export function parseVector(value: unknown): number[] | null {
  const raw = typeof value === "string" ? tryJson(value) : value;

  if (!Array.isArray(raw) || raw.length === 0) return null;

  // A partially numeric vector would silently corrupt every later cosine score.
  return raw.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? (raw as number[])
    : null;
}

function tryJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function serializeVector(vector: number[]): string {
  return JSON.stringify(vector);
}
