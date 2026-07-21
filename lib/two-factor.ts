import crypto from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { decryptAtRest, encryptAtRest } from "@/lib/encryption-at-rest";
import { sendEmailDetailed } from "@/lib/send-email";

export type TwoFactorMethod = "totp" | "email";

const OTP_TTL_MS = 10 * 60 * 1000;
const APP_NAME = "NovaStaris";

export async function isTwoFactorGloballyEnabled(): Promise<boolean> {
  return getFeatureFlag(FEATURE_FLAG_KEYS.TWO_FACTOR_AUTH);
}

export function isUserTwoFactorActive(user: { twoFactorMethod?: string | null }): boolean {
  return user.twoFactorMethod === "totp" || user.twoFactorMethod === "email";
}

type User2faRow = {
  id: string;
  email: string | null;
  hashedPassword: string | null;
  twoFactorMethod: string | null;
  totpSecretEncrypted: string | null;
  totpBackupCodesHash: string | null;
};

function userDb() {
  return prisma.user as unknown as {
    findUnique: (args: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) => Promise<User2faRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
}

function otpDb() {
  return (prisma as unknown as {
    twoFactorEmailOtp: {
      deleteMany: (args: { where: { userId: string } }) => Promise<unknown>;
      create: (args: { data: { userId: string; codeHash: string; expiresAt: Date } }) => Promise<unknown>;
      findFirst: (args: {
        where: { userId: string; expiresAt: { gt: Date } };
        orderBy: { createdAt: "desc" };
      }) => Promise<{ codeHash: string } | null>;
      delete: (args: { where: { id: string } }) => Promise<unknown>;
    };
  }).twoFactorEmailOtp;
}

export function generateTotpSecret(): string {
  return generateSecret();
}

export function getTotpAuthUri(email: string, secret: string): string {
  return generateURI({ issuer: APP_NAME, label: email, secret });
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(normalized)) return false;
  const result = verifySync({ secret, token: normalized });
  return result.valid;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

async function hashBackupCodes(codes: string[]): Promise<string> {
  const bcrypt = await import("bcrypt");
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  return JSON.stringify(hashed);
}

async function verifyBackupCode(user: User2faRow, code: string): Promise<boolean> {
  if (!user.totpBackupCodesHash) return false;
  let hashes: string[] = [];
  try {
    hashes = JSON.parse(user.totpBackupCodesHash) as string[];
  } catch {
    return false;
  }
  const normalized = code.replace(/\s/g, "").toUpperCase();
  const bcrypt = await import("bcrypt");
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      hashes.splice(i, 1);
      await userDb().update({
        where: { id: user.id },
        data: { totpBackupCodesHash: hashes.length ? JSON.stringify(hashes) : null },
      });
      return true;
    }
  }
  return false;
}

export async function getTwoFactorStatus(userId: string) {
  const globalEnabled = await isTwoFactorGloballyEnabled();
  const user = await userDb().findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      twoFactorMethod: true,
      totpBackupCodesHash: true,
    },
  });
  if (!user) return null;
  const method = user.twoFactorMethod as TwoFactorMethod | null;
  const userEnabled = isUserTwoFactorActive(user);
  return {
    globalEnabled,
    enabled: globalEnabled && userEnabled,
    method: globalEnabled ? method : null,
    hasBackupCodes: !!user.totpBackupCodesHash,
    email: user.email,
  };
}

export async function beginTotpSetup(userId: string, email: string) {
  if (!(await isTwoFactorGloballyEnabled())) {
    throw new Error("Two-factor authentication is disabled by the site owner.");
  }
  const secret = generateTotpSecret();
  const pendingSecretEncrypted = encryptAtRest(secret);
  await userDb().update({
    where: { id: userId },
    data: { totpSecretEncrypted: pendingSecretEncrypted, twoFactorMethod: null },
  });
  return { secret, uri: getTotpAuthUri(email, secret) };
}

export async function confirmTotpSetup(userId: string, code: string) {
  const user = await userDb().findUnique({
    where: { id: userId },
    select: { id: true, totpSecretEncrypted: true, email: true },
  });
  if (!user?.totpSecretEncrypted) throw new Error("Start authenticator setup first.");
  const secret = decryptAtRest(user.totpSecretEncrypted);
  if (!verifyTotpCode(secret, code)) throw new Error("Invalid code. Try again.");
  const backupCodes = generateBackupCodes();
  const backupHash = await hashBackupCodes(backupCodes);
  await userDb().update({
    where: { id: userId },
    data: { twoFactorMethod: "totp", totpBackupCodesHash: backupHash },
  });
  return { backupCodes };
}

