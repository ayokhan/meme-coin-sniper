import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaSessionSweepAccess } from "@/lib/vip-futures-addon-access";
import {
  analyzeSessionSweep,
  parseSweepLookback,
  parseSweepStopMode,
  parseSweepTimeframe,
  resolveSweepSymbol,
  scanSessionSweep,
} from "@/lib/session-sweep-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST { mode?: "analyze" | "scan", symbol, timeframe, lookbackDays, stopMode, focusTs? } */
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
    const lookbackDays = parseSweepLookback(body.lookbackDays);
    const stopMode = parseSweepStopMode(body.stopMode);

    if (body.mode === "scan") {
      const rows = await scanSessionSweep({ timeframe, lookbackDays, stopMode });
      return NextResponse.json({ success: true, rows, timeframe, lookbackDays, stopMode });
    }

    const symbol = resolveSweepSymbol(String(body.symbol ?? "XAUUSD"));
    if (!symbol) {
      return NextResponse.json({ success: false, error: "Unsupported symbol." }, { status: 400 });
    }
    const focusTs = Number(body.focusTs);
    const result = await analyzeSessionSweep({
      symbol,
      timeframe,
      lookbackDays,
      stopMode,
      focusTs: Number.isFinite(focusTs) && focusTs > 0 ? focusTs : null,
    });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Session sweep analysis failed";
    console.error("nova-session-sweep POST:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
