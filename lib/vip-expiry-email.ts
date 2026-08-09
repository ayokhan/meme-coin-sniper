/**
 * One pre-expiry + one post-expiry VIP email (noreply — point users to Chat/Support).
 * Intended to run from daily cron; idempotent via Subscription.expiry*EmailSentAt.
 * Only Stripe (CC) or USDC-paid subscriptions — not admin/manual grants.
 */

import { prisma } from "@/lib/db";
import { buildAnnouncementEmailHtml } from "@/lib/announcement-email";
import { sendEmailDetailed } from "@/lib/send-email";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const SUBSCRIBE_URL = `${APP}/subscribe`;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) + " UTC";
}

/** Admin → Emails preset (no per-user date — soft wording). */
export const VIP_EXPIRY_PRE_EMAIL = {
  subject: "Your NovaStaris VIP ends soon",
  body: `Hi there,

Your VIP access is ending soon — check Account / Billing for your exact date.

After that date, VIP desks (NovaForecast, Nova Forex, and related tools) will pause until you renew.

Renew anytime:
${SUBSCRIBE_URL}

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Renew VIP",
  ctaUrl: SUBSCRIBE_URL,
} as const;

/** Admin → Emails preset (win-back after VIP ends). */
export const VIP_EXPIRY_POST_EMAIL = {
  subject: "Your NovaStaris VIP has ended",
  body: `Hi there,

Your VIP period has ended. Free tools still work; VIP desks stay paused until you renew.

Renew anytime:
${SUBSCRIBE_URL}

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  ctaLabel: "Renew VIP",
  ctaUrl: SUBSCRIBE_URL,
} as const;

