import { createHash } from "node:crypto";

/**
 * A bit-array bloom filter over taken handles, used as a fast negative pre-check.
 *
 * The DB unique constraint is always the source of truth: `maybePresent` returning
 * `false` means a handle is *definitely free* (no DB hit needed); `true` means it
 * *may* be taken, so the caller confirms against the DB. This layered design keeps
 * the happy path (a fresh suffixed handle) off the database while never letting a
 * stale or false-positive filter admit a real duplicate.
 *
 * Hashing is dependency-free double-hash from a single sha256: the first and second
 * 32-bit words are independent indices at the 64-bit entropy point. `k=2` is chosen
 * so the filter is cheap for a per-keystroke check; with `m=10_000` bits the false
 * positive rate stays under ~1% up to roughly a thousand live handles, and a miss is
 * absorbed by the DB confirm anyway.
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly size: number;
  private readonly k: number;

  constructor(size = 10_000, k = 2) {
    this.size = size;
    this.k = k;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  /** Two independent 32-bit hashes for `value` (sha256-derived, stable across calls). */
  private indices(value: string): number[] {
    const digest = createHash("sha256").update(value).digest();
    const indices: number[] = [];
    for (let i = 0; i < this.k; i++) {
      // i-th pair of bytes as a 32-bit integer. The digest is 32 bytes so we have
      // up to 16 usable words; k is 2 in practice.
      const word =
        (digest[i * 4]! << 24) |
        (digest[i * 4 + 1]! << 16) |
        (digest[i * 4 + 2]! << 8) |
        digest[i * 4 + 3]!;
      indices.push(((word >>> 0) % this.size + this.size) % this.size);
    }
    return indices;
  }

  add(value: string): void {
    for (const index of this.indices(value)) {
      this.bits[index >> 3]! |= 1 << (index & 7);
    }
  }

  /** `false` = value is definitely not present; `true` = it may be present. */
  maybePresent(value: string): boolean {
    for (const index of this.indices(value)) {
      if ((this.bits[index >> 3]! & (1 << (index & 7))) === 0) return false;
    }
    return true;
  }
}
