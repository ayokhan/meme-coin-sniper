import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFoundingSeatsUsed, getNovaProConfig, setNovaProConfig } from "@/lib/nova-pro";
import { NOVA_PRO_TIER } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type ProRow = {
  id: string;
  userId: string;
  plan: string;
  amountUsd: number;
  founding: boolean;
  txSignature: string | null;
  stripeSessionId: string | null;
  stripeSubscriptionId: string | null;
  autoRenew: boolean;
  expiresAt: Date;
  createdAt: Date;
  user?: { email: string | null; name: string | null } | null;
};

const db = prisma as unknown as { subscription: { findMany: (args: unknown) => Promise<ProRow[]> } };

async function requireOwner() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  return email && isOwnerEmail(email) ? session : null;
}

/** GET — Nova Pro config + subscriber stats + recent Pro subscriptions (owner). */
export async function GET() {
  if (!(await requireOwner())) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const now = new Date();
  const [config, foundingUsed, activeRows, recent] = await Promise.all([
    getNovaProConfig(),
    getFoundingSeatsUsed(),
    db.subscription.findMany({
      where: { tier: NOVA_PRO_TIER, expiresAt: { gt: now } },
      distinct: ["userId"],
      select: { userId: true, txSignature: true },
    }),
    db.subscription.findMany({
      where: { tier: NOVA_PRO_TIER },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { user: { select: { email: true, name: true } } },
    }),
  ]);
  const activeComplimentary = activeRows.filter((r) => r.txSignature?.startsWith("admin-grant")).length;
  return NextResponse.json({
    success: true,
    config,
    stats: {
      activeSubscribers: activeRows.length,
      activePaid: activeRows.length - activeComplimentary,
      activeComplimentary,
      foundingUsed,
    },
    recent: recent.map((s) => ({
      id: s.id,
      userId: s.userId,
      email: s.user?.email ?? null,
      name: s.user?.name ?? null,
      plan: s.plan,
      amountUsd: s.amountUsd,
      founding: s.founding,
      complimentary: !!s.txSignature?.startsWith("admin-grant"),
      method: s.stripeSessionId || s.stripeSubscriptionId ? "card" : s.txSignature?.startsWith("admin-grant") ? "admin" : "usdc",
      autoRenew: s.autoRenew,
      expiresAt: s.expiresAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      active: s.expiresAt > now,
    })),
  });
}

/** PATCH — update on/off, daily caps, refund threshold, founding seats. */
export async function PATCH(request: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));
  try {
    const config = await setNovaProConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      sharedDailyLimit: num(body.sharedDailyLimit),
      pulseDailyLimit: num(body.pulseDailyLimit),
      refundMaxRuns: num(body.refundMaxRuns),
      foundingEnabled: typeof body.foundingEnabled === "boolean" ? body.foundingEnabled : undefined,
      foundingSeats: num(body.foundingSeats),
    });
    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Update failed" }, { status: 500 });
  }
}
