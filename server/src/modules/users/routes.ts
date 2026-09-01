import { Router } from "express";
import { z } from "zod";
import { createPublicKey, randomBytes } from "node:crypto";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import {
  clearDeviceChallenge,
  db,
  getDeviceKey,
  publicUser,
  registerDeviceKey,
  setDeviceChallenge,
} from "../../db/queries.js";
import { verifyDeviceSignature } from "./deviceIdentity.js";
import { EXPO_PUSH_TOKEN_RE } from "../../services/push.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { param } from "../../utils/request.js";
import { LANGUAGES } from "../../types.js";

const patchSchema = z.object({
  display_name: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().nullable().optional(),
  interests: z.array(z.string().min(1).max(40)).max(30).optional(),
  language: z.enum(LANGUAGES).optional(),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

export const usersRouter = Router();

usersRouter.get(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) =>
    ok(res, { user: await publicUser(req.userId!) })
  )
);

usersRouter.patch(
  "/me",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = patchSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid profile payload.");
    }

    const { location, ...rest } = parsed.data;

    const patch: Record<string, unknown> = { ...rest };

    // Location is stored as PostGIS geography; only used for nearby discovery.
    if (location) {
      patch.location = `SRID=4326;POINT(${location.lng} ${location.lat})`;
    }

    const { error } = await db().from("users").update(patch).eq("id", req.userId!);

    if (error) throw dbError(error);

    return ok(res, { user: await publicUser(req.userId!) });
  })
);

const pushTokenSchema = z.object({
  token: z.string().regex(EXPO_PUSH_TOKEN_RE, "Expected an Expo push token."),
  platform: z.enum(["android", "ios"]).optional(),
});

// Not in docs/API_STRUCTURE.md: the contract describes the notification but not where
// the device registers. Needed for the feedback reminder (docs/TRD.md §14).
usersRouter.post(
  "/me/push-token",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = pushTokenSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { error } = await db()
      .from("push_tokens")
      .upsert(
        {
          user_id: req.userId!,
          token: parsed.data.token,
          platform: parsed.data.platform ?? null,
        },
        { onConflict: "user_id,token" }
      );

    if (error) throw dbError(error);

    return ok(res, { success: true });
  })
);

// Other users' profiles expose the public projection only — never real_name.
usersRouter.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => ok(res, { user: await publicUser(param(req, "id")) }))
);

// ── Hardware-backed device identity ──────────────────────────────────────────
// The device generates an ECDSA P-256 key inside the Android Keystore (private key
// never leaves hardware), uploads the SPKI certificate, then proves possession by
// signing a challenge nonce. RLS stays on; every access below uses the service-role key.

const deviceSchema = z.object({
  device_id: z.string().min(1).max(80),
  public_key: z
    .string()
    .min(1)
    .refine((s) => {
      try {
        createPublicKey({
          key: Buffer.from(s, "base64"),
          format: "der",
          type: "spki",
        });
        return true;
      } catch {
        return false;
      }
    }, "Expected a base64 SPKI certificate."),
  strongbox: z.boolean().optional(),
});

const verifyDeviceSchema = z.object({
  device_id: z.string().min(1).max(80),
  signed_nonce: z.string().min(1),
});

/** A challenge lasts ~2 minutes and is single-use — long enough to sign, not to replay. */
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

usersRouter.post(
  "/me/device",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = deviceSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid device payload.");
    }

    const device = await registerDeviceKey(
      req.userId!,
      parsed.data.device_id,
      parsed.data.public_key,
      parsed.data.strongbox ?? false
    );

    return ok(res, { device_id: device.device_id, registered: true });
  })
);

usersRouter.get(
  "/me/device/challenge",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const deviceId = String(req.query.device_id ?? "");

    if (!deviceId) {
      throw new HttpError(400, "INVALID_QUERY", "device_id is required.");
    }

    const device = await getDeviceKey(req.userId!, deviceId);
    if (!device) {
      throw new HttpError(404, "DEVICE_NOT_FOUND", "Device has not been registered.");
    }

    const nonce = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

    await setDeviceChallenge(req.userId!, deviceId, nonce, expiresAt);

    return ok(res, { nonce });
  })
);

usersRouter.post(
  "/me/device/verify",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = verifyDeviceSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Invalid verification payload.");
    }

    const { device_id, signed_nonce } = parsed.data;
    const device = await getDeviceKey(req.userId!, device_id);

    if (
      !device ||
      !device.challenge_nonce ||
      !device.challenge_expires_at ||
      new Date(device.challenge_expires_at).getTime() < Date.now()
    ) {
      throw new HttpError(401, "DEVICE_UNVERIFIED", "No valid challenge for this device.");
    }

    if (!verifyDeviceSignature(device.public_key_spki, device.challenge_nonce, signed_nonce)) {
      throw new HttpError(401, "DEVICE_UNVERIFIED", "Signature does not match this device's public key.");
    }

    await clearDeviceChallenge(req.userId!, device_id);

    return ok(res, { verified: true });
  })
);
