/**
 * Per-user forex broker (MT4/MT5) config: load/save with encryption at rest.
 * Mirrors lib/blofin-user-config.ts. Requires ENCRYPTION_KEY (AES-256-GCM).
 * Prisma model: userForexBrokerConfig, unique on [userId, broker].
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

/** Brokers users can connect for Nova Forex Bot / Scalper (any MT4/MT5 broker MetaAPI can reach). */
export type ForexBrokerId = "vantage" | "tiomarkets" | "myaccessmarkets";

/** Affiliate / partner promo brokers only (Admin → Banners). */
export type ForexPartnerBrokerId = "vantage" | "tiomarkets";

export const FOREX_BROKER_IDS: ForexBrokerId[] = ["vantage", "tiomarkets", "myaccessmarkets"];

export const FOREX_PARTNER_BROKER_IDS: ForexPartnerBrokerId[] = ["vantage", "tiomarkets"];

export const FOREX_BROKER_LABELS: Record<ForexBrokerId, string> = {
  vantage: "Vantage Markets",
  tiomarkets: "TIOmarkets",
  myaccessmarkets: "MyAccessMarkets",
};

export function parseForexBrokerId(raw: unknown): ForexBrokerId | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  if (s === "vantage" || s === "vantagemarkets") return "vantage";
  if (s === "tiomarkets" || s === "tio") return "tiomarkets";
  if (s === "myaccessmarkets" || s === "myaccess" || s === "accessmarkets") return "myaccessmarkets";
  return null;
}

export function isForexPartnerBrokerId(v: unknown): v is ForexPartnerBrokerId {
  return v === "vantage" || v === "tiomarkets";
}

export type ForexBrokerPlatform = "mt4" | "mt5";

export type UserForexBrokerConnection = {
  broker: ForexBrokerId;
  platform: ForexBrokerPlatform;
  login: string;
  password: string;
  server: string;
  demoMode: boolean;
  metaApiAccountId?: string | null;
};

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY not set. Required for per-user forex broker config.");
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** Load a user's forex broker config (decrypt). Returns null if not set or invalid. */
export async function getForexBrokerConfigForUser(
  userId: string,
  broker: ForexBrokerId
): Promise<UserForexBrokerConnection | null> {
  try {
    const row = await db.userForexBrokerConfig.findUnique({
      where: { userId_broker: { userId, broker } },
    });
    if (!row) return null;
    const login = decrypt(row.encryptedLogin);
    const password = decrypt(row.encryptedPassword);
    if (!login || !password) return null;
    return {
      broker,
      platform: row.platform === "mt4" ? "mt4" : "mt5",
      login,
      password,
      server: row.server,
      demoMode: row.demoMode,
      metaApiAccountId: row.metaApiAccountId ?? null,
    };
  } catch {
    return null;
  }
}

/** All forex broker connections saved by a user (for pickers / "connected brokers" lists). */
export async function listForexBrokerConfigsForUser(
  userId: string
): Promise<UserForexBrokerConnection[]> {
  try {
    const rows = await db.userForexBrokerConfig.findMany({ where: { userId } });
    const out: UserForexBrokerConnection[] = [];
    for (const row of rows) {
      try {
        const broker = parseForexBrokerId(row.broker);
        if (!broker) continue;
        out.push({
          broker,
          platform: row.platform === "mt4" ? "mt4" : "mt5",
          login: decrypt(row.encryptedLogin),
          password: decrypt(row.encryptedPassword),
          server: row.server,
          demoMode: row.demoMode,
          metaApiAccountId: row.metaApiAccountId ?? null,
        });
      } catch {
        /* skip bad row */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Save forex broker config for a user (encrypt). */
export async function saveForexBrokerConfigForUser(
  userId: string,
  config: {
    broker: ForexBrokerId;
    platform: ForexBrokerPlatform;
    login: string;
    password: string;
    server: string;
    demo?: boolean;
    metaApiAccountId?: string | null;
  }
): Promise<void> {
  getEncryptionKey();
  await db.userForexBrokerConfig.upsert({
    where: { userId_broker: { userId, broker: config.broker } },
    create: {
      userId,
      broker: config.broker,
      platform: config.platform,
      encryptedLogin: encrypt(config.login),
      encryptedPassword: encrypt(config.password),
      server: config.server,
      demoMode: config.demo ?? true,
      metaApiAccountId: config.metaApiAccountId ?? null,
    },
    update: {
      platform: config.platform,
      encryptedLogin: encrypt(config.login),
      encryptedPassword: encrypt(config.password),
      server: config.server,
      demoMode: config.demo ?? true,
      ...(config.metaApiAccountId !== undefined ? { metaApiAccountId: config.metaApiAccountId } : {}),
    },
  });
}

export async function updateForexBrokerDemoModeForUser(
  userId: string,
  broker: ForexBrokerId,
  demo: boolean
): Promise<boolean> {
  const row = await db.userForexBrokerConfig.findUnique({
    where: { userId_broker: { userId, broker } },
  });
  if (!row) return false;
  await db.userForexBrokerConfig.update({
    where: { userId_broker: { userId, broker } },
    data: { demoMode: demo },
  });
  return true;
}

export async function updateForexBrokerMetaApiAccountId(
  userId: string,
  broker: ForexBrokerId,
  metaApiAccountId: string | null
): Promise<void> {
  await db.userForexBrokerConfig.update({
    where: { userId_broker: { userId, broker } },
    data: { metaApiAccountId },
  });
}

export async function deleteForexBrokerConfigForUser(userId: string, broker: ForexBrokerId): Promise<void> {
  await db.userForexBrokerConfig.deleteMany({ where: { userId, broker } });
}

export async function hasAnyUserForexBrokerConfig(): Promise<boolean> {
  const count = await db.userForexBrokerConfig.count();
  return count > 0;
}
