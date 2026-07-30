import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRebateReward, rebateBrokerLabel } from "@/lib/forex-partner-rebates";

export const dynamic = "force-dynamic";

function payoutDb() {
  return prisma as unknown as {
    forexPartnerRebatePayout: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    forexPartnerRebateEnrollment: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };
}

/** GET — signed-in user's rebate enrollments + payout status summary. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const userId = session.user.id;
  const email = (session.user.email ?? "").trim().toLowerCase();

  const [enrollments, payouts] = await Promise.all([
    payoutDb().forexPartnerRebateEnrollment.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    payoutDb().forexPartnerRebatePayout.findMany({
      where: {
        OR: [
          { userId },
          ...(email ? [{ customerEmail: email }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let pendingUsd = 0;
  let paidThisMonthUsd = 0;
  let paidAllTimeUsd = 0;

  const rows = payouts.map((p) => {
    const status = String(p.status ?? "pending");
    const amount =
      p.amountPaidUsd != null && Number.isFinite(Number(p.amountPaidUsd))
        ? Number(p.amountPaidUsd)
        : p.suggestedAmountUsd != null && Number.isFinite(Number(p.suggestedAmountUsd))
          ? Number(p.suggestedAmountUsd)
          : null;
    if (status === "pending" && amount != null) pendingUsd += amount;
    if (status === "paid" && p.amountPaidUsd != null) {
      const paid = Number(p.amountPaidUsd) || 0;
      paidAllTimeUsd += paid;
      const paidAt = p.paidAt instanceof Date ? p.paidAt : p.paidAt ? new Date(String(p.paidAt)) : null;
      if (paidAt && paidAt >= monthStart) paidThisMonthUsd += paid;
    }
    return {
      id: p.id,
      broker: p.broker,
      brokerLabel: rebateBrokerLabel(String(p.broker ?? "")),
      rewardLabel: formatRebateReward(String(p.rewardType ?? ""), Number(p.rewardValue) || 0),
      lotsTraded: p.lotsTraded != null ? Number(p.lotsTraded) : null,
      suggestedAmountUsd: p.suggestedAmountUsd != null ? Number(p.suggestedAmountUsd) : null,
      amountPaidUsd: p.amountPaidUsd != null ? Number(p.amountPaidUsd) : null,
      status,
      periodNote: p.periodNote ?? null,
      paidAt: p.paidAt instanceof Date ? p.paidAt.toISOString() : p.paidAt,
      createdAt: p.createdAt instanceof Date ? (p.createdAt as Date).toISOString() : p.createdAt,
    };
  });

  return NextResponse.json({
    success: true,
    enrolled: enrollments.length > 0,
    enrollments: enrollments.map((e) => ({
      id: e.id,
      broker: e.broker,
      brokerLabel: rebateBrokerLabel(String(e.broker ?? "")),
      mtLogin: e.mtLogin,
      usdcWallet: e.usdcWallet,
      rewardLabel: formatRebateReward(String(e.rewardType ?? "per_lot"), Number(e.rewardValue) || 2),
    })),
    summary: {
      pendingUsd: Math.round(pendingUsd * 100) / 100,
      paidThisMonthUsd: Math.round(paidThisMonthUsd * 100) / 100,
      paidAllTimeUsd: Math.round(paidAllTimeUsd * 100) / 100,
      pendingCount: rows.filter((r) => r.status === "pending").length,
      paidCount: rows.filter((r) => r.status === "paid").length,
    },
    payouts: rows,
  });
}
