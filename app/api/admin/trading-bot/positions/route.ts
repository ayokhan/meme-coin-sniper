import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPositions as getPositionsBlofin, getTicker, getInstrument, isBlofinConfigured } from "@/lib/blofin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** GET - Open positions with unrealized PNL for the bot's symbol. Owner only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    if (!isBlofinConfigured()) {
      return NextResponse.json({ success: false, error: "Blofin not configured." }, { status: 400 });
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    if (!bot) {
      return NextResponse.json({ success: true, positions: [], totalUnrealizedPnl: 0 });
    }
    const rawSymbol = (bot.symbol ?? "").trim().toUpperCase();
    if (!rawSymbol) {
      return NextResponse.json({ success: true, positions: [], totalUnrealizedPnl: 0 });
    }
    const instId = rawSymbol.includes("/")
      ? rawSymbol.replace("/", "-")
      : `${rawSymbol}-${bot.marginCurrency ?? "USDT"}`;

    const isDemo = bot.mode === "demo";
    const [positions, instrument, ticker] = await Promise.all([
      getPositionsBlofin(instId, { demo: isDemo }),
      getInstrument(instId, { demo: isDemo }),
      getTicker(instId, isDemo),
    ]);

    if (!positions.length) {
      return NextResponse.json({
        success: true,
        positions: [],
        totalUnrealizedPnl: 0,
        markPrice: ticker?.last ? parseNum(ticker.last) : null,
      });
    }

    const contractValue = instrument ? parseNum(instrument.contractValue) : 0;
    const markPrice = ticker?.last ? parseNum(ticker.last) : 0;

    const withPnl = positions.map((pos) => {
      const size = Math.abs(parseNum(pos.pos));
      const entryPrice = parseNum(pos.avgPx);
      const posSide = (pos.posSide ?? "").toLowerCase();
      const unrealizedPnl =
        posSide === "long"
          ? (markPrice - entryPrice) * size * contractValue
          : (entryPrice - markPrice) * size * contractValue;
      return {
        instId: pos.instId,
        posSide: pos.posSide,
        size,
        entryPrice,
        markPrice,
        unrealizedPnl,
      };
    });

    const totalUnrealizedPnl = withPnl.reduce((sum, p) => sum + p.unrealizedPnl, 0);

    return NextResponse.json({
      success: true,
      positions: withPnl,
      totalUnrealizedPnl,
      markPrice,
    });
  } catch (e) {
    console.error("Trading bot positions:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load positions." },
      { status: 500 }
    );
  }
}
