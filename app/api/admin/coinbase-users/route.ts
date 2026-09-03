import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/** GET — owner list of users with Coinbase API keys saved. Never returns secrets. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const rows = (await db.userCoinbaseConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        userId: true,
        demoMode: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            walletAddress: true,
            tradingBotOnDemand: true,
            propFirmBotOnDemand: true,
            subscriptions: {
              select: { expiresAt: true, createdAt: true },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    })) as Array<{
      userId: string;
      demoMode: boolean;
      updatedAt: Date;
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

    const now = Date.now();
    const users = rows.map((r) => {
      const u = r.user;
      const activeSub = u.subscriptions.find((s) => s.expiresAt.getTime() > now);
      return {
        userId: r.userId,
        email: u.email,
        name: u.name,
        walletPreview: u.walletAddress
          ? `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`
          : null,
        coinbaseDemoMode: r.demoMode,
        keysUpdatedAt: r.updatedAt.toISOString(),
        isVip: !!activeSub,
        tradingBotOnDemand: !!u.tradingBotOnDemand,
        propFirmBotOnDemand: !!u.propFirmBotOnDemand,
      };
    });

    return NextResponse.json({
      success: true,
      count: users.length,
      users,
      note: "Keys saved = connected. Secrets are never shown.",
    });
  } catch (e) {
    console.error("admin coinbase-users:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load Coinbase users" },
      { status: 500 }
    );
  }
}
