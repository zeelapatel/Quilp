import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKeyBuffer(key: string): Buffer {
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return keyBuffer;
}

export function encryptToken(plaintext: string, key: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKeyBuffer(key), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(ciphertext: string, key: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid ciphertext format");
  }
  const decipher = createDecipheriv(ALGORITHM, getKeyBuffer(key), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
