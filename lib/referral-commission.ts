import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  REFERRAL_COMMISSION_RATE_PCT,
  REFERRAL_COMMISSION_STATUS,
  commissionAmountFromSubscription,
  normalizeReferralCode,
} from "@/lib/referral-program";

const CODE_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateReferralCodeCandidate(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return out;
}

export async function ensureUserReferralCode(userId: string): Promise<string> {
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  })) as { referralCode?: string | null } | null;

  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateReferralCodeCandidate(6);
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code } as Record<string, unknown>,
      });
      return code;
    } catch {
      /* unique collision — retry */
    }
  }

  const fallback = generateReferralCodeCandidate(10);
  await prisma.user.update({
    where: { id: userId },
    data: { referralCode: fallback } as Record<string, unknown>,
  });
  return fallback;
}

export async function findReferrerByCode(code: string | null | undefined): Promise<{ id: string } | null> {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  const referrer = (await prisma.user.findFirst({
    where: { referralCode: normalized },
    select: { id: true },
  })) as { id: string } | null;
  return referrer;
}

/** Attach referrer at signup (only if user has no referrer yet). */
export async function applyReferralOnSignup(
  newUserId: string,
  referralCode: string | null | undefined
): Promise<void> {
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return;

  const existing = (await prisma.user.findUnique({
    where: { id: newUserId },
    select: { referredByUserId: true },
  })) as { referredByUserId?: string | null } | null;

  if (existing?.referredByUserId) return;

  const referrer = await findReferrerByCode(normalized);
  if (!referrer || referrer.id === newUserId) return;

  await prisma.user.update({
    where: { id: newUserId },
    data: { referredByUserId: referrer.id } as Record<string, unknown>,
  });
}

function isQualifyingPaidSubscription(sub: {
  tier: string;
  amountUsd: number;
  txSignature?: string | null;
  stripeSessionId?: string | null;
  stripeSubscriptionId?: string | null;
}): boolean {
  if (sub.tier !== "vip" || sub.amountUsd <= 0) return false;
  if (sub.stripeSessionId || sub.stripeSubscriptionId) return true;
  const tx = sub.txSignature?.trim() ?? "";
  if (!tx) return false;
  if (tx.startsWith("admin-grant-")) return false;
  return true;
}

/** Create affiliate commission row when a referred user pays for VIP (idempotent). */
export async function recordReferralCommissionForSubscription(subscriptionId: string): Promise<void> {
  const sub = (await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, referredByUserId: true } },
    },
  })) as {
    id: string;
    userId: string;
    tier: string;
    amountUsd: number;
    txSignature?: string | null;
    stripeSessionId?: string | null;
    stripeSubscriptionId?: string | null;
    user: { id: string; referredByUserId?: string | null };
  } | null;

  if (!sub || !isQualifyingPaidSubscription(sub)) return;
  if (!sub.user.referredByUserId || sub.user.referredByUserId === sub.userId) return;

  const priorSubs = (await prisma.subscription.findMany({
    where: {
      userId: sub.userId,
      id: { not: subscriptionId },
      tier: "vip",
      amountUsd: { gt: 0 },
    },
    select: {
      txSignature: true,
      stripeSessionId: true,
      stripeSubscriptionId: true,
    },
  })) as Array<{
    txSignature?: string | null;
    stripeSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  }>;

  const priorQualifying = priorSubs.filter((row) =>
    isQualifyingPaidSubscription({
      tier: "vip",
      amountUsd: 1,
      txSignature: row.txSignature,
      stripeSessionId: row.stripeSessionId,
      stripeSubscriptionId: row.stripeSubscriptionId,
    })
  ).length;

  if (priorQualifying > 0) return;

  const existing = await prisma.referralCommission.findUnique({
    where: { subscriptionId },
  });
  if (existing) return;

  const commissionAmountUsd = commissionAmountFromSubscription(sub.amountUsd, REFERRAL_COMMISSION_RATE_PCT);

  await prisma.referralCommission.create({
    data: {
      referrerUserId: sub.user.referredByUserId,
      refereeUserId: sub.userId,
      subscriptionId: sub.id,
      subscriptionAmountUsd: sub.amountUsd,
      commissionRatePct: REFERRAL_COMMISSION_RATE_PCT,
      commissionAmountUsd,
      status: REFERRAL_COMMISSION_STATUS.PENDING,
    },
  });
}

export async function countReferredUsers(referrerUserId: string): Promise<number> {
  return prisma.user.count({ where: { referredByUserId: referrerUserId } });
}
