import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatRebateReward,
  isRebatePartnerBrokerId,
  rebateBrokerLabel,
} from "@/lib/forex-partner-rebates";

export const dynamic = "force-dynamic";

function enrollDb() {
  return prisma as unknown as {
    forexPartnerRebateEnrollment: {
      findMany: (args: unknown) => Promise<
        Array<
          Record<string, unknown> & {
            user?: { email: string | null; name: string | null } | null;
          }
        >
      >;
      delete: (args: unknown) => Promise<unknown>;
    };
  };
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Owner only." }, { status: 403 }) };
  }
  return { ok: true as const };
}

function serialize(row: Record<string, unknown> & { user?: { email: string | null; name: string | null } | null }) {
  return {
    id: row.id,
    userId: row.userId,
    broker: row.broker,
    brokerLabel: rebateBrokerLabel(String(row.broker ?? "")),
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    mtLogin: row.mtLogin,
    usdcWallet: row.usdcWallet,
    rewardType: row.rewardType,
    rewardValue: row.rewardValue,
    rewardLabel: formatRebateReward(String(row.rewardType ?? ""), Number(row.rewardValue) || 0),
    userEmail: row.user?.email ?? null,
    userName: row.user?.name ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

/** GET — list rebate enrollments (optional ?broker=). */
export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  const broker = new URL(request.url).searchParams.get("broker")?.trim();
  const where: Record<string, unknown> = {};
  if (broker && isRebatePartnerBrokerId(broker)) where.broker = broker;

  const rows = await enrollDb().forexPartnerRebateEnrollment.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json({
    success: true,
    enrollments: rows.map(serialize),
  });
}

/** DELETE — remove an enrollment. ?id= or { id }. */
export async function DELETE(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id")?.trim() || "";
  if (!id) {
    try {
      const body = await request.json();
      id = String(body.id ?? "").trim();
    } catch {
      /* ignore */
    }
  }
  if (!id) {
    return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
  }

  await enrollDb().forexPartnerRebateEnrollment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
