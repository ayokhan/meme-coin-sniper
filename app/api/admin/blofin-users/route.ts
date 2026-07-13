import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * GET — owner list of users with Blofin API keys saved (Nova bots).
 * Never returns secrets — configured flag + demo/live + timestamps only.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const rows = (await db.userBlofinConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        userId: true,
        demoMode: true,
        updatedAt: true,
        brokerId: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
            tradingBotOnDemand: true,
            propFirmBotOnDemand: true,
            subscriptions: {
              select: {
                expiresAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    })) as Array<{
      userId: string;
      demoMode: boolean;
      updatedAt: Date;
      brokerId: string | null;
      user: {
        id: string;
        email: string | null;
        name: string | null;
        walletAddress: string | null;
        tradingBotOnDemand: boolean;
        propFirmBotOnDemand: boolean;
        subscriptions: Array<{ expiresAt: Date; createdAt: Date }>;
      };
    }>;

    const userIds = rows.map((r) => r.userId);
    const scalperRows = (
      userIds.length > 0
        ? await db.novaScalperConfig.findMany({
            where: { userId: { in: userIds } },
            select: {
              userId: true,
              enabled: true,
              mode: true,
              lastTickAt: true,
              inPosition: true,
              symbol: true,
              slot: true,
            },
            orderBy: { slot: "asc" },
          })
        : []
    ) as Array<{
      userId: string | null;
      enabled: boolean;
      mode: string;
      lastTickAt: Date | null;
      inPosition: boolean;
      symbol: string;
      slot: number;
    }>;

    const scalperByUser = new Map<string, typeof scalperRows>();
    for (const c of scalperRows) {
      if (!c.userId) continue;
      const list = scalperByUser.get(c.userId) ?? [];
      list.push(c);
      scalperByUser.set(c.userId, list);
    }

    const now = Date.now();
    const users = rows.map((r) => {
      const u = r.user;
      const activeSub = u.subscriptions.find((s) => s.expiresAt.getTime() > now);
      const isVip = !!activeSub;
      const scalper = scalperByUser.get(r.userId) ?? [];
      const lastTick = scalper
        .map((c) => c.lastTickAt?.getTime() ?? 0)
        .reduce((a: number, b: number) => Math.max(a, b), 0);

      return {
        userId: r.userId,
        email: u.email,
        name: u.name,
        walletPreview: u.walletAddress
          ? `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`
          : null,
        blofinDemoMode: r.demoMode,
        keysUpdatedAt: r.updatedAt.toISOString(),
        brokerId: r.brokerId,
        isVip,
        tradingBotOnDemand: !!u.tradingBotOnDemand,
        propFirmBotOnDemand: !!u.propFirmBotOnDemand,
        novaScalper: {
          slots: scalper.length,
          anyEnabled: scalper.some((c) => c.enabled),
          inPosition: scalper.some((c) => c.inPosition),
          lastTickAt: lastTick > 0 ? new Date(lastTick).toISOString() : null,
          symbols: [...new Set(scalper.map((c) => c.symbol).filter(Boolean))],
        },
      };
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users,
      note: "Keys saved = connected. lastTickAt is NovaScalper cron activity only — not every Blofin API call.",
    });
  } catch (e) {
    console.error("admin blofin-users:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load Blofin users" },
      { status: 500 }
    );
  }
}
