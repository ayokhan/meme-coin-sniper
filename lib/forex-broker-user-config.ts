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

export type ForexBrokerId = "vantage" | "tiomarkets";

export const FOREX_BROKER_IDS: ForexBrokerId[] = ["vantage", "tiomarkets"];

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
        out.push({
          broker: row.broker,
          platform: row.platform === "mt4" ? "mt4" : "mt5",
          login: decrypt(row.encryptedLogin),
          password: decrypt(row.encryptedPassword),
          server: row.server,
          demoMode: row.demoMode,
          metaApiAccountId: row.metaApiAccountId ?? null,
        });
      } catch {
        /* skip corrupt row */
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Save (create or replace) a user's forex broker config. */
export async function saveForexBrokerConfigForUser(
  userId: string,
  broker: ForexBrokerId,
  config: {
    platform: ForexBrokerPlatform;
    login: string;
    password: string;
    server: string;
    demoMode?: boolean;
    metaApiAccountId?: string | null;
  }
): Promise<void> {
  getEncryptionKey(); // throws if not set
  const data = {
    platform: config.platform,
    encryptedLogin: encrypt(config.login),
    encryptedPassword: encrypt(config.password),
    server: config.server,
    demoMode: config.demoMode ?? true,
    metaApiAccountId: config.metaApiAccountId ?? null,
  };
  await db.userForexBrokerConfig.upsert({
    where: { userId_broker: { userId, broker } },
    create: { userId, broker, ...data },
    update: data,
  });
}

/** Update demo/live mode without re-entering credentials. */
export async function updateForexBrokerDemoModeForUser(
  userId: string,
  broker: ForexBrokerId,
  demo: boolean
): Promise<boolean> {
  const row = await db.userForexBrokerConfig.findUnique({ where: { userId_broker: { userId, broker } } });
  if (!row) return false;
  await db.userForexBrokerConfig.update({
    where: { userId_broker: { userId, broker } },
    data: { demoMode: demo },
  });
  return true;
}

/** Persist the MetaAPI cloud account id once provisioned for this broker connection. */
export async function updateForexBrokerMetaApiAccountId(
  userId: string,
  broker: ForexBrokerId,
  metaApiAccountId: string | null
): Promise<boolean> {
  const row = await db.userForexBrokerConfig.findUnique({ where: { userId_broker: { userId, broker } } });
  if (!row) return false;
  await db.userForexBrokerConfig.update({
    where: { userId_broker: { userId, broker } },
    data: { metaApiAccountId },
  });
  return true;
}

/** Remove a saved forex broker config for a user. */
export async function deleteForexBrokerConfigForUser(
  userId: string,
  broker: ForexBrokerId
): Promise<void> {
  await db.userForexBrokerConfig.deleteMany({ where: { userId, broker } });
}

/** Check if any user has saved forex broker config (for feature hints / admin). */
export async function hasAnyUserForexBrokerConfig(): Promise<boolean> {
  try {
    const count = await db.userForexBrokerConfig.count();
    return count > 0;
  } catch {
    return false;
  }
}
