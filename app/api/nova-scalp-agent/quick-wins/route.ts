import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPerpsByCoins, TOP_ALTCOINS } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import {
  buildQuickWinCandidate,
  isValidScalpTimeframeId,
  NOVA_SCALP_DISCLAIMER,
  scalpCandlesRequest,
  scalpTimeframeConfig,
} from "@/lib/nova-scalp-agent";
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

    const perps = await getPerpsByCoins(TOP_ALTCOINS.slice(0, 18));
    const scored = await Promise.all(
      perps.map(async (p) => {
        const [c5, c15, cScalp] = await Promise.all([
          getCandles(p.coin, "5m", 12),
          getCandles(p.coin, "15m", 10),
          getCandles(p.coin, interval, limit),
        ]);
        const enriched = {
          ...p,
          pct5m: candlePct(c5, p.dayPct),
          pct15m: candlePct(c15, p.dayPct),
        };
        return buildQuickWinCandidate(enriched, c15, c5, cScalp, 100, timeframeId);
      })
    );

    const quickWins = scored
      .filter((w): w is NonNullable<typeof w> => w != null)
      .sort((a, b) => b.quickWinScore - a.quickWinScore)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      timeframeId,
      timeframeLabel: tfConfig.label,
      quickWins,
      disclaimer: NOVA_SCALP_DISCLAIMER,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Quick Wins scan failed";
    console.error("nova-scalp-agent quick-wins:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
