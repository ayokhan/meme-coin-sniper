import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPositions as getPositionsBlofin, getTicker as getTickerBlofin, getInstrument as getInstrumentBlofin } from "@/lib/blofin";
import { getPositions as getPositionsCoinbase, getTicker as getTickerCoinbase, getInstrument as getInstrumentCoinbase } from "@/lib/coinbase";
import { resolveBlofinPositionPnl } from "@/lib/blofin-position-pnl";
import { resolveCoinbasePositionPnl } from "@/lib/coinbase-position-pnl";
import {
  resolveExchangeConfigForTradingBotSession,
  getTradingBotExchangeMeta,
  parseExchangeProviderParam,
} from "@/lib/trading-bot-exchange-session";

export const dynamic = "force-dynamic";

function parseNum(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** GET - All open positions with unrealized PNL for the signed-in user's exchange account. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const resolved = await resolveExchangeConfigForTradingBotSession(session, {
      provider: parseExchangeProviderParam(searchParams.get("provider")),
    });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: resolved.status });
    }
    const { provider, credentialSource } = resolved;
    const config = provider === "coinbase" ? resolved.coinbase! : resolved.blofin!;
    const exchange = await getTradingBotExchangeMeta(provider, credentialSource, config);
    const isDemo = exchange.demo;
    const blofinOpts = resolved.blofin ? { demo: isDemo, config: resolved.blofin } : undefined;
    const coinbaseOpts = resolved.coinbase ? { demo: isDemo, config: resolved.coinbase } : undefined;

    const positions =
      provider === "coinbase"
        ? await getPositionsCoinbase(undefined, coinbaseOpts!)
        : await getPositionsBlofin(undefined, blofinOpts!);

    if (!positions.length) {
      return NextResponse.json({
        success: true,
        positions: [],
        totalUnrealizedPnl: 0,
        markPrice: null,
        provider,
        exchange,
        blofin: provider === "blofin" ? exchange : undefined,
        coinbase: provider === "coinbase" ? exchange : undefined,
      });
    }

    const uniqueInstIds = [...new Set(positions.map((p) => p.instId).filter(Boolean))];
    const instData = await Promise.all(
      uniqueInstIds.map(async (id) => {
        const [instrument, ticker] =
          provider === "coinbase"
            ? await Promise.all([
                getInstrumentCoinbase(id, coinbaseOpts!),
                getTickerCoinbase(id, isDemo, { config: resolved.coinbase! }),
              ])
            : await Promise.all([
                getInstrumentBlofin(id, blofinOpts!),
                getTickerBlofin(id, isDemo, { config: resolved.blofin! }),
              ]);
        return {
          instId: id,
          contractValue: instrument ? parseNum(instrument.contractValue) : 1,
          markPrice: ticker?.last ? parseNum(ticker.last) : 0,
        };
      })
    );
    const byInst = Object.fromEntries(instData.map((d) => [d.instId, d]));

    const withPnl = positions.map((pos) => {
      const size = Math.abs(parseNum(pos.pos));
      const entryPrice = parseNum(pos.avgPx);
      const d = byInst[pos.instId] ?? { contractValue: 1, markPrice: 0 };
      const contractValue = d.contractValue ?? 1;
      const markFromRow = pos.markPx != null && pos.markPx !== "" ? parseNum(pos.markPx) : null;
      const markPrice = markFromRow != null && Number.isFinite(markFromRow) && markFromRow > 0 ? markFromRow : d.markPrice;
      const pnl =
        provider === "coinbase"
          ? resolveCoinbasePositionPnl(pos, { markPrice, contractValue })
          : resolveBlofinPositionPnl(pos, { markPrice, contractValue });
      const notional = size * entryPrice * contractValue;
      const liqPrice = pos.liqPx != null && pos.liqPx !== "" ? parseNum(pos.liqPx) : null;
      const marginNum = pos.margin != null && pos.margin !== "" ? parseNum(pos.margin) : null;
      const mgnRatioRaw = pos.mgnRatio;
      const marginRatioBlofin = mgnRatioRaw != null && mgnRatioRaw !== "" ? parseNum(mgnRatioRaw) : null;
      const initialMarginPct =
        notional > 0 && Number.isFinite(marginNum) && marginNum != null ? (marginNum / notional) * 100 : null;
      return {
        instId: pos.instId,
        posSide: pos.posSide,
        size,
        entryPrice,
        markPrice: pnl.markPrice,
        unrealizedPnl: pnl.unrealizedPnl,
        pnlPct: pnl.pnlPct,
        leverage: pnl.leverage,
        marginMode: pos.marginMode ?? null,
        pnlSource: pnl.source,
        liqPrice: Number.isFinite(liqPrice) ? liqPrice : null,
        margin: Number.isFinite(marginNum) ? marginNum : null,
        marginRatioBlofin: marginRatioBlofin != null && Number.isFinite(marginRatioBlofin) ? marginRatioBlofin : null,
        initialMarginPct: initialMarginPct != null ? Math.round(initialMarginPct * 100) / 100 : null,
        exchange: provider,
      };
    });

    const totalUnrealizedPnl = withPnl.reduce((sum, p) => sum + p.unrealizedPnl, 0);
    const singleMark = withPnl.length === 1 ? withPnl[0].markPrice : null;

    return NextResponse.json({
      success: true,
      positions: withPnl,
      totalUnrealizedPnl,
      markPrice: singleMark,
      provider,
      exchange,
      blofin: provider === "blofin" ? exchange : undefined,
      coinbase: provider === "coinbase" ? exchange : undefined,
    });
  } catch (e) {
    console.error("Trading bot positions:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load positions." },
      { status: 500 }
    );
  }
}
