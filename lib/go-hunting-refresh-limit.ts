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
  /** Max VIP Go Hunting refreshes per UTC day. 0 = unlimited. */
  vipDailyLimit: number;
  vipAutoRefreshEnabled: boolean;
  vipAutoRefreshMinutes: number;
};

const DEFAULT_CONFIG: GoHuntingRefreshConfig = {
  guestIntervalMinutes: 60,
  freeMemberIntervalMinutes: 60,
  guestAutoRefreshEnabled: false,
  freeAutoRefreshEnabled: false,
  freeAutoRefreshMinutes: 60,
  vipDailyLimit: 10,
  vipAutoRefreshEnabled: false,
  vipAutoRefreshMinutes: 5,
};

type ConfigRow = GoHuntingRefreshConfig & { updatedAt?: Date };

type CooldownRow = { lastRefreshAt: Date; refreshCount?: number };

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
    findUnique: (args: { where: { subjectKey: string } }) => Promise<CooldownRow | null>;
    upsert: (args: {
      where: { subjectKey: string };
      create: { subjectKey: string; lastRefreshAt: Date; refreshCount?: number };
      update: { lastRefreshAt: Date; refreshCount?: number };
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

function clampDailyLimit(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(10_000, Math.round(n)));
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function rowToConfig(row: ConfigRow | null): GoHuntingRefreshConfig {
  if (!row) return DEFAULT_CONFIG;
  return {
    guestIntervalMinutes: clampMinutes(row.guestIntervalMinutes, DEFAULT_CONFIG.guestIntervalMinutes),
    freeMemberIntervalMinutes: clampMinutes(row.freeMemberIntervalMinutes, DEFAULT_CONFIG.freeMemberIntervalMinutes),
    guestAutoRefreshEnabled: !!row.guestAutoRefreshEnabled,
    freeAutoRefreshEnabled: !!row.freeAutoRefreshEnabled,
    freeAutoRefreshMinutes: clampMinutes(row.freeAutoRefreshMinutes, DEFAULT_CONFIG.freeAutoRefreshMinutes) || 60,
    vipDailyLimit: clampDailyLimit(
      row.vipDailyLimit ?? DEFAULT_CONFIG.vipDailyLimit,
      DEFAULT_CONFIG.vipDailyLimit
    ),
    vipAutoRefreshEnabled: row.vipAutoRefreshEnabled ?? DEFAULT_CONFIG.vipAutoRefreshEnabled,
    vipAutoRefreshMinutes:
      clampMinutes(row.vipAutoRefreshMinutes ?? DEFAULT_CONFIG.vipAutoRefreshMinutes, DEFAULT_CONFIG.vipAutoRefreshMinutes) ||
      5,
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
    vipDailyLimit:
      input.vipDailyLimit !== undefined
        ? clampDailyLimit(input.vipDailyLimit, current.vipDailyLimit)
        : current.vipDailyLimit,
    vipAutoRefreshEnabled: input.vipAutoRefreshEnabled ?? current.vipAutoRefreshEnabled,
    vipAutoRefreshMinutes:
      input.vipAutoRefreshMinutes !== undefined
        ? clampMinutes(input.vipAutoRefreshMinutes, current.vipAutoRefreshMinutes) || 5
        : current.vipAutoRefreshMinutes,
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
  | { allowed: true; unlimited: false; intervalMinutes: number; remainingToday?: number; dailyLimit?: number }
  | {
      allowed: false;
      retryAfterSeconds: number;
      message: string;
      limitReached: true;
      remainingToday?: number;
      dailyLimit?: number;
    };

export async function isUnlimitedRefreshUser(): Promise<boolean> {
  const { session } = await getSessionAndSubscription();
  if (session?.user?.email && isOwnerEmail(session.user.email)) return true;
  return false;
}

async function checkVipDailyLimit(userId: string, dailyLimit: number): Promise<GoHuntingRefreshCheck> {
  if (dailyLimit <= 0) {
    return { allowed: true, unlimited: true };
  }

  const day = utcDayKey();
  const subjectKey = `vip:${userId}:${day}`;
  const cooldownDb = db().goHuntingRefreshCooldown;
  const existing = cooldownDb ? await cooldownDb.findUnique({ where: { subjectKey } }) : null;
  const used = existing?.refreshCount ?? 0;

  if (used >= dailyLimit) {
    const now = new Date();
    const tomorrowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const retryAfterSeconds = Math.max(1, Math.ceil((tomorrowUtc - now.getTime()) / 1000));
    return {
      allowed: false,
      retryAfterSeconds,
      message: `Daily market refresh limit reached (${dailyLimit}/day for Go Hunting, Trending, and Surge). Try again after midnight UTC, or ask support if you need a higher limit.`,
      limitReached: true,
      remainingToday: 0,
      dailyLimit,
    };
  }

  if (cooldownDb) {
    const at = new Date();
    await cooldownDb.upsert({
      where: { subjectKey },
      create: { subjectKey, lastRefreshAt: at, refreshCount: 1 },
      update: { lastRefreshAt: at, refreshCount: used + 1 },
    });
  }

  return {
    allowed: true,
    unlimited: false,
    intervalMinutes: 0,
    remainingToday: Math.max(0, dailyLimit - used - 1),
    dailyLimit,
  };
}

/** Enforce cooldown / daily caps for Go Hunting fetch/scan. Owner skips. */
export async function checkGoHuntingRefreshLimit(req: Request): Promise<GoHuntingRefreshCheck> {
  const { session, userId, isPaid, tier } = await getSessionAndSubscription();
  if (session?.user?.email && isOwnerEmail(session.user.email)) {
    return { allowed: true, unlimited: true };
  }

  const config = await getGoHuntingRefreshConfig();
  const isVip = !!(isPaid || tier === "vip" || tier === "pro");

  if (isVip && userId) {
    return checkVipDailyLimit(userId, config.vipDailyLimit);
  }

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
        ? `Free accounts can refresh market data (Go Hunting, Trending, Surge) once every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}. Try again in ${wait}, or upgrade to VIP for a higher daily allowance.`
        : `Guests can refresh market data (Go Hunting, Trending, Surge) once every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}. Try again in ${wait}, or sign up free / upgrade to VIP for more access.`;
      return { allowed: false, retryAfterSeconds, message, limitReached: true };
    }
  }

  if (cooldownDb) {
    const at = new Date();
    await cooldownDb.upsert({
      where: { subjectKey },
      create: { subjectKey, lastRefreshAt: at, refreshCount: 1 },
      update: { lastRefreshAt: at },
    });
  }

  return { allowed: true, unlimited: false, intervalMinutes };
}
