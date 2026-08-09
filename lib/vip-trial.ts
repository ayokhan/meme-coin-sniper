/**
 * Card-required VIP trial — owner-configurable days, Stripe trial_period_days,
 * T-reminder email before first charge, cancel survey.
 */

import { prisma } from "@/lib/db";
import { buildAnnouncementEmailHtml } from "@/lib/announcement-email";
import { sendEmailDetailed } from "@/lib/send-email";
import { VIP_PLANS, type VipPlanId, getActiveSubscriptionDetails } from "@/lib/subscription";
import {
  VIP_CANCEL_SURVEY_REASONS,
  type VipCancelReasonId,
} from "@/lib/vip-trial-constants";

export { VIP_CANCEL_SURVEY_REASONS, type VipCancelReasonId } from "@/lib/vip-trial-constants";

export const VIP_TRIAL_CONFIG_ID = "default";

export type VipTrialConfigAdmin = {
  enabled: boolean;
  /** Login popup for eligible free users (independent of email blasts). */
  showLoginPopup: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planIdAfterTrial: string;
  /** Max uses per desk per UTC day while on trial. */
  dailyLimitPerDesk: number;
  updatedAt: string | null;
};

export type VipTrialPublicOffer = {
  enabled: boolean;
  showLoginPopup: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planIdAfterTrial: string;
  planLabel: string;
  /** List price of plan after trial (before card fee). */
  planPriceUsd: number;
  eligible: boolean;
  ineligibleReason: string | null;
  /** True when user already has active VIP. */
  alreadyVip: boolean;
  updatedAt: string | null;
};

const DEFAULT: VipTrialConfigAdmin = {
  enabled: false,
  showLoginPopup: false,
  trialDays: 2,
  reminderHoursBefore: 24,
  planIdAfterTrial: "1month",
  dailyLimitPerDesk: 3,
  updatedAt: null,
};

type ConfigRow = {
  enabled: boolean;
  showLoginPopup?: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planIdAfterTrial: string;
  dailyLimitPerDesk?: number;
  updatedAt: Date;
};

type PrismaVipTrial = typeof prisma & {
  vipTrialConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<ConfigRow | null>;
    upsert: (args: {
      where: { id: string };
      create: {
        id: string;
        enabled: boolean;
        showLoginPopup: boolean;
        trialDays: number;
        reminderHoursBefore: number;
        planIdAfterTrial: string;
        dailyLimitPerDesk: number;
      };
      update: {
        enabled?: boolean;
        showLoginPopup?: boolean;
        trialDays?: number;
        reminderHoursBefore?: number;
        planIdAfterTrial?: string;
        dailyLimitPerDesk?: number;
      };
    }) => Promise<ConfigRow>;
  };
  vipTrialEmailLog?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        userId: string | null;
        email: string;
        subscriptionId: string | null;
        kind: string;
        success: boolean;
        error: string | null;
        meta: string | null;
        createdAt: Date;
      }>
    >;
  };
  vipCancelSurvey?: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        userId: string;
        subscriptionId: string | null;
        reasons: string;
        comment: string;
        wasTrial: boolean;
        createdAt: Date;
        user?: { email: string | null; name: string | null };
      }>
    >;
  };
  subscription?: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        userId: string;
        plan: string;
        isTrial: boolean;
        trialEndsAt: Date | null;
        expiresAt: Date;
        autoRenew: boolean;
        cancelAtPeriodEnd: boolean;
        trialReminderEmailSentAt: Date | null;
        createdAt: Date;
        stripeSubscriptionId: string | null;
        user?: { email: string | null; name: string | null };
      }>
    >;
    update: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<{ id: string; isTrial?: boolean } | null>;
  };
};

function cfgDb() {
  return (prisma as unknown as PrismaVipTrial).vipTrialConfig ?? null;
}

function emailLogDb() {
  return (prisma as unknown as PrismaVipTrial).vipTrialEmailLog ?? null;
}

function surveyDb() {
  return (prisma as unknown as PrismaVipTrial).vipCancelSurvey ?? null;
}

function clampTrialDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT.trialDays;
  return Math.min(14, Math.max(1, Math.round(n)));
}

function clampReminderHours(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT.reminderHoursBefore;
  return Math.min(72, Math.max(6, Math.round(n)));
}

