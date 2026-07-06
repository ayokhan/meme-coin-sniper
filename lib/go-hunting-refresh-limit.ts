import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { isOwnerEmail } from "@/lib/auth";

export type GoHuntingRefreshConfig = {
  guestIntervalMinutes: number;
  freeMemberIntervalMinutes: number;
  guestAutoRefreshEnabled: boolean;
  freeAutoRefreshEnabled: boolean;
  freeAutoRefreshMinutes: number;
};

const DEFAULT_CONFIG: GoHuntingRefreshConfig = {
  guestIntervalMinutes: 60,
  freeMemberIntervalMinutes: 60,
  guestAutoRefreshEnabled: false,
  freeAutoRefreshEnabled: false,
  freeAutoRefreshMinutes: 60,
};

type ConfigRow = GoHuntingRefreshConfig & { updatedAt?: Date };

type CooldownDb = {
  goHuntingRefreshConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<ConfigRow | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string } & GoHuntingRefreshConfig;
      update: GoHuntingRefreshConfig;
    }) => Promise<unknown>;
  };
  goHuntingRefreshCooldown?: {
    findUnique: (args: { where: { subjectKey: string } }) => Promise<{ lastRefreshAt: Date } | null>;
    upsert: (args: {
      where: { subjectKey: string };
      create: { subjectKey: string; lastRefreshAt: Date };
      update: { lastRefreshAt: Date };
    }) => Promise<unknown>;
  };
};

function db(): CooldownDb {
  return prisma as unknown as CooldownDb;
}

function clampMinutes(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(24 * 60, Math.round(n)));
}

function rowToConfig(row: ConfigRow | null): GoHuntingRefreshConfig {
  if (!row) return DEFAULT_CONFIG;
  return {
    guestIntervalMinutes: clampMinutes(row.guestIntervalMinutes, DEFAULT_CONFIG.guestIntervalMinutes),
    freeMemberIntervalMinutes: clampMinutes(row.freeMemberIntervalMinutes, DEFAULT_CONFIG.freeMemberIntervalMinutes),
    guestAutoRefreshEnabled: !!row.guestAutoRefreshEnabled,
    freeAutoRefreshEnabled: !!row.freeAutoRefreshEnabled,
    freeAutoRefreshMinutes: clampMinutes(row.freeAutoRefreshMinutes, DEFAULT_CONFIG.freeAutoRefreshMinutes) || 60,
  };
}

export async function getGoHuntingRefreshConfig(): Promise<GoHuntingRefreshConfig> {
  try {
    const row = await db().goHuntingRefreshConfig?.findUnique({ where: { id: "default" } });
    return rowToConfig(row ?? null);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setGoHuntingRefreshConfig(input: Partial<GoHuntingRefreshConfig>): Promise<GoHuntingRefreshConfig> {
  const current = await getGoHuntingRefreshConfig();
  const next: GoHuntingRefreshConfig = {
    guestIntervalMinutes:
      input.guestIntervalMinutes !== undefined
        ? clampMinutes(input.guestIntervalMinutes, current.guestIntervalMinutes)
        : current.guestIntervalMinutes,
    freeMemberIntervalMinutes:
      input.freeMemberIntervalMinutes !== undefined
        ? clampMinutes(input.freeMemberIntervalMinutes, current.freeMemberIntervalMinutes)
        : current.freeMemberIntervalMinutes,
    guestAutoRefreshEnabled: input.guestAutoRefreshEnabled ?? current.guestAutoRefreshEnabled,
    freeAutoRefreshEnabled: input.freeAutoRefreshEnabled ?? current.freeAutoRefreshEnabled,
    freeAutoRefreshMinutes:
      input.freeAutoRefreshMinutes !== undefined
        ? clampMinutes(input.freeAutoRefreshMinutes, current.freeAutoRefreshMinutes) || 60
        : current.freeAutoRefreshMinutes,
  };
  const configDb = db().goHuntingRefreshConfig;
  if (!configDb) return next;
  await configDb.upsert({
    where: { id: "default" },
    create: { id: "default", ...next },
    update: next,
  });
  return next;
}

function guestSubjectKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const hash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return `guest:${hash}`;
}

export function formatRefreshWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (rm === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h}h ${rm}m`;
}

export type GoHuntingRefreshCheck =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; intervalMinutes: number }
  | { allowed: false; retryAfterSeconds: number; message: string; limitReached: true };

export async function isUnlimitedRefreshUser(): Promise<boolean> {
  const { session, isPaid, tier } = await getSessionAndSubscription();
  if (session?.user?.email && isOwnerEmail(session.user.email)) return true;
  if (isPaid || tier === "vip" || tier === "pro") return true;
  return false;
}

/** Enforce cooldown for guest + free members on Go Hunting fetch/scan. VIP/owner skip. */
export async function checkGoHuntingRefreshLimit(req: Request): Promise<GoHuntingRefreshCheck> {
  const { session, userId, isPaid, tier } = await getSessionAndSubscription();
  if (session?.user?.email && isOwnerEmail(session.user.email)) {
    return { allowed: true, unlimited: true };
  }
  if (isPaid || tier === "vip" || tier === "pro") {
    return { allowed: true, unlimited: true };
  }

  const config = await getGoHuntingRefreshConfig();
  const intervalMinutes = userId ? config.freeMemberIntervalMinutes : config.guestIntervalMinutes;
  if (intervalMinutes <= 0) {
    return { allowed: true, unlimited: false, intervalMinutes: 0 };
  }

  const subjectKey = userId ? `user:${userId}` : guestSubjectKey(req);
  const cooldownDb = db().goHuntingRefreshCooldown;
  const existing = cooldownDb ? await cooldownDb.findUnique({ where: { subjectKey } }) : null;
  const now = Date.now();
  if (existing?.lastRefreshAt) {
    const elapsedMs = now - existing.lastRefreshAt.getTime();
    const requiredMs = intervalMinutes * 60 * 1000;
    if (elapsedMs < requiredMs) {
      const retryAfterSeconds = Math.ceil((requiredMs - elapsedMs) / 1000);
      const wait = formatRefreshWait(retryAfterSeconds);
      const message = userId
        ? `Free accounts can refresh Go Hunting once every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}. Try again in ${wait}, or upgrade to VIP for unlimited refresh.`
        : `Guests can refresh Go Hunting once every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}. Try again in ${wait}, or sign up free / upgrade to VIP for more access.`;
      return { allowed: false, retryAfterSeconds, message, limitReached: true };
    }
  }

  if (cooldownDb) {
    const at = new Date();
    await cooldownDb.upsert({
      where: { subjectKey },
      create: { subjectKey, lastRefreshAt: at },
      update: { lastRefreshAt: at },
    });
  }

  return { allowed: true, unlimited: false, intervalMinutes };
}
