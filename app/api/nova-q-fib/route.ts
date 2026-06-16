import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  normalizeMetalBase,
} from "@/lib/blofin-metals";
import {
  buildNovaPerpContractDescription,
  getNovaPerpCandles,
  getNovaPerpTicker,
  resolveNovaPerpVenue,
} from "@/lib/nova-perp-market";
import {
  aggregateOverallFibBias,
  analyzeNovaQFibTimeframe,
  buildOverallFibRead,
  NOVA_Q_FIB_TIMEFRAMES,
  type NovaQFibResult,
} from "@/lib/nova-q-fib";
import type { CandleTuple } from "@/lib/nova-q-analytics";
import { getNovaQFibAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

function normalizeSymbol(raw: string): string {
  return normalizeMetalBase(raw) || "BTC";
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaQFibAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const symbol = normalizeSymbol(String(body.symbol ?? "BTC"));
    const timeframesParam = body.timeframes ?? body.tf ?? ["15m", "1h", "1w"];
    const requestedTf = (typeof timeframesParam === "string"
      ? timeframesParam.split(/[\s,]+/).map((s) => s.trim().toLowerCase())
      : Array.isArray(timeframesParam)
        ? timeframesParam.map((s) => String(s).trim().toLowerCase())
        : []
    ).filter(Boolean);

    const selected = NOVA_Q_FIB_TIMEFRAMES.filter((t) => requestedTf.includes(t.id));
    const effectiveTf =
      selected.length > 0 ? selected : NOVA_Q_FIB_TIMEFRAMES.filter((t) => ["15m", "1h", "1w"].includes(t.id));

    const venue = await resolveNovaPerpVenue(symbol);
    const contractDescription = venue
      ? `${await buildNovaPerpContractDescription(symbol, venue)} NovaQ Fib uses the same feed with pivot-based retracement levels (separate from classic NovaQ).`
      : `${symbol} is not on Hyperliquid or Blofin USDT perps.`;

    const ticker = venue ? await getNovaPerpTicker(symbol, venue) : null;
    const currentPrice = ticker?.last ? Number(ticker.last) : null;

    const tfResults = [];
    if (venue) {
      for (const tf of effectiveTf) {
        try {
          const candles = await getNovaPerpCandles(symbol, venue, tf.interval, tf.limit);
          const row = analyzeNovaQFibTimeframe(candles as CandleTuple[], currentPrice, tf.label, tf.id);
          if (row) tfResults.push(row);
        } catch {
          // skip failed timeframe
        }
      }
    }

    const overallFibBias = aggregateOverallFibBias(tfResults);
    const overallRead = buildOverallFibRead(overallFibBias, tfResults);

    const result: NovaQFibResult = {
      symbol,
      currentPrice,
      contractDescription,
      overallFibBias,
      overallRead,
      timeframes: tfResults,
    };

    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "NovaQ Fib failed";
    console.error("NovaQ Fib error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