function normalizePlanId(raw: string): VipPlanId {
  const id = String(raw || "").trim();
  if (VIP_PLANS.some((p) => p.id === id)) return id as VipPlanId;
  return "1month";
}

function clampDailyLimit(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT.dailyLimitPerDesk;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export async function getVipTrialConfig(): Promise<VipTrialConfigAdmin> {
  const db = cfgDb();
  if (!db) return { ...DEFAULT };
  try {
    const row = await db.findUnique({ where: { id: VIP_TRIAL_CONFIG_ID } });
    if (!row) return { ...DEFAULT };
    return {
      enabled: !!row.enabled,
      showLoginPopup: !!row.showLoginPopup,
      trialDays: clampTrialDays(row.trialDays),
      reminderHoursBefore: clampReminderHours(row.reminderHoursBefore),
      planIdAfterTrial: normalizePlanId(row.planIdAfterTrial),
      dailyLimitPerDesk: clampDailyLimit(row.dailyLimitPerDesk ?? DEFAULT.dailyLimitPerDesk),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export async function setVipTrialConfig(patch: {
  enabled?: boolean;
  showLoginPopup?: boolean;
  trialDays?: number;
  reminderHoursBefore?: number;
  planIdAfterTrial?: string;
  dailyLimitPerDesk?: number;
}): Promise<VipTrialConfigAdmin> {
  const db = cfgDb();
  if (!db) throw new Error("VipTrialConfig model unavailable — run prisma migrate.");
  const current = await getVipTrialConfig();
  const next = {
    enabled: patch.enabled ?? current.enabled,
    showLoginPopup: patch.showLoginPopup ?? current.showLoginPopup,
    trialDays: patch.trialDays != null ? clampTrialDays(patch.trialDays) : current.trialDays,
    reminderHoursBefore:
      patch.reminderHoursBefore != null
        ? clampReminderHours(patch.reminderHoursBefore)
        : current.reminderHoursBefore,
    planIdAfterTrial:
      patch.planIdAfterTrial != null ? normalizePlanId(patch.planIdAfterTrial) : current.planIdAfterTrial,
    dailyLimitPerDesk:
      patch.dailyLimitPerDesk != null
        ? clampDailyLimit(patch.dailyLimitPerDesk)
        : current.dailyLimitPerDesk,
  };
  await db.upsert({
    where: { id: VIP_TRIAL_CONFIG_ID },
    create: { id: VIP_TRIAL_CONFIG_ID, ...next },
    update: next,
  });
  return getVipTrialConfig();
}

export async function userHasUsedVipTrial(userId: string): Promise<boolean> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: { vipTrialUsedAt: true } as Record<string, unknown>,
  })) as { vipTrialUsedAt?: Date | null } | null;
  if (user?.vipTrialUsedAt) return true;
  try {
    const prior = await (prisma as unknown as PrismaVipTrial).subscription?.findFirst({
      where: { userId, isTrial: true },
    });
    return !!prior;
  } catch {
    return false;
  }
}

export async function getVipTrialPublicOffer(userId: string | null): Promise<VipTrialPublicOffer> {
  const cfg = await getVipTrialConfig();
  const plan = VIP_PLANS.find((p) => p.id === cfg.planIdAfterTrial) ?? VIP_PLANS[0]!;
  const base: VipTrialPublicOffer = {
    enabled: cfg.enabled,
    showLoginPopup: cfg.showLoginPopup,
    trialDays: cfg.trialDays,
    reminderHoursBefore: cfg.reminderHoursBefore,
    planIdAfterTrial: plan.id,
    planLabel: plan.label,
    planPriceUsd: plan.priceUsd,
    eligible: false,
    ineligibleReason: cfg.enabled ? null : "VIP trial is not available right now.",
    alreadyVip: false,
    updatedAt: cfg.updatedAt,
  };
  if (!cfg.enabled) return base;
  if (!userId) {
    return { ...base, eligible: false, ineligibleReason: "Sign in to start your VIP trial." };
  }
  const active = await getActiveSubscriptionDetails(userId);
  if (active && active.expiresAt > new Date()) {
    return {
      ...base,
      eligible: false,
      alreadyVip: true,
      ineligibleReason: "You already have active VIP.",
    };
  }
  if (await userHasUsedVipTrial(userId)) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: "This account already used its VIP trial.",
    };
  }
  return { ...base, eligible: true, ineligibleReason: null };
}

