import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  evaluateQuickWinPerp,
  isValidScalpTimeframeId,
  NOVA_SCALP_DISCLAIMER,
  scalpCandlesRequest,
  scalpTimeframeConfig,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
  type QuickWinScanSummary,
} from "@/lib/nova-scalp-agent";
import {
  getNovaScalpCandles,
  getNovaScalpTickSize,
  resolveNovaScalpQuickWinUniverse,
} from "@/lib/nova-scalp-blofin-market";
import { getNovaScalpAgentAccess } from "@/lib/vip-futures-addon-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function candlePct(candles: Array<[string, string, string, string, string, ...string[]]>, fallback: number): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const rawTf = new URL(request.url).searchParams.get("timeframe")?.trim() ?? "5m";
    const timeframeId = isValidScalpTimeframeId(rawTf) ? rawTf : "5m";
    const tfConfig = scalpTimeframeConfig(timeframeId);
    const { interval, limit } = scalpCandlesRequest(timeframeId);
    const rawLev = Number(new URL(request.url).searchParams.get("leverage"));
    const leverage = Number.isFinite(rawLev) ? Math.min(125, Math.max(1, rawLev)) : undefined;
    const rawMargin = Number(new URL(request.url).searchParams.get("amountUsd"));
    const amountUsd = Number.isFinite(rawMargin) ? Math.max(1, rawMargin) : 100;

    const perps = await resolveNovaScalpQuickWinUniverse(32);
    const evaluated = await Promise.all(
      perps.map(async (p) => {
        try {
          const [c5, c15, cScalp, tickSize] = await Promise.all([
            getNovaScalpCandles(p.coin, "5m", 12),
            getNovaScalpCandles(p.coin, "15m", 10),
            getNovaScalpCandles(p.coin, interval, limit),
            getNovaScalpTickSize(p.coin),
          ]);
          if (!cScalp.length) return null;

          const enriched = {
            ...p,
            pct5m: candlePct(c5, p.dayPct),
            pct15m: candlePct(c15, p.dayPct),
          };
          return evaluateQuickWinPerp(enriched, c15, c5, cScalp, amountUsd, timeframeId, leverage, tickSize);
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
      symbolsScanned: perps.length,
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
      marketVenue: "blofin",
      disclaimer: NOVA_SCALP_DISCLAIMER,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Quick wins failed";
    console.error("nova-scalp-agent quick-wins:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
