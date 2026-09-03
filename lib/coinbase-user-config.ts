/**
 * Per-user Coinbase API config: load/save with encryption at rest.
 * Requires ENCRYPTION_KEY (32-byte hex or 32-char string for AES-256-GCM).
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { normalizeCoinbasePrivateKeyPem, type CoinbaseConfig } from "@/lib/coinbase";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set. Required for per-user Coinbase config.");
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

export async function getCoinbaseConfigForUser(userId: string): Promise<CoinbaseConfig | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (prisma as any).userCoinbaseConfig.findUnique({ where: { userId } });
    if (!row) return null;
    const apiKeyName = decrypt(row.encryptedApiKeyName);
    const apiSecret = normalizeCoinbasePrivateKeyPem(decrypt(row.encryptedApiSecret));
    if (!apiKeyName || !apiSecret) return null;
    return { apiKeyName, apiSecret, demo: row.demoMode };
  } catch {
    return null;
  }
}

export async function saveCoinbaseConfigForUser(
  userId: string,
  config: { apiKeyName: string; apiSecret: string; demo?: boolean }
): Promise<void> {
  getEncryptionKey();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).userCoinbaseConfig.upsert({
    where: { userId },
    create: {
      userId,
      encryptedApiKeyName: encrypt(config.apiKeyName),
      encryptedApiSecret: encrypt(config.apiSecret),
      demoMode: config.demo ?? false,
    },
    update: {
      encryptedApiKeyName: encrypt(config.apiKeyName),
      encryptedApiSecret: encrypt(config.apiSecret),
      demoMode: config.demo ?? false,
    },
  });
}

export async function updateCoinbaseDemoModeForUser(userId: string, demo: boolean): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (prisma as any).userCoinbaseConfig.findUnique({ where: { userId } });
  if (!row) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).userCoinbaseConfig.update({ where: { userId }, data: { demoMode: demo } });
  return true;
}

export async function deleteCoinbaseConfigForUser(userId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma as any).userCoinbaseConfig.deleteMany({ where: { userId } });
}

export async function hasAnyUserCoinbaseConfig(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await (prisma as any).userCoinbaseConfig.count();
  return count > 0;
}
