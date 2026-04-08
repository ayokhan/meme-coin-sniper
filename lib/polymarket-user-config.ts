/**
 * Per-user Polymarket CLOB API config: load/save with encryption at rest.
 * Requires ENCRYPTION_KEY (32-byte hex or any passphrase).
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set. Required for Polymarket config.");
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) return Buffer.from(raw, "hex");
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

export type PolymarketUserConfig = {
  address: string;
  apiKey: string;
  passphrase: string;
  secret: string;
};

export async function getPolymarketConfigForUser(userId: string): Promise<PolymarketUserConfig | null> {
  try {
    const row = await (prisma as any).userPolymarketConfig.findUnique({ where: { userId } });
    if (!row) return null;
    const apiKey = decrypt(row.encryptedApiKey);
    const passphrase = decrypt(row.encryptedPassphrase);
    const secret = decrypt(row.encryptedSecret);
    if (!apiKey || !passphrase || !secret || !row.address) return null;
    return { address: row.address, apiKey, passphrase, secret };
  } catch {
    return null;
  }
}

export async function savePolymarketConfigForUser(
  userId: string,
  config: PolymarketUserConfig
): Promise<void> {
  getEncryptionKey();
  await (prisma as any).userPolymarketConfig.upsert({
    where: { userId },
    create: {
      userId,
      address: config.address,
      encryptedApiKey: encrypt(config.apiKey),
      encryptedPassphrase: encrypt(config.passphrase),
      encryptedSecret: encrypt(config.secret),
    },
    update: {
      address: config.address,
      encryptedApiKey: encrypt(config.apiKey),
      encryptedPassphrase: encrypt(config.passphrase),
      encryptedSecret: encrypt(config.secret),
    },
  });
}

export async function deletePolymarketConfigForUser(userId: string): Promise<void> {
  await (prisma as any).userPolymarketConfig.deleteMany({ where: { userId } });
}

