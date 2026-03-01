import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPositions as getPositionsBlofin, getTicker, getInstrument, isBlofinConfigured } from "@/lib/blofin";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** GET - All open positions with unrealized PNL (all symbols). Owner only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }
    if (!isBlofinConfigured()) {
      return NextResponse.json({ success: false, error: "Blofin not configured." }, { status: 400 });
    }
    const bot = await db.tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const isDemo = bot?.mode === "demo";
    const positions = await getPositionsBlofin(undefined, { demo: isDemo });

    if (!positions.length) {
      return NextResponse.json({
        success: true,
        positions: [],
        totalUnrealizedPnl: 0,
        markPrice: null,
      });
    }

    const uniqueInstIds = [...new Set(positions.map((p) => p.instId).filter(Boolean))];
    const instData = await Promise.all(
      uniqueInstIds.map(async (id) => {
        const [instrument, ticker] = await Promise.all([
          getInstrument(id, { demo: isDemo }),
          getTicker(id, isDemo),
        ]);
        return {
          instId: id,
          contractValue: instrument ? parseNum(instrument.contractValue) : 0,
          markPrice: ticker?.last ? parseNum(ticker.last) : 0,
        };
      })
    );
    const byInst = Object.fromEntries(instData.map((d) => [d.instId, d]));

    const withPnl = positions.map((pos) => {
      const size = Math.abs(parseNum(pos.pos));
      const entryPrice = parseNum(pos.avgPx);
      const posSide = (pos.posSide ?? "").toLowerCase();
      const d = byInst[pos.instId] ?? { contractValue: 0, markPrice: 0 };
      const contractValue = d.contractValue ?? 0;
      const unrealizedPnl =
        contractValue > 0 && posSide === "long"
          ? (d.markPrice - entryPrice) * size * contractValue
          : contractValue > 0
            ? (entryPrice - d.markPrice) * size * contractValue
            : 0;
      const notional = size * entryPrice * contractValue;
      const pnlPct = notional > 0 ? (unrealizedPnl / notional) * 100 : null;
      const liqPrice = pos.liqPx != null && pos.liqPx !== "" ? parseNum(pos.liqPx) : null;
      const marginNum = pos.margin != null && pos.margin !== "" ? parseNum(pos.margin) : null;
      const marginRatioPct = notional > 0 && Number.isFinite(marginNum) && marginNum != null
        ? (marginNum / notional) * 100
        : null;
      return {
        instId: pos.instId,
        posSide: pos.posSide,
        size,
        entryPrice,
        markPrice: d.markPrice,
        unrealizedPnl,
        pnlPct: pnlPct != null ? Math.round(pnlPct * 100) / 100 : null,
        liqPrice: Number.isFinite(liqPrice) ? liqPrice : null,
        margin: Number.isFinite(marginNum) ? marginNum : null,
        marginRatioPct: marginRatioPct != null ? Math.round(marginRatioPct * 100) / 100 : null,
      };
    });

    const totalUnrealizedPnl = withPnl.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const singleMark = withPnl.length === 1 ? withPnl[0].markPrice : null;

    return NextResponse.json({
      success: true,
      positions: withPnl,
      totalUnrealizedPnl,
      markPrice: singleMark,
    });
  } catch (e) {
    console.error("Trading bot positions:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load positions." },
      { status: 500 }
    );
  }
}
