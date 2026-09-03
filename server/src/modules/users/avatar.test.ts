import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_AVATAR_BYTES, parseDataUrl } from "./avatar.js";

test("parseDataUrl accepts jpeg/png/webp base64 data URLs", () => {
  const pixel = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");

  const jpeg = parseDataUrl(`data:image/jpeg;base64,${pixel}`);
  assert.equal(jpeg.ok, true);
  if (jpeg.ok) {
    assert.equal(jpeg.mime, "image/jpeg");
    assert.deepEqual(jpeg.buffer, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  }

  const png = parseDataUrl(`data:image/png;base64,${pixel}`);
  assert.equal(png.ok && png.mime === "image/png", true);

  const webp = parseDataUrl(`data:image/webp;base64,${pixel}`);
  assert.equal(webp.ok && webp.mime === "image/webp", true);
});

test("parseDataUrl rejects anything that is not an image data URL", () => {
  assert.equal(parseDataUrl("").ok, false);
  assert.equal(parseDataUrl("not-a-data-url").ok, false);
  assert.equal(parseDataUrl("data:text/html;base64,PGh0bWw+").ok, false);
  assert.equal(parseDataUrl("data:image/svg+xml;base64,PHN2Zz4=").ok, false);
  assert.equal(parseDataUrl("data:image/jpeg;base64,%%%not-base64%%%").ok, false);
});

test("parseDataUrl rejects an empty or oversized payload", () => {
  const empty = parseDataUrl("data:image/jpeg;base64,");
  assert.deepEqual(empty, { ok: false, reason: "invalid" });

  const big = Buffer.alloc(MAX_AVATAR_BYTES + 1).toString("base64");
  const oversized = parseDataUrl(`data:image/jpeg;base64,${big}`);
  assert.deepEqual(oversized, { ok: false, reason: "too-large" });

  const atLimit = Buffer.alloc(MAX_AVATAR_BYTES).toString("base64");
  assert.equal(parseDataUrl(`data:image/jpeg;base64,${atLimit}`).ok, true);
});