import { createPublicKey, verify } from "node:crypto";

/**
 * Verifies a device's proof-of-possession signature.
 *
 * The device signs the raw 32 challenge bytes with its Keystore private key
 * (ECDSA P-256 / SHA256withECDSA). We verify over the same bytes with the stored SPKI
 * certificate. Returns `false` for any malformed input — never throws.
 */
export function verifyDeviceSignature(
  spkiBase64: string,
  nonceHex: string,
  signatureBase64: string
): boolean {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(spkiBase64, "base64"),
      format: "der",
      type: "spki",
    });

    return verify("sha256", Buffer.from(nonceHex, "hex"), publicKey, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}