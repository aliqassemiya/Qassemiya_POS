import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for credentials that must be reversible (unlike
// Employee.pinCodeHash/User.passwordHash, which are one-way and never need
// decrypting). Each integration (Shopify, WhatsApp, ...) passes its own
// env-var name so every credential is encrypted under its own independent
// key — one leaking doesn't expose the others.
function getKey(keyEnvVar: string): Buffer {
  const hex = process.env[keyEnvVar];
  if (!hex || hex.length !== 64) {
    throw new Error(`${keyEnvVar} must be set to a 64-character hex string (32 bytes)`);
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedToken {
  cipher: string;
  iv: string;
  tag: string;
}

export function encryptToken(plaintext: string, keyEnvVar: string): EncryptedToken {
  const iv = randomBytes(12);
  const encryptor = createCipheriv("aes-256-gcm", getKey(keyEnvVar), iv);
  const cipher = Buffer.concat([encryptor.update(plaintext, "utf8"), encryptor.final()]);
  return { cipher: cipher.toString("hex"), iv: iv.toString("hex"), tag: encryptor.getAuthTag().toString("hex") };
}

export function decryptToken(encrypted: EncryptedToken, keyEnvVar: string): string {
  const decryptor = createDecipheriv("aes-256-gcm", getKey(keyEnvVar), Buffer.from(encrypted.iv, "hex"));
  decryptor.setAuthTag(Buffer.from(encrypted.tag, "hex"));
  const plaintext = Buffer.concat([decryptor.update(Buffer.from(encrypted.cipher, "hex")), decryptor.final()]);
  return plaintext.toString("utf8");
}
