import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for credentials that must be reversible (unlike
// Employee.pinCodeHash/User.passwordHash, which are one-way and never need
// decrypting). The Shopify access token is the first secret in this app
// that needs this — it grants read access to real Shopify order/customer
// data, so it's kept out of the DB in plaintext even behind existing RBAC.
function getKey(): Buffer {
  const hex = process.env.SHOPIFY_TOKEN_ENC_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("SHOPIFY_TOKEN_ENC_KEY must be set to a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedToken {
  cipher: string;
  iv: string;
  tag: string;
}

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(12);
  const encryptor = createCipheriv("aes-256-gcm", getKey(), iv);
  const cipher = Buffer.concat([encryptor.update(plaintext, "utf8"), encryptor.final()]);
  return { cipher: cipher.toString("hex"), iv: iv.toString("hex"), tag: encryptor.getAuthTag().toString("hex") };
}

export function decryptToken(encrypted: EncryptedToken): string {
  const decryptor = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(encrypted.iv, "hex"));
  decryptor.setAuthTag(Buffer.from(encrypted.tag, "hex"));
  const plaintext = Buffer.concat([decryptor.update(Buffer.from(encrypted.cipher, "hex")), decryptor.final()]);
  return plaintext.toString("utf8");
}
