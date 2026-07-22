import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

/**
 * GET — owner list of users with a Nova Forex broker connection (Vantage / TIOmarkets, MT4/MT5 via MetaAPI).
 * Never returns credentials — broker/platform/demo mode + Nova Forex Bot / Scalper status only.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const connRows = (await db.userForexBrokerConfig.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        userId: true,
        broker: true,
        platform: true,
        demoMode: true,
        metaApiAccountId: true,
        updatedAt: true,
      },
    })) as Array<{
      userId: string;
      broker: string;
      platform: string;
      demoMode: boolean;
      metaApiAccountId: string | null;
      updatedAt: Date;
    }>;

    const userIds = [...new Set(connRows.map((r) => r.userId))];
    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        users: [],
        note: "No users have connected a Vantage or TIOmarkets MT4/MT5 account yet.",
      });
    }

    const users = (await db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        name: true,
        walletAddress: true,
        subscriptions: {
          select: { expiresAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })) as Array<{
      id: string;
      email: string | null;
      name: string | null;
      walletAddress: string | null;
      subscriptions: Array<{ expiresAt: Date }>;
    }>;
    const userById = new Map(users.map((u) => [u.id, u]));

    const botRows = (await db.novaForexBotConfig.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, enabled: true, ownerForceOff: true, symbol: true, mode: true, lastRunAt: true, inPosition: true },
    })) as Array<{
      userId: string;
      enabled: boolean;
      ownerForceOff: boolean;
      symbol: string;
      mode: string;
      lastRunAt: Date | null;
      inPosition: boolean;
    }>;
    const botByUser = new Map(botRows.map((b) => [b.userId, b]));

    const scalperRows = (await db.novaForexScalperConfig.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, enabled: true, ownerForceOff: true, symbol: true, inPosition: true, lastTickAt: true },
      orderBy: { slot: "asc" },
    })) as Array<{
      userId: string | null;
      enabled: boolean;
      ownerForceOff: boolean;
      symbol: string;
      inPosition: boolean;
      lastTickAt: Date | null;
    }>;
    const scalperByUser = new Map<string, typeof scalperRows>();
    for (const s of scalperRows) {
      if (!s.userId) continue;
      const list = scalperByUser.get(s.userId) ?? [];
      list.push(s);
      scalperByUser.set(s.userId, list);
    }

    const now = Date.now();
    const rowsByUser = new Map<string, typeof connRows>();
    for (const c of connRows) {
      const list = rowsByUser.get(c.userId) ?? [];
      list.push(c);
      rowsByUser.set(c.userId, list);
    }

    const rows = [...rowsByUser.entries()].map(([userId, connections]) => {
      const u = userById.get(userId);
      const activeSub = u?.subscriptions.find((s) => s.expiresAt.getTime() > now);
      const bot = botByUser.get(userId);
      const scalperSlots = scalperByUser.get(userId) ?? [];
      const lastTickMs = scalperSlots
        .map((s) => s.lastTickAt?.getTime() ?? 0)
        .reduce((a, b) => Math.max(a, b), 0);
      return {
        userId,
        email: u?.email ?? null,
        name: u?.name ?? null,
        walletPreview: u?.walletAddress ? `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}` : null,
        isVip: !!activeSub,
        connections: connections.map((c) => ({
          broker: c.broker,
          platform: c.platform,
          demoMode: c.demoMode,
          provisioned: !!c.metaApiAccountId,
          updatedAt: c.updatedAt.toISOString(),
        })),
        novaForexBot: bot
          ? {
              enabled: bot.enabled && !bot.ownerForceOff,
              ownerForceOff: bot.ownerForceOff,
              symbol: bot.symbol,
              mode: bot.mode,
              inPosition: bot.inPosition,
              lastRunAt: bot.lastRunAt ? bot.lastRunAt.toISOString() : null,
            }
          : null,
        novaForexScalper: {
          slots: scalperSlots.length,
          anyEnabled: scalperSlots.some((s) => s.enabled && !s.ownerForceOff),
          inPosition: scalperSlots.some((s) => s.inPosition),
          symbols: [...new Set(scalperSlots.map((s) => s.symbol).filter(Boolean))],
          lastTickAt: lastTickMs > 0 ? new Date(lastTickMs).toISOString() : null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      count: rows.length,
      users: rows,
      note: "Connections saved = credentials on file (encrypted). Provisioned = MetaAPI account created. Secrets are never returned.",
    });
  } catch (e) {
    console.error("admin forex-bot-users:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load Nova Forex bot users" },
      { status: 500 }
    );
  }
}