export function buildVipTrialReminderEmail(input: {
  trialEndsAt: Date;
  trialDays: number;
  planLabel: string;
  planPriceUsd: number;
}): { subject: string; body: string; ctaLabel: string; ctaUrl: string } {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
  const when = input.trialEndsAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return {
    subject: `Reminder: your NovaStaris VIP trial ends soon`,
    body: `Hi there,

Your ${input.trialDays}-day NovaStaris VIP trial ends on ${when} UTC.

If you do nothing, your card will be charged for VIP (${input.planLabel}, $${input.planPriceUsd} + card fee) and billing will renew automatically until you cancel.

Want to stop before you’re charged? Open Account or Subscribe in the app and turn off auto-renew / cancel before the trial ends. You’ll keep VIP until the trial end time, then access pauses — no further charges.

Cancel here:
${app}/subscribe

Need help? Use Chat or Support in the app — this inbox is not monitored.

— The NovaStaris team
${app}`,
    ctaLabel: "Manage VIP / cancel",
    ctaUrl: `${app}/subscribe`,
  };
}

/** Admin Emails preset — blast free users about card-required VIP trial. */
export function buildVipTrialInviteEmail(input: {
  trialDays: number;
  reminderHoursBefore: number;
  planLabel: string;
  planPriceUsd: number;
}): { subject: string; body: string; ctaLabel: string; ctaUrl: string } {
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
  return {
    subject: `Try NovaStaris VIP free for ${input.trialDays} days`,
    body: `Hi there,

VIP desks (NovaForecast, Nova Forex, wallets, and more) are easier to understand when you can try them.

We’re offering a ${input.trialDays}-day VIP trial:

• Card required (so you can cancel anytime)
• Full VIP desks during the trial
• We’ll email you about ${input.reminderHoursBefore} hours before the trial ends
• If you don’t cancel, you’re billed for ${input.planLabel} ($${input.planPriceUsd} + card fee) and VIP renews until you turn it off

Start your trial:
${app}/subscribe?trial=1

Prefer to explore first? Open Start here:
${app}/start-here

Need help? Use Chat or Support in the app — this inbox is not monitored.

— The NovaStaris team
${app}`,
    ctaLabel: `Start ${input.trialDays}-day VIP trial`,
    ctaUrl: `${app}/subscribe?trial=1`,
  };
}

/** Soft template for Admin → Emails (manual send / test) — trial ending reminder. */
export const VIP_TRIAL_REMINDER_EMAIL_PRESET = {
  subject: "Reminder: your NovaStaris VIP trial ends soon",
  body: `Hi there,

Your NovaStaris VIP trial ends soon (check Account / Subscribe for your exact time).

If you do nothing, your card will be charged and VIP will renew automatically until you cancel.

Want to stop before you’re charged? Open Subscribe and turn off auto-renew / cancel before the trial ends. You’ll keep VIP until the trial end time, then access pauses — no further charges.

Cancel / manage:
https://novastaris.ai/subscribe

Need help? Use Chat or Support in the app — this inbox is not monitored.

— The NovaStaris team
https://novastaris.ai`,
  ctaLabel: "Manage VIP / cancel",
  ctaUrl: "https://novastaris.ai/subscribe",
} as const;

