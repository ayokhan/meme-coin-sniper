import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getForexCandles, FOREX_SCALP_MAX_LEVERAGE } from "@/lib/forex-market";
import {
  evaluateQuickWinForex,
  FOREX_QUICK_WIN_SYMBOLS,
  forexScalpCandlesRequest,
  forexScalpTimeframeConfig,
} from "@/lib/forex-scalp-quick-wins";
import {
  isValidScalpTimeframeId,
  NOVA_SCALP_DISCLAIMER,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
  type QuickWinScanSummary,
} from "@/lib/nova-scalp-agent";
import { getNovaForexScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaForexScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const url = new URL(request.url);
    const rawTf = url.searchParams.get("timeframe")?.trim() ?? "5m";
    const timeframeId = isValidScalpTimeframeId(rawTf) ? rawTf : "5m";
    const tfConfig = forexScalpTimeframeConfig(timeframeId);
    const { interval, limit } = forexScalpCandlesRequest(timeframeId);
    const rawLev = Number(url.searchParams.get("leverage"));
    const leverage = Number.isFinite(rawLev)
      ? Math.min(FOREX_SCALP_MAX_LEVERAGE, Math.max(1, rawLev))
      : undefined;
    const rawMargin = Number(url.searchParams.get("amountUsd"));
    const amountUsd = Number.isFinite(rawMargin) ? Math.max(1, rawMargin) : 100;
    const maxLossPct = Number(url.searchParams.get("maxLossPct"));
    const maxLossPctOnMargin = Number.isFinite(maxLossPct) ? Math.min(100, Math.max(0.5, maxLossPct)) : 5;

    const evaluated = await Promise.all(
      FOREX_QUICK_WIN_SYMBOLS.map(async (sym) => {
        try {
          const [c5, c15, cScalp] = await Promise.all([
            getForexCandles(sym, "5m", 12),
            getForexCandles(sym, "15m", 10),
            getForexCandles(sym, interval, limit),
          ]);
          if (!cScalp.length) return null;
          const close = Number(cScalp[0]?.[4]);
          const price = Number.isFinite(close) ? close : null;
          return evaluateQuickWinForex({
            symbol: sym,
            candles15m: c15,
            candles5m: c5,
            scalpCandles: cScalp,
            currentPrice: price,
            amountUsd,
            scalpTimeframeId: timeframeId,
            userLeverage: leverage,
            maxLossPctOnMargin,
          });
        } catch {
          return null;
        }
      })
    );

    const quickWins: NovaScalpQuickWin[] = [];
    const nearSetups: NovaScalpNearSetup[] = [];
    let oscillationQualified = 0;
    let entryConfirmed = 0;

    for (const row of evaluated) {
      if (!row) continue;
      if (row.oscillationOk) oscillationQualified += 1;
      if (row.win) {
        entryConfirmed += 1;
        quickWins.push(row.win);
      } else if (row.near) {
        nearSetups.push(row.near);
      }
    }

    const summary: QuickWinScanSummary = {
      symbolsScanned: FOREX_QUICK_WIN_SYMBOLS.length,
      oscillationQualified,
      entryConfirmed,
    };

    quickWins.sort((a, b) => b.quickWinScore - a.quickWinScore);
    nearSetups.sort((a, b) => b.quickWinScore - a.quickWinScore);

    return NextResponse.json({
      success: true,
      timeframeId,
      timeframeLabel: tfConfig.label,
      leverage: leverage ?? null,
      amountUsd,
      quickWins: quickWins.slice(0, 10),
      nearSetups: nearSetups.slice(0, 6),
      scanSummary: summary,
      disclaimer: NOVA_SCALP_DISCLAIMER,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Forex Quick Wins scan failed";
    console.error("nova-forex/scalp/quick-wins:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
