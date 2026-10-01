import crypto from "crypto";
import { prisma } from "@/lib/db";

/** Max active fingerprint devices per user; oldest are revoked beyond this. */
const MAX_ACTIVE_PER_USER = 5;

type BiometricRow = {
  id: string;
  userId: string;
  secretHash: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

type BiometricCredentialDb = {
  create(args: { data: Record<string, unknown>; select?: Record<string, boolean> }): Promise<Pick<BiometricRow, "id">>;
  findMany<T extends Partial<BiometricRow>>(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
    select?: Record<string, boolean>;
  }): Promise<T[]>;
  findUnique(args: { where: { id: string }; select?: Record<string, boolean> }): Promise<BiometricRow | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
};

function db(): BiometricCredentialDb {
  return (prisma as unknown as { biometricCredential: BiometricCredentialDb }).biometricCredential;
}

function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Device token format: `<credentialId>.<secret>`. Only the hash of the secret is stored. */
export async function createBiometricCredential(
  userId: string,
  deviceLabel: string | null
): Promise<{ credentialId: string; deviceToken: string }> {
  const secret = crypto.randomBytes(32).toString("base64url");
  const row = await db().create({
    data: {
      userId,
      secretHash: hashSecret(secret),
      deviceLabel: deviceLabel?.slice(0, 120) || null,
    },
    select: { id: true },
  });

  const active = await db().findMany<Pick<BiometricRow, "id">>({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const excess = active.slice(MAX_ACTIVE_PER_USER).map((r) => r.id);
  if (excess.length) {
    await db().updateMany({
      where: { id: { in: excess } },
      data: { revokedAt: new Date() },
    });
  }

  return { credentialId: row.id, deviceToken: `${row.id}.${secret}` };
}

/** Returns the userId when the device token is valid and not revoked. */
export async function verifyBiometricDeviceToken(deviceToken: string): Promise<string | null> {
  const dot = deviceToken.indexOf(".");
  if (dot <= 0) return null;
  const credentialId = deviceToken.slice(0, dot);
  const secret = deviceToken.slice(dot + 1);
  if (!secret) return null;

  const row = await db().findUnique({
    where: { id: credentialId },
    select: { userId: true, secretHash: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;

  const expected = Buffer.from(row.secretHash, "hex");
  const actual = Buffer.from(hashSecret(secret), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  await db().update({
    where: { id: credentialId },
    data: { lastUsedAt: new Date() },
  });
  return row.userId;
}

export async function revokeBiometricCredential(userId: string, credentialId: string): Promise<boolean> {
  const res = await db().updateMany({
    where: { id: credentialId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count > 0;
}

export async function revokeAllBiometricCredentials(userId: string): Promise<number> {
  const res = await db().updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return res.count;
}

export async function listActiveBiometricCredentials(userId: string) {
  return db().findMany<Pick<BiometricRow, "id" | "deviceLabel" | "createdAt" | "lastUsedAt">>({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
  });
}
