import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forexContractDescription, getForexCandles, getForexTicker, normalizeForexSymbol } from "@/lib/forex-market";
import {
  aggregateOverallFibBias,
  analyzeNovaQFibTimeframe,
  buildOverallFibRead,
  NOVA_Q_FIB_TIMEFRAMES,
} from "@/lib/nova-q-fib";
import type { CandleTuple } from "@/lib/nova-q-analytics";
import { getNovaForexFibAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexFibAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeForexSymbol(String(body.symbol ?? "XAUUSD")) || "XAUUSD";
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/)
      : Array.isArray(timeframesParam)
        ? timeframesParam.map(String)
        : []
    )
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const selected = NOVA_Q_FIB_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf =
      selected.length > 0 ? selected : NOVA_Q_FIB_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id));

    const ticker = await getForexTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;

    const tfResults = [];
    for (const tf of effectiveTf) {
      try {
        const candles = await getForexCandles(symbol, tf.interval, tf.limit);
        const row = analyzeNovaQFibTimeframe(candles as CandleTuple[], currentPrice, tf.label, tf.id);
        if (row) tfResults.push(row);
      } catch {
        // skip
      }
    }

    const overallFibBias = aggregateOverallFibBias(tfResults);
    return NextResponse.json({
      success: true,
      result: {
        symbol,
        currentPrice,
        contractDescription: forexContractDescription(symbol),
        overallFibBias,
        overallRead: buildOverallFibRead(overallFibBias, tfResults),
        timeframes: tfResults,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Forex Fib failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