export function buildVipExpiryPreEmail(expiresAt: Date): { subject: string; body: string } {
  const when = formatDate(expiresAt);
  return {
    subject: "Your NovaStaris VIP ends soon",
    body: `Hi there,

Your VIP access is scheduled to end on ${when}.

After that date, VIP desks (NovaForecast, Nova Forex, and related tools) will pause until you renew.

Renew anytime:
${SUBSCRIBE_URL}

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  };
}

export function buildVipExpiryPostEmail(expiredAt: Date): { subject: string; body: string } {
  const when = formatDate(expiredAt);
  return {
    subject: "Your NovaStaris VIP has ended",
    body: `Hi there,

Your VIP period ended on ${when}. Free tools still work; VIP desks stay paused until you renew.

Renew anytime:
${SUBSCRIBE_URL}

Need help? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.

— The NovaStaris team
${APP}`,
  };
}

type SubRow = {
  id: string;
  userId: string;
  expiresAt: Date;
  autoRenew: boolean | null;
  cancelAtPeriodEnd: boolean | null;
  txSignature: string | null;
  stripeSessionId: string | null;
  stripeSubscriptionId: string | null;
  expiryPreEmailSentAt: Date | null;
  expiryPostEmailSentAt: Date | null;
  user: { email: string | null } | null;
};

/**
 * Paid VIP only: Stripe card (session or subscription id) or USDC (txSignature
 * that is not an admin-grant-* tag). Complimentary owner grants are excluded.
 */
export function isPaidCustomerSubscription(sub: {
  txSignature?: string | null;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  if (sub.stripeSessionId || sub.stripeSubscriptionId) return true;
  const tx = (sub.txSignature ?? "").trim();
  if (!tx) return false;
  if (tx.startsWith("admin-grant-")) return false;
  return true;
}

function shouldSkipAutoRenew(sub: SubRow): boolean {
  // Active auto-renew without period-end cancel — Stripe will renew; skip soft emails.
  return !!(sub.autoRenew && !sub.cancelAtPeriodEnd);
}

async function sendBranded(to: string, subject: string, body: string): Promise<boolean> {
  const html = buildAnnouncementEmailHtml({
    body,
    template: "nova-branded",
    format: "rich",
    ctaLabel: "Renew VIP",
    ctaUrl: SUBSCRIBE_URL,
  });
  const result = await sendEmailDetailed(to, subject, html);
  return result.ok;
}

export type VipExpiryEmailRunResult = {
  ok: boolean;
  preSent: number;
  postSent: number;
  preFailed: number;
  postFailed: number;
  skipped?: boolean;
  message?: string;
};

/**
 * Daily pass:
 * - PRE: expiry in ~3 days (2–4 day window for once-daily cron), not yet sent
 * - POST: expired within last ~36h, not yet sent, no other active VIP
 * Paid CC/USDC only; feature-flag gated.
 */
export async function runVipExpiryEmails(): Promise<VipExpiryEmailRunResult> {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.VIP_EXPIRY_EMAILS);
  if (!enabled) {
    return {
      ok: true,
      skipped: true,
      preSent: 0,
      postSent: 0,
      preFailed: 0,
      postFailed: 0,
      message: "VIP expiry emails flag OFF (Admin → Feature flags).",
    };
  }

  const now = Date.now();
  const preFrom = new Date(now + 2 * DAY_MS);
  const preTo = new Date(now + 4 * DAY_MS);
  const postFrom = new Date(now - 1.5 * DAY_MS);
  const postTo = new Date(now);

  let preSent = 0;
  let postSent = 0;
  let preFailed = 0;
  let postFailed = 0;

  const db = prisma as unknown as {
    subscription: {
      findMany: (args: unknown) => Promise<SubRow[]>;
      update: (args: unknown) => Promise<unknown>;
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
    };
  };

  const selectFields = {
    id: true,
    userId: true,
    expiresAt: true,
    autoRenew: true,
    cancelAtPeriodEnd: true,
    txSignature: true,
    stripeSessionId: true,
    stripeSubscriptionId: true,
    expiryPreEmailSentAt: true,
    expiryPostEmailSentAt: true,
    user: { select: { email: true } },
  };

  try {
    const preCandidates = await db.subscription.findMany({
      where: {
        expiresAt: { gte: preFrom, lte: preTo },
        expiryPreEmailSentAt: null,
      },
      select: selectFields,
      take: 100,
    });

    for (const sub of preCandidates) {
      if (!isPaidCustomerSubscription(sub) || shouldSkipAutoRenew(sub)) {
        // Suppress without email (admin grant or clean auto-renew)
        await db.subscription.update({
          where: { id: sub.id },
          data: { expiryPreEmailSentAt: new Date() },
        });
        continue;
      }
      const email = (sub.user?.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const copy = buildVipExpiryPreEmail(sub.expiresAt instanceof Date ? sub.expiresAt : new Date(sub.expiresAt));
      const ok = await sendBranded(email, copy.subject, copy.body);
      if (ok) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { expiryPreEmailSentAt: new Date() },
        });
        preSent += 1;
      } else {
        preFailed += 1;
        const { logSystemError } = await import("@/lib/system-error-log");
        await logSystemError({
          source: "cron_vip_expiry_emails",
          message: `VIP expiry pre-email failed`,
          detail: email,
          meta: { subscriptionId: sub.id, kind: "pre" },
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    const postCandidates = await db.subscription.findMany({
      where: {
        expiresAt: { gte: postFrom, lte: postTo },
        expiryPostEmailSentAt: null,
      },
      select: selectFields,
      take: 100,
    });

    for (const sub of postCandidates) {
      if (!isPaidCustomerSubscription(sub) || shouldSkipAutoRenew(sub)) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { expiryPostEmailSentAt: new Date() },
        });
        continue;
      }
      const stillVip = await db.subscription.findFirst({
        where: { userId: sub.userId, expiresAt: { gt: new Date() } },
        select: { id: true },
      });
      if (stillVip) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { expiryPostEmailSentAt: new Date() },
        });
        continue;
      }
      const email = (sub.user?.email ?? "").trim().toLowerCase();
      if (!email) continue;
      const expiresAt = sub.expiresAt instanceof Date ? sub.expiresAt : new Date(sub.expiresAt);
      const copy = buildVipExpiryPostEmail(expiresAt);
      const ok = await sendBranded(email, copy.subject, copy.body);
      if (ok) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { expiryPostEmailSentAt: new Date() },
        });
        postSent += 1;
      } else {
        postFailed += 1;
        const { logSystemError } = await import("@/lib/system-error-log");
        await logSystemError({
          source: "cron_vip_expiry_emails",
          message: `VIP expiry post-email failed`,
          detail: email,
          meta: { subscriptionId: sub.id, kind: "post" },
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    return {
      ok: true,
      preSent,
      postSent,
      preFailed,
      postFailed,
      message: `pre ${preSent} sent (${preFailed} failed), post ${postSent} sent (${postFailed} failed)`,
    };
  } catch (e) {
    console.error("runVipExpiryEmails:", e);
    const message = e instanceof Error ? e.message : "VIP expiry emails failed";
    try {
      const { logSystemError } = await import("@/lib/system-error-log");
      await logSystemError({
        source: "cron.vip-expiry-emails",
        message,
        detail: e instanceof Error ? e.stack : undefined,
      });
    } catch {
      /* ignore logging failure */
    }
    return {
      ok: false,
      preSent,
      postSent,
      preFailed,
      postFailed,
      message,
    };
  }
}
