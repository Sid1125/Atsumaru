/**
 * Avatar upload validation — pure, so the negative cases are unit-testable
 * without a database (the same split as `modules/recap/vibe.ts`).
 *
 * The client sends a base64 data URL (`data:image/jpeg;base64,…`); the server
 * decodes it, caps the size, and only ever admits the three web-safe raster
 * types — no SVG (a script tag in an `<img>` is a real risk on the site) and
 * no `image/*` wildcard from the mime type string.
 */

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

/** 5 MB decoded — a compressed phone photo with `quality` set sits far below. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

export type DecodedAvatar =
  | { ok: true; mime: AvatarMime; buffer: Buffer }
  | { ok: false; reason: "invalid" | "too-large" };

export function parseDataUrl(dataUrl: string): DecodedAvatar {
  const match = DATA_URL_RE.exec(dataUrl.trim());

  if (!match) return { ok: false, reason: "invalid" };

  const buffer = Buffer.from(match[2]!, "base64");

  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    return { ok: false, reason: "too-large" };
  }

  return { ok: true, mime: `image/${match[1]}` as AvatarMime, buffer };
}