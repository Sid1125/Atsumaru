import { NativeModules, Platform } from "react-native";

/**
 * The one place the Android Keystore native module is read, and the only gate that
 * decides whether hardware-backed device identity is available at all.
 *
 * The native `AtsumaruKeystoreModule` is registered in `MainApplication.kt`, so it only
 * exists in a **dev/release build** — it is always absent in Expo Go. Unlike Mapbox there
 * is no risky module-scope throw to dodge, but the same rule applies: never reference
 * `NativeModules.AtsumaruKeystore` from a top-level import anywhere else. Every caller
 * treats a missing module as "device identity unavailable" and degrades silently.
 *
 * See components/map/mapbox.ts for the sibling pattern (and why we only touch native
 * modules in one place).
 */

interface KeystoreNativeModule {
  exists(alias: string): Promise<boolean>;
  generate(alias: string): Promise<boolean>;
  getPublicKeySPKI(alias: string): Promise<string>;
  sign(alias: string, message: string): Promise<string>;
  isHardwareBacked(alias: string): Promise<boolean>;
  delete(alias: string): Promise<boolean>;
}

/** `null` = module absent in this build (Expo Go, or iOS). */
let cached: KeystoreNativeModule | null | undefined;

function keystore(): KeystoreNativeModule | null {
  if (cached === undefined) {
    cached = Platform.OS === "android" ? (NativeModules.AtsumaruKeystore ?? null) : null;
  }
  return cached ?? null;
}

/** Whether the Keystore native module is linked in this build. */
export function hasHardwareKeystore(): boolean {
  return keystore() !== null;
}

/** The device alias — stable per install so the same key is reused across launches. */
export const DEVICE_KEY_ALIAS = "atsumaru.device_identity.v1";

export async function keyExists(): Promise<boolean> {
  const k = keystore();
  if (!k) return false;
  return k.exists(DEVICE_KEY_ALIAS);
}

/** Ensures the device key exists (no-op if it already does). */
export async function ensureKey(): Promise<void> {
  const k = keystore();
  if (!k) return;
  await k.generate(DEVICE_KEY_ALIAS);
}

/** Base64 SPKI certificate of the device public key, for the server to store. */
export async function publicKeySPKI(): Promise<string | null> {
  const k = keystore();
  if (!k) return null;
  await ensureKey();
  return k.getPublicKeySPKI(DEVICE_KEY_ALIAS);
}

/** Signs a base64 string; returns a base64 signature the server can verify. */
export async function signMessage(message: string): Promise<string | null> {
  const k = keystore();
  if (!k) return null;
  return k.sign(DEVICE_KEY_ALIAS, message);
}

/** True when the key was generated on secure hardware (StrongBox / secure element). */
export async function isHardwareBacked(): Promise<boolean> {
  const k = keystore();
  if (!k) return false;
  return k.isHardwareBacked(DEVICE_KEY_ALIAS);
}

/** Removes the device key (e.g. on account sign-out). */
export async function deleteKey(): Promise<void> {
  const k = keystore();
  if (!k) return;
  await k.delete(DEVICE_KEY_ALIAS);
}
