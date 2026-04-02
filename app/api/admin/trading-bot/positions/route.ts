import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositions as getPositionsBlofin, getTicker, getInstrument } from "@/lib/blofin";
import { resolveBlofinConfigForTradingBotSession } from "@/lib/trading-bot-blofin-session";

export const dynamic = "force-dynamic";

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** GET - All open positions with unrealized PNL for the signed-in user's Blofin account. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const resolved = await resolveBlofinConfigForTradingBotSession(session);
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { config } = resolved;
    const isDemo = config.demo;
    const positions = await getPositionsBlofin(undefined, { demo: isDemo, config });

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
          getInstrument(id, { demo: isDemo, config }),
          getTicker(id, isDemo, { config }),
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
      const mgnRatioRaw = (pos as { mgnRatio?: string | null }).mgnRatio;
      const marginRatioBlofin = mgnRatioRaw != null && mgnRatioRaw !== "" ? parseNum(mgnRatioRaw) : null;
      const initialMarginPct = notional > 0 && Number.isFinite(marginNum) && marginNum != null
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
        marginRatioBlofin: marginRatioBlofin != null && Number.isFinite(marginRatioBlofin) ? marginRatioBlofin : null,
        initialMarginPct: initialMarginPct != null ? Math.round(initialMarginPct * 100) / 100 : null,
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
