import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewAdminAffiliateSession } from "@/lib/admin-access";
import {
  REFERRAL_COMMISSION_STATUS,
  formatReferralStatus,
} from "@/lib/referral-program";

function parsePeriodFilters(url: URL) {
  const month = url.searchParams.get("month")?.trim() ?? "";
  const date = url.searchParams.get("date")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "";
  return { month, date, status };
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

/** GET — all referral commissions (admin read-only for non-owners). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!canViewAdminAffiliateSession(session)) {
    return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
  }

  const { month, date, status } = parsePeriodFilters(new URL(request.url));
  const isOwner = !!session?.user?.email && isOwnerEmail(session.user.email);

  const rows = (await prisma.referralCommission.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      referrer: { select: { email: true, name: true, referralCode: true } },
      referee: { select: { email: true, name: true, createdAt: true } },
    },
  })) as Array<{
    id: string;
    referrerUserId: string;
    refereeUserId: string;
    subscriptionAmountUsd: number;
    commissionRatePct: number;
    commissionAmountUsd: number;
    status: string;
    paidAt: Date | null;
    notes: string | null;
    createdAt: Date;
    referrer: { email: string | null; name: string | null; referralCode: string | null };
    referee: { email: string | null; name: string | null; createdAt: Date };
  }>;

  const filtered = rows.filter((r) => matchesCreatedAt(r.createdAt, month, date));

  const pendingTotal = filtered
    .filter((r) => r.status === REFERRAL_COMMISSION_STATUS.PENDING)
    .reduce((acc, r) => acc + r.commissionAmountUsd, 0);
  const paidTotal = filtered
    .filter((r) => r.status === REFERRAL_COMMISSION_STATUS.PAID)
    .reduce((acc, r) => acc + r.commissionAmountUsd, 0);

  return NextResponse.json({
    success: true,
    canEdit: isOwner,
    stats: {
      count: filtered.length,
      pendingUsd: Math.round(pendingTotal * 100) / 100,
      paidUsd: Math.round(paidTotal * 100) / 100,
    },
    commissions: filtered.map((r) => ({
      id: r.id,
      referrerEmail: r.referrer.email,
      referrerName: r.referrer.name,
      referrerCode: r.referrer.referralCode,
      refereeEmail: r.referee.email,
      refereeName: r.referee.name,
      refereeRegisteredAt: r.referee.createdAt.toISOString(),
      subscriptionAmountUsd: r.subscriptionAmountUsd,
      commissionRatePct: r.commissionRatePct,
      commissionAmountUsd: r.commissionAmountUsd,
      status: r.status,
      statusLabel: formatReferralStatus(r.status),
      paidAt: r.paidAt?.toISOString() ?? null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