export async function enableEmailTwoFactor(userId: string) {
  if (!(await isTwoFactorGloballyEnabled())) {
    throw new Error("Two-factor authentication is disabled by the site owner.");
  }
  const user = await userDb().findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user?.email) throw new Error("Add an email address to your account first.");
  await userDb().update({
    where: { id: userId },
    data: {
      twoFactorMethod: "email",
      totpSecretEncrypted: null,
      totpBackupCodesHash: null,
    },
  });
}

async function clearTwoFactorForUser(userId: string) {
  await userDb().update({
    where: { id: userId },
    data: { twoFactorMethod: null, totpSecretEncrypted: null, totpBackupCodesHash: null },
  });
  await otpDb().deleteMany({ where: { userId } });
}

export async function disableTwoFactor(userId: string, password: string) {
  const user = await userDb().findUnique({
    where: { id: userId },
    select: { id: true, hashedPassword: true, twoFactorMethod: true },
  });
  if (!user?.hashedPassword) throw new Error("Password required to disable 2FA.");
  const bcrypt = await import("bcrypt");
  const ok = await bcrypt.compare(password, user.hashedPassword);
  if (!ok) throw new Error("Incorrect password.");
  await clearTwoFactorForUser(userId);
}

/** Owner unlock: clear 2FA without the user's password (lost authenticator / email access). */
export async function adminDisableTwoFactor(userId: string): Promise<{ wasEnabled: boolean; method: string | null }> {
  const user = await userDb().findUnique({
    where: { id: userId },
    select: { id: true, twoFactorMethod: true },
  });
  if (!user) throw new Error("User not found.");
  const method = user.twoFactorMethod;
  const wasEnabled = isUserTwoFactorActive(user);
  await clearTwoFactorForUser(userId);
  return { wasEnabled, method };
}

function generateEmailOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export async function sendLoginEmailOtp(userId: string, email: string) {
  if (!(await isTwoFactorGloballyEnabled())) {
    throw new Error("Two-factor authentication is disabled by the site owner.");
  }
  const code = generateEmailOtp();
  const bcrypt = await import("bcrypt");
  const codeHash = await bcrypt.hash(code, 10);
  await otpDb().deleteMany({ where: { userId } });
  await otpDb().create({
    data: { userId, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  const sent = await sendEmailDetailed(
    email,
    "NovaStaris sign-in code",
    `<p>Your NovaStaris sign-in code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. If you did not try to sign in, change your password.</p>`
  );
  if (!sent.ok) throw new Error(sent.error);
}

export async function shouldRequireTwoFactor(user: User2faRow): Promise<boolean> {
  if (!(await isTwoFactorGloballyEnabled())) return false;
  return isUserTwoFactorActive(user);
}

export async function verifyTwoFactorForUser(user: User2faRow, code: string): Promise<boolean> {
  if (!(await isTwoFactorGloballyEnabled())) return true;
  const method = user.twoFactorMethod as TwoFactorMethod | null;
  if (!method) return true;
  const normalized = code.replace(/\s/g, "");
  if (!normalized) return false;

  if (method === "totp") {
    if (!user.totpSecretEncrypted) return false;
    const secret = decryptAtRest(user.totpSecretEncrypted);
    if (verifyTotpCode(secret, normalized)) return true;
    return verifyBackupCode(user, normalized);
  }

  if (method === "email") {
    const row = await otpDb().findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return false;
    const bcrypt = await import("bcrypt");
    const ok = await bcrypt.compare(normalized, row.codeHash);
    if (ok) await otpDb().deleteMany({ where: { userId: user.id } });
    return ok;
  }

  return false;
}

export async function verifyPasswordAndGetUser(email: string, password: string): Promise<User2faRow | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
  }) as User2faRow | null;
  if (!user?.hashedPassword) return null;
  const bcrypt = await import("bcrypt");
  const ok = await bcrypt.compare(password, user.hashedPassword);
  if (!ok) return null;
  return user;
}
