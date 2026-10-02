/**
 * Nova Pro: cheaper tier with VIP-level desks, daily caps, no bots and no Coach Calls.
 * Owner config (on/off, caps, refund threshold, founding seats) lives in NovaProConfig.
 */

import { prisma } from "@/lib/db";
import { NOVA_PRO_TIER, VIP_PLANS } from "@/lib/subscription";

const CONFIG_ID = "default";

type ConfigRow = {
  enabled: boolean;
  sharedDailyLimit: number;
  pulseDailyLimit: number;
  refundMaxRuns: number;
  foundingEnabled: boolean;
  foundingSeats: number;
  updatedAt: Date;
};

type SubRow = {
  id: string;
  userId: string;
  plan: string;
  amountUsd: number;
  expiresAt: Date;
  createdAt: Date;
  txSignature: string | null;
  isTrial: boolean;
  stripeSubscriptionId: string | null;
};

/** Typed view of the models used here (the shared prisma-client.d.ts shim does not list them all). */
type NovaProDb = {
  novaProConfig: {
    findUnique: (args: { where: { id: string } }) => Promise<ConfigRow | null>;
    upsert: (args: { where: { id: string }; create: unknown; update: unknown }) => Promise<unknown>;
  };
  trialDeskUsage: {
    findMany: (args: unknown) => Promise<{ desk: string; count: number }[]>;
    findUnique: (args: unknown) => Promise<{ count: number } | null>;
    upsert: (args: unknown) => Promise<{ count: number }>;
    aggregate: (args: unknown) => Promise<{ _sum: { count: number | null } }>;
  };
  subscription: {
    findFirst: (args: unknown) => Promise<SubRow | null>;
    findMany: (args: unknown) => Promise<SubRow[]>;
    findUnique: (args: unknown) => Promise<SubRow | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

const db = prisma as unknown as NovaProDb;

export type NovaProConfigAdmin = {
  enabled: boolean;
  sharedDailyLimit: number;
  pulseDailyLimit: number;
  refundMaxRuns: number;
  foundingEnabled: boolean;
  foundingSeats: number;
  updatedAt: string | null;
};

export const NOVA_PRO_DEFAULTS: NovaProConfigAdmin = {
  enabled: false,
  sharedDailyLimit: 7,
  pulseDailyLimit: 5,
  refundMaxRuns: 2,
  foundingEnabled: true,
  foundingSeats: 100,
  updatedAt: null,
};

/** Founding status carries over to a new purchase if the previous founding Pro ended within this window. */
const FOUNDING_RENEWAL_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export async function getNovaProConfig(): Promise<NovaProConfigAdmin> {
  try {
    const row = await db.novaProConfig.findUnique({ where: { id: CONFIG_ID } });
    if (!row) return { ...NOVA_PRO_DEFAULTS };
    return {
      enabled: row.enabled,
      sharedDailyLimit: clampInt(row.sharedDailyLimit, 0, 100, NOVA_PRO_DEFAULTS.sharedDailyLimit),
      pulseDailyLimit: clampInt(row.pulseDailyLimit, 0, 100, NOVA_PRO_DEFAULTS.pulseDailyLimit),
      refundMaxRuns: clampInt(row.refundMaxRuns, 0, 100, NOVA_PRO_DEFAULTS.refundMaxRuns),
      foundingEnabled: row.foundingEnabled,
      foundingSeats: clampInt(row.foundingSeats, 0, 100000, NOVA_PRO_DEFAULTS.foundingSeats),
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return { ...NOVA_PRO_DEFAULTS };
  }
}

export async function setNovaProConfig(patch: Partial<Omit<NovaProConfigAdmin, "updatedAt">>): Promise<NovaProConfigAdmin> {
  const cur = await getNovaProConfig();
  const next = {
    enabled: patch.enabled ?? cur.enabled,
    sharedDailyLimit: clampInt(patch.sharedDailyLimit ?? cur.sharedDailyLimit, 0, 100, cur.sharedDailyLimit),
    pulseDailyLimit: clampInt(patch.pulseDailyLimit ?? cur.pulseDailyLimit, 0, 100, cur.pulseDailyLimit),
    refundMaxRuns: clampInt(patch.refundMaxRuns ?? cur.refundMaxRuns, 0, 100, cur.refundMaxRuns),
    foundingEnabled: patch.foundingEnabled ?? cur.foundingEnabled,
    foundingSeats: clampInt(patch.foundingSeats ?? cur.foundingSeats, 0, 100000, cur.foundingSeats),
  };
  await db.novaProConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...next },
    update: next,
  });
  return getNovaProConfig();
}

