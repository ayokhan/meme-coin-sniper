import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaSessionSweepAccess } from "@/lib/vip-futures-addon-access";
import {
  analyzeSessionSweep,
  parseSweepLookbackHours,
  parseSweepMode,
  parseSweepStopMode,
  parseSweepTimeframe,
  resolveSweepSymbol,
  scanSessionSweep,
} from "@/lib/session-sweep-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST { mode?: "analyze" | "scan", symbol, timeframe, lookback ("4h"…"60d"), stopMode,
 *        strategy?: "standard" | "scalp", rr? (scalp: 1.5 | 2), costs? (default true), focusTs? }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaSessionSweepAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const timeframe = parseSweepTimeframe(body.timeframe);
    const lookbackHours = parseSweepLookbackHours(body.lookback ?? body.lookbackDays);
    const stopMode = parseSweepStopMode(body.stopMode);
    const strategy = parseSweepMode(body.strategy);
    const rr = Number(body.rr);
    const includeCosts = body.costs !== false;

    if (body.mode === "scan") {
      const rows = await scanSessionSweep({ timeframe, lookbackHours, stopMode, mode: strategy, rr, includeCosts });
      return NextResponse.json({ success: true, rows, timeframe, lookbackHours, stopMode, strategy });
    }

    const symbol = resolveSweepSymbol(String(body.symbol ?? "XAUUSD"));
    if (!symbol) {
      return NextResponse.json({ success: false, error: "Unsupported symbol." }, { status: 400 });
    }
    const focusTs = Number(body.focusTs);
    const result = await analyzeSessionSweep({
      symbol,
      timeframe,
      lookbackHours,
      stopMode,
      mode: strategy,
      rr,
      includeCosts,
      focusTs: Number.isFinite(focusTs) && focusTs > 0 ? focusTs : null,
    });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session sweep analysis failed";
    console.error("nova-session-sweep POST:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
