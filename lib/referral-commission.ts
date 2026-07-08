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

function isQualifyingPaidSubscription(
  sub: {
    tier: string;
    amountUsd: number;
    txSignature?: string | null;
    stripeSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  },
  opts?: { allowAdminGrants?: boolean }
): boolean {
  if (sub.tier !== "vip" || sub.amountUsd <= 0) return false;
  if (sub.stripeSessionId || sub.stripeSubscriptionId) return true;
  const tx = sub.txSignature?.trim() ?? "";
  if (!tx) return false;
  if (tx.startsWith("admin-grant-")) return !!opts?.allowAdminGrants;
  return true;
}

export async function findUserByEmailOrId(query: string): Promise<{ id: string; email: string | null; name: string | null } | null> {
  const q = query.trim();
  if (!q) return null;
  const byId = (await prisma.user.findUnique({
    where: { id: q },
    select: { id: true, email: true, name: true },
  })) as { id: string; email: string | null; name: string | null } | null;
  if (byId) return byId;
  const email = q.toLowerCase();
  const byEmail = (await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true },
  })) as { id: string; email: string | null; name: string | null } | null;
  return byEmail;
}

/** Owner manually links invitee → referrer when the referral link was not used at signup. */
export async function manuallyLinkReferral(input: {
  referrerQuery: string;
  refereeQuery: string;
  notes?: string;
  allowAdminGrants?: boolean;
}): Promise<{
  referrerId: string;
  refereeId: string;
  commissionCreated: boolean;
  commissionId: string | null;
}> {
  const referrerCode = normalizeReferralCode(input.referrerQuery);
  let referrer = referrerCode ? await findReferrerByCode(referrerCode) : null;
  if (!referrer) {
    const byQuery = await findUserByEmailOrId(input.referrerQuery);
    if (byQuery) referrer = { id: byQuery.id };
  }
  if (!referrer) throw new Error("Referrer not found. Use their email or referral code.");

  const referee = await findUserByEmailOrId(input.refereeQuery);
  if (!referee) throw new Error("Invitee not found. Use their account email.");

  if (referrer.id === referee.id) throw new Error("Referrer and invitee cannot be the same user.");

  const refereeRow = (await prisma.user.findUnique({
    where: { id: referee.id },
    select: { referredByUserId: true },
  })) as { referredByUserId?: string | null } | null;

  if (refereeRow?.referredByUserId && refereeRow.referredByUserId !== referrer.id) {
    throw new Error("Invitee is already linked to a different referrer.");
  }

  if (!refereeRow?.referredByUserId) {
    await prisma.user.update({
      where: { id: referee.id },
      data: { referredByUserId: referrer.id } as Record<string, unknown>,
    });
  }

  const commissionId = await syncReferralCommissionForReferee(referee.id, {
    allowAdminGrants: input.allowAdminGrants ?? true,
    notes: input.notes,
  });

  return {
    referrerId: referrer.id,
    refereeId: referee.id,
    commissionCreated: !!commissionId,
    commissionId,
  };
}

/** After manual link or VIP grant, create commission from invitee's first VIP subscription if missing. */
export async function syncReferralCommissionForReferee(
  refereeUserId: string,
  opts?: { allowAdminGrants?: boolean; notes?: string }
): Promise<string | null> {
  const referee = (await prisma.user.findUnique({
    where: { id: refereeUserId },
    select: { id: true, referredByUserId: true },
  })) as { id: string; referredByUserId?: string | null } | null;

  if (!referee?.referredByUserId || referee.referredByUserId === referee.id) return null;

  const subs = (await prisma.subscription.findMany({
    where: { userId: refereeUserId, tier: "vip", amountUsd: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  })) as Array<{
    id: string;
    userId: string;
    tier: string;
    amountUsd: number;
    txSignature?: string | null;
    stripeSessionId?: string | null;
    stripeSubscriptionId?: string | null;
  }>;

  const qualifying = subs.find((s) =>
    isQualifyingPaidSubscription(s, { allowAdminGrants: opts?.allowAdminGrants })
  );
  if (!qualifying) return null;

  const existing = await prisma.referralCommission.findUnique({
    where: { subscriptionId: qualifying.id },
  });
  if (existing) return (existing as { id: string }).id;

  const commissionAmountUsd = commissionAmountFromSubscription(
    qualifying.amountUsd,
    REFERRAL_COMMISSION_RATE_PCT
  );

  const created = (await prisma.referralCommission.create({
    data: {
      referrerUserId: referee.referredByUserId,
      refereeUserId: referee.id,
      subscriptionId: qualifying.id,
      subscriptionAmountUsd: qualifying.amountUsd,
      commissionRatePct: REFERRAL_COMMISSION_RATE_PCT,
      commissionAmountUsd,
      status: REFERRAL_COMMISSION_STATUS.PENDING,
      notes: opts?.notes?.trim() || "Manually verified referral",
    },
  })) as { id: string };

  return created.id;
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