/* ------------------------------------------------------------------ */
/* Daily usage caps                                                    */
/* ------------------------------------------------------------------ */

export type NovaProUsageKind = "ai" | "pulse";

const BUCKET: Record<NovaProUsageKind, string> = { ai: "pro_ai", pulse: "pro_pulse" };

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function limitFor(cfg: NovaProConfigAdmin, kind: NovaProUsageKind): number {
  return kind === "pulse" ? cfg.pulseDailyLimit : cfg.sharedDailyLimit;
}

export type NovaProUsageSnapshot = {
  ai: { used: number; limit: number; remaining: number };
  pulse: { used: number; limit: number; remaining: number };
};

export async function getNovaProUsageToday(userId: string): Promise<NovaProUsageSnapshot> {
  const cfg = await getNovaProConfig();
  const dayKey = utcDayKey();
  const rows = await db.trialDeskUsage
    .findMany({ where: { userId, dayKey, desk: { in: [BUCKET.ai, BUCKET.pulse] } }, select: { desk: true, count: true } })
    .catch(() => [] as { desk: string; count: number }[]);
  const used = (kind: NovaProUsageKind) => rows.find((r) => r.desk === BUCKET[kind])?.count ?? 0;
  const snap = (kind: NovaProUsageKind) => {
    const limit = limitFor(cfg, kind);
    const u = used(kind);
    return { used: u, limit, remaining: Math.max(0, limit - u) };
  };
  return { ai: snap("ai"), pulse: snap("pulse") };
}

export type NovaProUsageResult =
  | { ok: true; used: number; limit: number; remaining: number }
  | { ok: false; status: number; error: string; used: number; limit: number };

/** Enforce (and by default record) one Nova Pro run. Caller must already know the user is Nova Pro. */
export async function assertNovaProUsage(
  userId: string,
  kind: NovaProUsageKind,
  opts?: { record?: boolean }
): Promise<NovaProUsageResult> {
  const cfg = await getNovaProConfig();
  const limit = limitFor(cfg, kind);
  const label = kind === "pulse" ? "Nova Pulse" : "AI analysis";
  const dayKey = utcDayKey();
  const desk = BUCKET[kind];

  const row = await db.trialDeskUsage
    .findUnique({ where: { userId_desk_dayKey: { userId, desk, dayKey } }, select: { count: true } })
    .catch(() => null);
  let used = row?.count ?? 0;

  if (used >= limit) {
    return {
      ok: false,
      status: 429,
      used,
      limit,
      error: `Nova Pro daily limit reached: ${limit} ${label} run${limit === 1 ? "" : "s"} per day. Resets at 00:00 UTC. VIP is unlimited — upgrade anytime and your unused Pro days count toward VIP.`,
    };
  }

  if (opts?.record !== false) {
    try {
      const updated = await db.trialDeskUsage.upsert({
        where: { userId_desk_dayKey: { userId, desk, dayKey } },
        create: { userId, desk, dayKey, count: 1 },
        update: { count: { increment: 1 } },
      });
      used = updated.count;
    } catch {
      /* best-effort */
    }
  }
  return { ok: true, used, limit, remaining: Math.max(0, limit - used) };
}

