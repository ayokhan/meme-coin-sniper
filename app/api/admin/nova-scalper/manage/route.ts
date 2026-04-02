import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession, isOwnerUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runNovaScalperTick, resetNovaScalperState } from "@/lib/nova-scalper-run";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type ScalperRow = {
  id: string;
  userId: string | null;
  enabled: boolean;
  mode: string;
  symbol: string;
  marginCurrency: string | null;
  side: string;
  inPosition: boolean;
  completedRounds: number;
  maxRounds: number;
  lastTickAt: Date | null;
  lastError: string | null;
  lastAction: string | null;
  updatedAt: Date;
};

/** GET — list all NovaScalper rows with user email/name. Owner-only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const rows: ScalperRow[] = await db.novaScalperConfig.findMany({
      orderBy: { updatedAt: "desc" },
    });
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))] as string[];
    // prisma-client.d.ts stubs user.findMany without where/select; runtime Prisma supports them.
    const users =
      userIds.length > 0
        ? await (prisma as { user: { findMany: (args: unknown) => Promise<unknown[]> } }).user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true, walletAddress: true, tradingBotOnDemand: true },
          })
        : [];
    const userList = users as Array<{
      id: string;
      email: string | null;
      name: string | null;
      walletAddress: string | null;
      tradingBotOnDemand: boolean;
    }>;
    const userMap = new Map(userList.map((u) => [u.id, u]));

    const configs = rows.map((r) => {
      const uid = r.userId;
      const u = uid ? userMap.get(uid) : undefined;
      const quote = r.marginCurrency === "USDC" ? "USDC" : "USDT";
      const { instId } = parseScalperInstrument(String(r.symbol ?? ""), quote);
      return {
        id: r.id,
        userId: uid,
        userEmail: u?.email ?? null,
        userName: u?.name ?? null,
        walletPreview:
          u?.walletAddress && u.walletAddress.length > 8
            ? `${u.walletAddress.slice(0, 4)}…${u.walletAddress.slice(-4)}`
            : null,
        tradingBotOnDemand: u?.tradingBotOnDemand ?? false,
        enabled: r.enabled,
        mode: r.mode === "live" ? "live" : "demo",
        symbol: String(r.symbol ?? ""),
        marginCurrency: quote,
        instrumentPair: `${String(r.symbol ?? "").toUpperCase()}/${quote}`,
        instId,
        side: r.side === "short" ? "short" : "long",
        inPosition: !!r.inPosition,
        completedRounds: r.completedRounds ?? 0,
        maxRounds: r.maxRounds ?? 0,
        lastTickAt: r.lastTickAt ? r.lastTickAt.toISOString() : null,
        lastError: r.lastError ?? null,
        lastAction: r.lastAction ?? null,
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, configs });
  } catch (e) {
    console.error("nova-scalper manage GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load configs." }, { status: 500 });
  }
}

/** POST — { action: "tick" | "reset", userId, clearRounds?: boolean }. Owner-only. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required." }, { status: 400 });
    }

    const row = await db.novaScalperConfig.findFirst({ where: { userId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "No NovaScalper config for this user." }, { status: 404 });
    }

    if (body.action === "reset") {
      const clearRounds = body.clearRounds === true;
      const r = await resetNovaScalperState(userId, { clearRounds, clearInPosition: true });
      if (!r.ok) {
        return NextResponse.json({ success: false, error: r.error ?? "Reset failed." }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "State reset." });
    }

    const targetIsOwner = await isOwnerUserId(userId);
    const result = await runNovaScalperTick(userId, { envFallbackForOwner: targetIsOwner });
    return NextResponse.json({
      success: result.ok,
      message: result.message,
      error: result.error,
    });
  } catch (e) {
    console.error("nova-scalper manage POST:", e);
    return NextResponse.json({ success: false, error: "Request failed." }, { status: 500 });
  }
}

/** PATCH — { userId, enabled: boolean }. Owner-only. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = String(body.userId ?? "").trim();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required." }, { status: 400 });
    }
    if (body.enabled !== true && body.enabled !== false) {
      return NextResponse.json({ success: false, error: "enabled must be true or false." }, { status: 400 });
    }

    const row = await db.novaScalperConfig.findFirst({ where: { userId } });
    if (!row) {
      return NextResponse.json({ success: false, error: "No NovaScalper config for this user." }, { status: 404 });
    }

    await db.novaScalperConfig.update({
      where: { id: row.id },
      data: { enabled: body.enabled === true },
    });

    return NextResponse.json({ success: true, enabled: body.enabled === true });
  } catch (e) {
    console.error("nova-scalper manage PATCH:", e);
    return NextResponse.json({ success: false, error: "Update failed." }, { status: 500 });
  }
}
