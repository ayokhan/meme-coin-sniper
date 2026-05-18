import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCandles as getHlCandles, getPerpSpecFromMeta, getTicker as getHlTicker, type HyperliquidPerpSpec } from "@/lib/hyperliquid";
import {
  blofinMetalContractDescription,
  getBlofinMetalCandles,
  getBlofinMetalTicker,
  isBlofinMetal,
  normalizeMetalBase,
  novaQUnknownHlSymbolMessage,
  type BlofinMetal,
} from "@/lib/blofin-metals";
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

function buildContractDescription(symbol: string, spec: HyperliquidPerpSpec | null): string {
  if (!spec) return novaQUnknownHlSymbolMessage(symbol);
  const minStep = Math.pow(10, -spec.szDecimals);
  return `${spec.name}: Hyperliquid USDC-margined perpetual, max leverage ${spec.maxLeverage}x, min step ~${minStep} ${spec.name}.`;
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
      selected.length > 0 ? selected : [NOVA_Q_FIB_TIMEFRAMES[1], NOVA_Q_FIB_TIMEFRAMES[3], NOVA_Q_FIB_TIMEFRAMES[8]];

    const useBlofinMetal = isBlofinMetal(symbol);

    let contractDescription = "";
    if (useBlofinMetal) {
      contractDescription = `${blofinMetalContractDescription(symbol as BlofinMetal)} NovaQ Fib uses the same feed with pivot-based retracement levels (separate from classic NovaQ).`;
    } else {
      try {
        const spec = await getPerpSpecFromMeta(symbol);
        contractDescription = `${buildContractDescription(symbol, spec)} NovaQ Fib adds Fibonacci retracement from pivot swings (classic NovaQ unchanged).`;
      } catch {
        contractDescription = `${symbol}: contract details temporarily unavailable.`;
      }
    }

    const ticker = useBlofinMetal
      ? await getBlofinMetalTicker(symbol as BlofinMetal)
      : await getHlTicker(symbol);
    const currentPrice = ticker?.last ? Number(ticker.last) : null;

    const tfResults = [];
    for (const tf of effectiveTf) {
      try {
        const candles = useBlofinMetal
          ? await getBlofinMetalCandles(symbol as BlofinMetal, tf.interval, tf.limit)
          : await getHlCandles(symbol, tf.interval, tf.limit);
        const row = analyzeNovaQFibTimeframe(candles as CandleTuple[], currentPrice, tf.label, tf.id);
        if (row) tfResults.push(row);
      } catch {
        // skip failed timeframe
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
