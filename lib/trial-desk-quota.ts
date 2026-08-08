/**
 * Daily usage limits for VIP trial users (not full paid VIP).
 * Each desk (AI Agent, NovaForecast, Nova Forex, …) has an independent daily cap.
 */

import { prisma } from "@/lib/db";
import { getVipTrialConfig } from "@/lib/vip-trial";

export const TRIAL_DESKS = [
  { id: "ai_agent", label: "AI Agent (Meme + Chart)" },
  { id: "nova_forecast", label: "NovaForecast Agent" },
  { id: "nova_forex", label: "Nova Forex Agent" },
  { id: "ct", label: "CT Scan" },
  { id: "wallets", label: "Wallet Tracker" },
  { id: "nova_plus", label: "Nova+" },
  { id: "nova_radar", label: "Nova Radar / Smart / Q" },
] as const;

export type TrialDeskId = (typeof TRIAL_DESKS)[number]["id"];

export function isTrialDeskId(v: string): v is TrialDeskId {
  return TRIAL_DESKS.some((d) => d.id === v);
}

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

type UsageDb = {
  trialDeskUsage?: {
    findUnique: (args: unknown) => Promise<{ count: number } | null>;
    upsert: (args: unknown) => Promise<{ count: number }>;
  };
  subscription?: {
    findFirst: (args: unknown) => Promise<{ id: string; isTrial?: boolean } | null>;
  };
};

function usageDb() {
  return (prisma as unknown as UsageDb).trialDeskUsage ?? null;
}

/** Active card trial (isTrial + not expired). Paid VIP after trial is NOT trial. */
export async function userIsOnVipTrial(userId: string): Promise<boolean> {
  try {
    const row = await (prisma as unknown as UsageDb).subscription?.findFirst({
      where: {
        userId,
        isTrial: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "desc" },
    });
    return !!row;
  } catch {
    return false;
  }
}

export async function getTrialDeskUsageToday(
  userId: string,
  desk: TrialDeskId
): Promise<{ used: number; limit: number; remaining: number }> {
  const cfg = await getVipTrialConfig();
  const limit = Math.max(0, Math.min(100, cfg.dailyLimitPerDesk ?? 3));
  const db = usageDb();
  if (!db) return { used: 0, limit, remaining: limit };
  const dayKey = utcDayKey();
  try {
    const row = await db.findUnique({
      where: { userId_desk_dayKey: { userId, desk, dayKey } },
    });
    const used = row?.count ?? 0;
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return { used: 0, limit, remaining: limit };
  }
}

/**
 * Enforce + optionally increment. Call before expensive desk work for trial users.
 * Full paid VIP / owner / non-trial: always ok (no-op).
 */
export async function assertTrialDeskAccess(
  userId: string,
  desk: TrialDeskId,
  opts?: { record?: boolean }
): Promise<
  | { ok: true; onTrial: boolean; used?: number; limit?: number; remaining?: number }
  | { ok: false; error: string; status: number; used: number; limit: number }
> {
  const onTrial = await userIsOnVipTrial(userId);
  if (!onTrial) return { ok: true, onTrial: false };

  const cfg = await getVipTrialConfig();
  const limit = Math.max(0, Math.min(100, cfg.dailyLimitPerDesk ?? 3));
  if (limit === 0) {
    return {
      ok: false,
      status: 429,
      used: 0,
      limit: 0,
      error: "VIP trial desk usage is paused. Upgrade to full VIP for unlimited access.",
    };
  }

  const dayKey = utcDayKey();
  const db = usageDb();
  let used = 0;
  if (db) {
    try {
      const row = await db.findUnique({
        where: { userId_desk_dayKey: { userId, desk, dayKey } },
      });
      used = row?.count ?? 0;
    } catch {
      used = 0;
    }
  }

  if (used >= limit) {
    const deskLabel = TRIAL_DESKS.find((d) => d.id === desk)?.label ?? desk;
    return {
      ok: false,
      status: 429,
      used,
      limit,
      error: `VIP trial daily limit reached for ${deskLabel} (${limit}/day). Resets at 00:00 UTC, or upgrade to full VIP for unlimited use.`,
    };
  }

  if (opts?.record !== false && db) {
    try {
      const updated = await db.upsert({
        where: { userId_desk_dayKey: { userId, desk, dayKey } },
        create: { userId, desk, dayKey, count: 1 },
        update: { count: { increment: 1 } },
      });
      used = updated.count;
    } catch {
      /* best-effort */
    }
  }

  return {
    ok: true,
    onTrial: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
