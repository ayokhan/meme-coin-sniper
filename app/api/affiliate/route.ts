import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  AFFILIATE_TERMS,
  REFERRAL_COMMISSION_STATUS,
  formatReferralStatus,
  nextFridayLabel,
  referralLinkForCode,
} from "@/lib/referral-program";
import {
  applyReferralOnSignup,
  countReferredUsers,
  ensureUserReferralCode,
} from "@/lib/referral-commission";
import { normalizeReferralCode } from "@/lib/referral-program";
import { readReferralCodeFromCookies } from "@/lib/referral-cookie-server";

const REFERRAL_ATTRIBUTION_MAX_MS = 24 * 60 * 60 * 1000;

function parsePeriodFilters(url: URL) {
  const month = url.searchParams.get("month")?.trim() ?? "";
  const date = url.searchParams.get("date")?.trim() ?? "";
  return { month, date };
}

function matchesCreatedAt(createdAt: Date, month: string, date: string): boolean {
  const y = createdAt.getFullYear();
  const m = createdAt.getMonth() + 1;
  const d = createdAt.getDate();
  if (date) {
    const [py, pm, pd] = date.split("-").map(Number);
    return y === py && m === pm && d === pd;
  }
  if (month) {
    const [py, pm] = month.split("-").map(Number);
    return y === py && m === pm;
  }
  return true;
}

/** GET — affiliate dashboard for signed-in user. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const code = await ensureUserReferralCode(userId);
  const origin = new URL(request.url).origin;
  const link = referralLinkForCode(code, origin);

  const { month, date } = parsePeriodFilters(new URL(request.url));

  const [totalReferrals, commissions] = await Promise.all([
    countReferredUsers(userId),
    prisma.referralCommission.findMany({
      where: { referrerUserId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        referee: { select: { email: true, name: true, createdAt: true } },
      },
    }),
  ]);

  const filtered = (commissions as Array<{
    id: string;
    refereeUserId: string;
    subscriptionAmountUsd: number;
    commissionRatePct: number;
    commissionAmountUsd: number;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
    referee: { email: string | null; name: string | null; createdAt: Date };
  }>).filter((c) => matchesCreatedAt(c.createdAt, month, date));

  const totalEarned = (commissions as Array<{ commissionAmountUsd: number }>).reduce(
    (acc, c) => acc + c.commissionAmountUsd,
    0
  );
  const pendingAmount = (commissions as Array<{ commissionAmountUsd: number; status: string }>)
    .filter((c) => c.status === REFERRAL_COMMISSION_STATUS.PENDING)
    .reduce((acc, c) => acc + c.commissionAmountUsd, 0);
  const paidAmount = (commissions as Array<{ commissionAmountUsd: number; status: string }>)
    .filter((c) => c.status === REFERRAL_COMMISSION_STATUS.PAID)
    .reduce((acc, c) => acc + c.commissionAmountUsd, 0);

  return NextResponse.json({
    success: true,
    referralCode: code,
    referralLink: link,
    commissionRatePct: 10,
    stats: {
      totalReferrals,
      totalCommissions: (commissions as unknown[]).length,
      totalEarnedUsd: Math.round(totalEarned * 100) / 100,
      pendingUsd: Math.round(pendingAmount * 100) / 100,
      paidUsd: Math.round(paidAmount * 100) / 100,
    },
    nextPayoutFriday: nextFridayLabel(),
    terms: AFFILIATE_TERMS,
    commissions: filtered.map((c) => ({
      id: c.id,
      refereeLabel: c.referee.name || c.referee.email || "User",
      refereeRegisteredAt: c.referee.createdAt.toISOString(),
      subscriptionAmountUsd: c.subscriptionAmountUsd,
      commissionRatePct: c.commissionRatePct,
      commissionAmountUsd: c.commissionAmountUsd,
      status: c.status,
      statusLabel: formatReferralStatus(c.status),
      paidAt: c.paidAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

/** POST — claim referral from cookie (Google / wallet signup within attribution window). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const fromBody = normalizeReferralCode((body.referralCode ?? body.ref ?? "").toString());
  const fromCookie = await readReferralCodeFromCookies();
  const code = fromBody ?? fromCookie;
  if (!code) {
    return NextResponse.json({ success: false, error: "No referral code." }, { status: 400 });
  }

  const user = (await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, referredByUserId: true, createdAt: true },
  })) as { id: string; referredByUserId?: string | null; createdAt: Date } | null;

  if (!user) {
    return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
  }

  if (user.referredByUserId) {
    return NextResponse.json({ success: true, message: "Referral already linked." });
  }

  const ageMs = Date.now() - user.createdAt.getTime();
  if (ageMs > REFERRAL_ATTRIBUTION_MAX_MS) {
    return NextResponse.json({
      success: false,
      error: "Referral link must be used at registration (within 24 hours of sign-up).",
    }, { status: 400 });
  }

  await applyReferralOnSignup(user.id, code);
  return NextResponse.json({ success: true, message: "Referral linked." });
}
