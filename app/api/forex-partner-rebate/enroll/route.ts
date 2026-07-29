import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DEFAULT_REBATE_REWARD_TYPE,
  DEFAULT_REBATE_REWARD_VALUE,
  formatRebateReward,
  isRebatePartnerBrokerId,
  isValidRebateEmail,
  isValidSolanaUsdcWallet,
  rebateBrokerLabel,
} from "@/lib/forex-partner-rebates";

export const dynamic = "force-dynamic";

function enrollDb() {
  return prisma as unknown as {
    forexPartnerRebateEnrollment: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  };
}

function serialize(row: Record<string, unknown>) {
  return {
    id: row.id,
    broker: row.broker,
    brokerLabel: rebateBrokerLabel(String(row.broker ?? "")),
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    mtLogin: row.mtLogin,
    usdcWallet: row.usdcWallet,
    rewardType: row.rewardType,
    rewardValue: row.rewardValue,
    rewardLabel: formatRebateReward(String(row.rewardType ?? ""), Number(row.rewardValue) || 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

/** GET — current user's rebate enrollments (optional ?broker=). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  const broker = new URL(request.url).searchParams.get("broker")?.trim();
  const where: Record<string, unknown> = { userId: session.user.id };
  if (broker && isRebatePartnerBrokerId(broker)) where.broker = broker;

  const rows = await enrollDb().forexPartnerRebateEnrollment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    success: true,
    defaultReward: {
      rewardType: DEFAULT_REBATE_REWARD_TYPE,
      rewardValue: DEFAULT_REBATE_REWARD_VALUE,
      rewardLabel: formatRebateReward(DEFAULT_REBATE_REWARD_TYPE, DEFAULT_REBATE_REWARD_VALUE),
    },
    enrollments: rows.map(serialize),
    enrollment: broker && isRebatePartnerBrokerId(broker) ? (rows[0] ? serialize(rows[0]) : null) : undefined,
  });
}

/** POST — create or update enrollment for a broker (signed-in). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in to submit rebate details." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  if (!isRebatePartnerBrokerId(body.broker)) {
    return NextResponse.json({ success: false, error: "Select a partner broker." }, { status: 400 });
  }

  const customerName = String(body.customerName ?? "").trim().slice(0, 120);
  if (!customerName) {
    return NextResponse.json({ success: false, error: "Full name is required." }, { status: 400 });
  }

  const customerEmail = String(body.customerEmail ?? session.user.email ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
  if (!isValidRebateEmail(customerEmail)) {
    return NextResponse.json({ success: false, error: "Valid email is required." }, { status: 400 });
  }

  const mtLogin = String(body.mtLogin ?? "").trim().slice(0, 64);
  if (!mtLogin) {
    return NextResponse.json(
      { success: false, error: "Broker / MT4 / MT5 account login is required so we can match your volume." },
      { status: 400 }
    );
  }

  const usdcWallet = String(body.usdcWallet ?? "").trim();
  if (!isValidSolanaUsdcWallet(usdcWallet)) {
    return NextResponse.json(
      { success: false, error: "Enter a valid Solana wallet address for USDC payouts." },
      { status: 400 }
    );
  }

  const row = await enrollDb().forexPartnerRebateEnrollment.upsert({
    where: {
      userId_broker: { userId: session.user.id, broker: body.broker },
    },
    create: {
      userId: session.user.id,
      broker: body.broker,
      customerName,
      customerEmail,
      mtLogin,
      usdcWallet,
      rewardType: DEFAULT_REBATE_REWARD_TYPE,
      rewardValue: DEFAULT_REBATE_REWARD_VALUE,
    },
    update: {
      customerName,
      customerEmail,
      mtLogin,
      usdcWallet,
      rewardType: DEFAULT_REBATE_REWARD_TYPE,
      rewardValue: DEFAULT_REBATE_REWARD_VALUE,
    },
  });

  return NextResponse.json({
    success: true,
    enrollment: serialize(row),
    message: "Rebate details saved. We’ll pay $2 USDC per lot to your Solana wallet after volume is confirmed.",
  });
}