/** Total Nova Pro runs (AI + Pulse) recorded on UTC days from `since` through today. */
export async function countNovaProRunsSince(userId: string, since: Date): Promise<number> {
  const agg = await db.trialDeskUsage
    .aggregate({
      where: { userId, desk: { in: [BUCKET.ai, BUCKET.pulse] }, dayKey: { gte: utcDayKey(since) } },
      _sum: { count: true },
    })
    .catch(() => null);
  return agg?._sum.count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Purchases: eligibility, founding seats                              */
/* ------------------------------------------------------------------ */

function isAdminGrant(txSignature: string | null | undefined): boolean {
  return !!txSignature && txSignature.startsWith("admin-grant");
}

/** Null when the user may buy Nova Pro; otherwise a customer-facing reason. */
export async function novaProPurchaseBlockReason(userId: string): Promise<string | null> {
  const cfg = await getNovaProConfig();
  if (!cfg.enabled) return "Nova Pro is not available right now.";
  const vip = await db.subscription.findFirst({
    where: { userId, expiresAt: { gt: new Date() }, tier: { not: NOVA_PRO_TIER } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  if (vip) {
    return `You already have VIP until ${vip.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. VIP includes everything in Nova Pro — you can switch to Pro after VIP ends.`;
  }
  return null;
}

/** New one-time Pro periods stack on top of an active Pro period instead of overlapping it. */
export async function novaProPeriodStart(userId: string): Promise<Date> {
  const latest = await db.subscription.findFirst({
    where: { userId, tier: NOVA_PRO_TIER, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  return latest?.expiresAt ?? new Date();
}

export async function getFoundingSeatsUsed(): Promise<number> {
  const rows = await db.subscription
    .findMany({ where: { tier: NOVA_PRO_TIER, founding: true }, distinct: ["userId"], select: { userId: true } })
    .catch(() => [] as SubRow[]);
  return rows.length;
}

/** Existing founding member (active, or lapsed within the grace window) keeps the seat. */
export async function userHoldsFoundingSeat(userId: string): Promise<boolean> {
  const row = await db.subscription
    .findFirst({
      where: {
        userId,
        tier: NOVA_PRO_TIER,
        founding: true,
        expiresAt: { gt: new Date(Date.now() - FOUNDING_RENEWAL_GRACE_MS) },
      },
      select: { id: true },
    })
    .catch(() => null);
  return !!row;
}

/** Should a new Pro purchase/grant for this user be a founding seat? */
export async function resolveFoundingForNewPro(userId: string, opts?: { forceRequest?: boolean }): Promise<boolean> {
  if (await userHoldsFoundingSeat(userId)) return true;
  const cfg = await getNovaProConfig();
  if (!cfg.foundingEnabled && !opts?.forceRequest) return false;
  const used = await getFoundingSeatsUsed();
  return used < cfg.foundingSeats;
}

export type FoundingPublicState = { enabled: boolean; seats: number; used: number; remaining: number };

export async function getFoundingPublicState(): Promise<FoundingPublicState> {
  const cfg = await getNovaProConfig();
  const used = await getFoundingSeatsUsed();
  return {
    enabled: cfg.foundingEnabled,
    seats: cfg.foundingSeats,
    used,
    remaining: Math.max(0, cfg.foundingSeats - used),
  };
}

/* ------------------------------------------------------------------ */
/* Refund policy: 24h window, at most `refundMaxRuns` runs used        */
/* ------------------------------------------------------------------ */

export type NovaProRefundStatus = {
  eligible: boolean;
  reason: string;
  subscriptionId: string | null;
  windowEndsAt: string | null;
  runsUsed: number;
  maxRuns: number;
};

export async function getNovaProRefundStatus(userId: string): Promise<NovaProRefundStatus> {
  const cfg = await getNovaProConfig();
  const base = { subscriptionId: null, windowEndsAt: null, runsUsed: 0, maxRuns: cfg.refundMaxRuns };
  const sub = await db.subscription.findFirst({
    where: { userId, tier: NOVA_PRO_TIER, amountUsd: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, txSignature: true, isTrial: true },
  });
  if (!sub || isAdminGrant(sub.txSignature) || sub.isTrial) {
    return { ...base, eligible: false, reason: "No paid Nova Pro purchase found." };
  }
  const windowEnds = new Date(sub.createdAt.getTime() + REFUND_WINDOW_MS);
  const runsUsed = await countNovaProRunsSince(userId, sub.createdAt);
  const common = { subscriptionId: sub.id, windowEndsAt: windowEnds.toISOString(), runsUsed, maxRuns: cfg.refundMaxRuns };
  if (Date.now() > windowEnds.getTime()) {
    return { ...common, eligible: false, reason: "The 24-hour refund window has passed." };
  }
  if (runsUsed > cfg.refundMaxRuns) {
    return { ...common, eligible: false, reason: `More than ${cfg.refundMaxRuns} runs were used.` };
  }
  return { ...common, eligible: true, reason: "Eligible for a refund (card processing fee is not refundable)." };
}

/* ------------------------------------------------------------------ */
/* Pro → VIP upgrade credit                                            */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000;
const VIP_MONTHLY_USD = VIP_PLANS.find((p) => p.id === "1month")!.priceUsd;
const VIP_DAILY_USD = VIP_MONTHLY_USD / 30;

export type UpgradeCreditResult = { creditUsd: number; bonusVipDays: number; appliedAs: "days" | "stripe_balance" | "none" };

/**
 * End the user's active paid Nova Pro rows and convert their unused value into VIP:
 * extra days on a one-time VIP row, or a Stripe balance credit on the next auto-renew invoice.
 * Admin-granted / $0 Pro rows carry no credit but are still ended.
 */
export async function applyNovaProUpgradeCredit(input: {
  userId: string;
  vipSubscriptionId: string | null;
  vipAutoRenew: boolean;
  stripeCustomerId?: string | null;
}): Promise<UpgradeCreditResult> {
  const now = new Date();
  const proRows = await db.subscription.findMany({
    where: { userId: input.userId, tier: NOVA_PRO_TIER, expiresAt: { gt: now } },
    select: { id: true, plan: true, amountUsd: true, expiresAt: true, createdAt: true, txSignature: true, stripeSubscriptionId: true },
  });
  if (proRows.length === 0) return { creditUsd: 0, bonusVipDays: 0, appliedAs: "none" };

  let creditUsd = 0;
  for (const row of proRows) {
    if (row.amountUsd > 0 && !isAdminGrant(row.txSignature)) {
      const periodStart = row.createdAt.getTime() > now.getTime() ? now : row.createdAt;
      const totalMs = Math.max(DAY_MS, row.expiresAt.getTime() - periodStart.getTime());
      const remainingMs = Math.max(0, row.expiresAt.getTime() - Math.max(now.getTime(), periodStart.getTime()));
      creditUsd += (row.amountUsd * remainingMs) / totalMs;
    }
    await db.subscription.update({
      where: { id: row.id },
      data: { expiresAt: now, autoRenew: false, cancelAtPeriodEnd: false },
    });
    if (row.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
      try {
        const Stripe = (await import("stripe")).default;
        await new Stripe(process.env.STRIPE_SECRET_KEY).subscriptions.cancel(row.stripeSubscriptionId);
      } catch (e) {
        console.error("Nova Pro upgrade: cancel Pro Stripe subscription failed", e);
      }
    }
  }
  creditUsd = Math.floor(creditUsd * 100) / 100;
  if (creditUsd <= 0) return { creditUsd: 0, bonusVipDays: 0, appliedAs: "none" };

  if (input.vipAutoRenew && input.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const Stripe = (await import("stripe")).default;
      await new Stripe(process.env.STRIPE_SECRET_KEY).customers.createBalanceTransaction(input.stripeCustomerId, {
        amount: -Math.round(creditUsd * 100),
        currency: "usd",
        description: "Unused Nova Pro credit applied to VIP",
      });
      return { creditUsd, bonusVipDays: 0, appliedAs: "stripe_balance" };
    } catch (e) {
      console.error("Nova Pro upgrade: Stripe balance credit failed; falling back to VIP days", e);
    }
  }

  const bonusVipDays = Math.floor(creditUsd / VIP_DAILY_USD);
  if (bonusVipDays > 0 && input.vipSubscriptionId) {
    const vip = await db.subscription.findUnique({ where: { id: input.vipSubscriptionId }, select: { expiresAt: true } });
    if (vip) {
      await db.subscription.update({
        where: { id: input.vipSubscriptionId },
        data: { expiresAt: new Date(vip.expiresAt.getTime() + bonusVipDays * DAY_MS) },
      });
    }
  }
  return { creditUsd, bonusVipDays, appliedAs: bonusVipDays > 0 ? "days" : "none" };
}
