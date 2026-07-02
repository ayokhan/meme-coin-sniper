/**
 * Per-user Blofin API config: load/save with encryption at rest.
 * Requires ENCRYPTION_KEY (32-byte hex or 32-char string for AES-256-GCM).
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { BlofinConfig } from "@/lib/blofin";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set. Required for per-user Blofin config.");
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(b64: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(b64, "base64");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) throw new Error("Invalid encrypted payload");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const enc = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

/** Load Blofin config for a user (decrypt). Returns null if not set or invalid. */
export async function getBlofinConfigForUser(userId: string): Promise<BlofinConfig | null> {
  try {
    const row = await (prisma as any).userBlofinConfig.findUnique({ where: { userId } });
    if (!row) return null;
    const apiKey = decrypt(row.encryptedApiKey);
    const secretKey = decrypt(row.encryptedSecretKey);
    const passphrase = decrypt(row.encryptedPassphrase);
    if (!apiKey || !secretKey || !passphrase) return null;
    return {
      apiKey,
      secretKey,
      passphrase,
      demo: row.demoMode,
      brokerId: row.brokerId ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Save Blofin config for a user (encrypt). */
export async function saveBlofinConfigForUser(
  userId: string,
  config: { apiKey: string; secretKey: string; passphrase: string; demo?: boolean; brokerId?: string }
): Promise<void> {
  getEncryptionKey(); // throws if not set
  await (prisma as any).userBlofinConfig.upsert({
    where: { userId },
    create: {
      userId,
      encryptedApiKey: encrypt(config.apiKey),
      encryptedSecretKey: encrypt(config.secretKey),
      encryptedPassphrase: encrypt(config.passphrase),
      demoMode: config.demo ?? true,
      brokerId: config.brokerId ?? null,
    },
    update: {
      encryptedApiKey: encrypt(config.apiKey),
      encryptedSecretKey: encrypt(config.secretKey),
      encryptedPassphrase: encrypt(config.passphrase),
      demoMode: config.demo ?? true,
      brokerId: config.brokerId ?? null,
    },
  });
}

/** Update demo/live mode on saved Blofin keys without re-entering secrets. */
export async function updateBlofinDemoModeForUser(userId: string, demo: boolean): Promise<boolean> {
  const row = await (prisma as any).userBlofinConfig.findUnique({ where: { userId } });
  if (!row) return false;
  await (prisma as any).userBlofinConfig.update({
    where: { userId },
    data: { demoMode: demo },
  });
  return true;
}

/** Remove saved Blofin config for a user. */
export async function deleteBlofinConfigForUser(userId: string): Promise<void> {
  await (prisma as any).userBlofinConfig.deleteMany({ where: { userId } });
}

/** Check if any user has Blofin config (for feature hint). */
export async function hasAnyUserBlofinConfig(): Promise<boolean> {
  const count = await (prisma as any).userBlofinConfig.count();
  return count > 0;
}
