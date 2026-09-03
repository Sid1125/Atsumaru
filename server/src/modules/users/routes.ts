import { Router } from "express";
import { z } from "zod";
import { createPublicKey, randomBytes } from "node:crypto";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import { enforceReadLimit } from "../../utils/readLimit.js";
import {
  clearDeviceChallenge,
  db,
  getDeviceKey,
  publicUser,
  registerDeviceKey,
  setDeviceChallenge,
} from "../../db/queries.js";
import { parseDataUrl } from "./avatar.js";
import { verifyDeviceSignature } from "./deviceIdentity.js";
import { EXPO_PUSH_TOKEN_RE } from "../../services/push.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { param } from "../../utils/request.js";
import { HANDLE_RE } from "../../utils/handle.js";
import { serializeVector } from "../../utils/vector.js";
import { embed } from "../../services/ai.js";
import { LANGUAGES } from "../../types.js";

const patchSchema = z.object({
  handle: z.string().regex(HANDLE_RE, "3-20 chars: a-z, 0-9, underscore").optional(),
  display_name: z.string().min(1).max(40).optional(),
  avatar_url: z.string().url().nullable().optional(),
  interests: z.array(z.string().min(1).max(40)).max(30).optional(),
  personality: z.array(z.string().min(1).max(40)).max(8).optional(),
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

    // Changing interests/personality changes what matching should optimise for, so
    // re-embed the merged tags into the preference vector the same way onboarding
    // does. Embedding is best-effort: on failure the profile still saves and the
    // stored vector stays — matching already falls back to tag similarity.
    if (rest.interests !== undefined || rest.personality !== undefined) {
      const { data: current, error: currentError } = await db()
        .from("users")
        .select("interests, personality")
        .eq("id", req.userId!)
        .maybeSingle<{ interests: string[]; personality: string[] }>();

      if (currentError) throw dbError(currentError);

      try {
        const tags = [
          ...(rest.interests ?? current?.interests ?? []),
          ...(rest.personality ?? current?.personality ?? []),
        ];
        patch.preference_vector = serializeVector(await embed(tags.join(", ")));
      } catch (error) {
        console.warn("Embedding unavailable, keeping existing preference vector:", error);
      }
    }

    const { error } = await db().from("users").update(patch).eq("id", req.userId!);

    if (error) {
      // 23505 = unique_violation — the handle was taken between check and save.
      if (error.code === "23505") {
        throw new HttpError(409, "HANDLE_TAKEN", "That handle is already taken.");
      }
      throw dbError(error);
    }

    return ok(res, { user: await publicUser(req.userId!) });
  })
);

/**
 * Profile photo. The client sends a base64 data URL; the server decodes it,
 * validates it (avatar.ts), stores it in Supabase Storage under a public
 * `avatars` bucket, and points `users.avatar_url` at it. Storage failing is a
 * 503, not a crash — the same degradation convention as every integration.
 */
const avatarSchema = z.object({
  data_url: z.string().min(1).max(16 * 1024 * 1024),
});

usersRouter.post(
  "/me/avatar",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = avatarSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", "Expected { data_url }.");
    }

    const decoded = parseDataUrl(parsed.data.data_url);

    if (!decoded.ok) {
      throw decoded.reason === "too-large"
        ? new HttpError(413, "PAYLOAD_TOO_LARGE", "That photo is too large (max 5 MB).")
        : new HttpError(400, "INVALID_BODY", "Expected a base64 jpeg/png/webp data URL.");
    }

    let publicUrl: string;

    try {
      const storage = db().storage;

      // Bucket is created lazily on first upload; `getBucket` is the cheapest way
      // to ask, and a later `upload` failure surfaces the same way.
      const { data: bucket } = await storage.getBucket("avatars");
      if (!bucket) {
        await storage.createBucket("avatars", { public: true });
      }

      const ext = decoded.mime.split("/")[1];
      const path = `${req.userId}.${ext}`;

      const { error: uploadError } = await storage
        .from("avatars")
        .upload(path, decoded.buffer, {
          contentType: decoded.mime,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      publicUrl = storage.from("avatars").getPublicUrl(path).data.publicUrl;
    } catch (error) {
      console.warn("Avatar storage unavailable:", error);
      throw new HttpError(503, "STORAGE_UNAVAILABLE", "Photo storage is not configured.");
    }

    const { error } = await db()
      .from("users")
      .update({ avatar_url: publicUrl })
      .eq("id", req.userId!);

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
  asyncRoute(async (req, res) => {
    enforceReadLimit(req, res);
    return ok(res, { user: await publicUser(param(req, "id")) });
  })
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