export async function logVipTrialEmail(input: {
  userId?: string | null;
  email: string;
  subscriptionId?: string | null;
  kind: string;
  success: boolean;
  error?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = emailLogDb();
  if (!db) return;
  try {
    await db.create({
      data: {
        userId: input.userId ?? null,
        email: input.email,
        subscriptionId: input.subscriptionId ?? null,
        kind: input.kind,
        success: input.success,
        error: input.error ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (e) {
    console.warn("vip trial email log failed", e);
  }
}

/** Daily cron: remind users ~reminderHoursBefore trial end (wide window for once-daily cron). */
export async function runVipTrialReminderEmails(): Promise<{
  scanned: number;
  sent: number;
  failed: number;
}> {
  const cfg = await getVipTrialConfig();
  const hours = cfg.reminderHoursBefore;
  const now = Date.now();
  // Window: between (hours - 12) and (hours + 12) from now — covers daily cron.
  const maxMs = (hours + 12) * 60 * 60 * 1000;
  const minMs = Math.max(4, hours - 12) * 60 * 60 * 1000;
  const soonest = new Date(now + minMs);
  const latest = new Date(now + maxMs);

  const subDb = (prisma as unknown as PrismaVipTrial).subscription;
  if (!subDb) return { scanned: 0, sent: 0, failed: 0 };

  const rows = await subDb.findMany({
    where: {
      isTrial: true,
      cancelAtPeriodEnd: false,
      autoRenew: true,
      trialReminderEmailSentAt: null,
      trialEndsAt: { gte: soonest, lte: latest },
    },
    include: { user: { select: { email: true, name: true } } },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  const plan = VIP_PLANS.find((p) => p.id === cfg.planIdAfterTrial) ?? VIP_PLANS[0]!;

  for (const row of rows) {
    const email = row.user?.email?.trim();
    if (!email || !row.trialEndsAt) continue;
    const content = buildVipTrialReminderEmail({
      trialEndsAt: row.trialEndsAt,
      trialDays: cfg.trialDays,
      planLabel: plan.label,
      planPriceUsd: plan.priceUsd,
    });
    try {
      const html = buildAnnouncementEmailHtml({
        body: content.body,
        ctaLabel: content.ctaLabel,
        ctaUrl: content.ctaUrl,
      });
      const result = await sendEmailDetailed(email, content.subject, html);
      if (result.ok) {
        sent += 1;
        await subDb.update({
          where: { id: row.id },
          data: { trialReminderEmailSentAt: new Date() },
        });
        await logVipTrialEmail({
          userId: row.userId,
          email,
          subscriptionId: row.id,
          kind: "trial_reminder",
          success: true,
          meta: {
            trialEndsAt: row.trialEndsAt.toISOString(),
            reminderHoursBefore: hours,
            trialDays: cfg.trialDays,
          },
        });
      } else {
        failed += 1;
        await logVipTrialEmail({
          userId: row.userId,
          email,
          subscriptionId: row.id,
          kind: "trial_reminder",
          success: false,
          error: result.error ?? "send failed",
        });
        const { logSystemError } = await import("@/lib/system-error-log");
        await logSystemError({
          source: "cron_vip_trial_emails",
          message: `Trial reminder failed for ${email}`,
          detail: result.error ?? "send failed",
          meta: { subscriptionId: row.id, userId: row.userId },
        });
      }
    } catch (e) {
      failed += 1;
      await logVipTrialEmail({
        userId: row.userId,
        email,
        subscriptionId: row.id,
        kind: "trial_reminder",
        success: false,
        error: e instanceof Error ? e.message : "send failed",
      });
      const { logSystemError } = await import("@/lib/system-error-log");
      await logSystemError({
        source: "cron_vip_trial_emails",
        message: `Trial reminder exception for ${email}`,
        detail: e instanceof Error ? e.message : "send failed",
      });
    }
  }

  return { scanned: rows.length, sent, failed };
}

export async function saveVipCancelSurvey(input: {
  userId: string;
  subscriptionId?: string | null;
  reasons: string[];
  comment?: string;
  wasTrial: boolean;
}): Promise<void> {
  const db = surveyDb();
  if (!db) return;
  const allowed = new Set(VIP_CANCEL_SURVEY_REASONS.map((r) => r.id));
  const reasons = input.reasons.filter((r) => allowed.has(r as VipCancelReasonId)).slice(0, 6);
  await db.create({
    data: {
      userId: input.userId,
      subscriptionId: input.subscriptionId ?? null,
      reasons: JSON.stringify(reasons),
      comment: (input.comment ?? "").trim().slice(0, 2000),
      wasTrial: input.wasTrial,
    },
  });
}

export async function listVipTrialSignups(limit = 50) {
  const subDb = (prisma as unknown as PrismaVipTrial).subscription;
  if (!subDb) return [];
  try {
    return await subDb.findMany({
      where: { isTrial: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    });
  } catch {
    return [];
  }
}

export async function listVipTrialEmailLogs(limit = 50) {
  const db = emailLogDb();
  if (!db) return [];
  try {
    return await db.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function listVipCancelSurveys(limit = 50) {
  const db = surveyDb();
  if (!db) return [];
  try {
    return await db.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { email: true, name: true } } },
    });
  } catch {
    return [];
  }
}
