import { DEMO_MODE } from "../../config/env";
import { api } from "../api/client";
import {
  hasHardwareKeystore,
  isHardwareBacked,
  publicKeySPKI,
  signMessage,
} from "./keystore";
import * as SecureStore from "expo-secure-store";

/**
 * Hardware-backed device identity — the part that gives the Android Keystore key a
 * meaning to the server (docs/TRD.md device-identity section).
 *
 * On sign-in we register this install's public key (SPKI) and immediately prove
 * possession of the private half by signing a server-issued challenge nonce. This is a
 * one-time, non-blocking, best-effort step: a missing Keystore module (Expo Go, iOS) or
 * any failure degrades to silent no-op, never a broken sign-in. Threat model is
 * "sign-in happened"; per-request attestation is deliberately out of scope.
 *
 * The private key never leaves the Keystore; only the SPKI and signatures cross the wire.
 */

const DEVICE_ID_KEY = "atsumaru.device_id.v1";

let cachedDeviceId: string | undefined;

export function newDeviceId(): string {
  // Expo Go / RN 0.86 may not expose crypto.randomUUID; fall back to a dense random id.
  const random = globalThis.crypto?.randomUUID?.() ?? "";
  if (random) return random;
  return (
    "dev-" +
    Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("")
  );
}

/** Stable per-install device id, stored in SecureStore alongside the auth token. */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId !== undefined) return cachedDeviceId;

  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  const id = stored ?? newDeviceId();

  if (!stored) {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id).catch(() => {});
  }
  cachedDeviceId = id;
  return id;
}

/** Sync read for the request interceptor — set once the id has been resolved. */
export function getCachedDeviceId(): string | null {
  return cachedDeviceId ?? null;
}

/** base64 of the raw 32 challenge bytes — the server verifies over those same bytes. */
function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/**
 * Best-effort registration + proof-of-possession at sign-in. Never throws to callers;
 * returns `null` when the platform can't do hardware device identity.
 */
export async function registerDeviceIdentity(): Promise<{
  verified: boolean;
  hardwareBacked: boolean;
} | null> {
  // Demo mode has no server: simulate a verified device so nothing downstream branches.
  if (DEMO_MODE) {
    return { verified: true, hardwareBacked: false };
  }

  // Expo Go has no Keystore module (custom native code needs a dev build).
  if (!hasHardwareKeystore()) {
    return null;
  }

  try {
    const deviceId = await getDeviceId();
    const spki = await publicKeySPKI();
    const hardwareBacked = await isHardwareBacked();

    if (!spki) return null;

    await api.post("/users/me/device", {
      device_id: deviceId,
      public_key: spki,
      strongbox: hardwareBacked,
    });

    const { nonce } = await api.get<{ nonce: string }>(
      "/users/me/device/challenge",
      { device_id: deviceId }
    );

    // The server issued a hex nonce; sign its raw byte form, the same bytes it verifies.
    const signature = await signMessage(hexToBase64(nonce));
    if (!signature) return null;

    await api.post("/users/me/device/verify", {
      device_id: deviceId,
      signed_nonce: signature,
    });

    return { verified: true, hardwareBacked };
  } catch {
    // Best-effort: device identity must never block sign-in (docs/RULES.md degrade).
    return null;
  }
}

/** True when the current build can carry a hardware-backed identity at all. */
export function deviceIdentityAvailable(): boolean {
  return hasHardwareKeystore() && !DEMO_MODE;
}