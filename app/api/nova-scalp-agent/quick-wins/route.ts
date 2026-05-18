import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPerpsByCoins, TOP_ALTCOINS } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import { buildQuickWinCandidate } from "@/lib/nova-scalp-agent";
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getNovaScalpAgentAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const perps = await getPerpsByCoins(TOP_ALTCOINS.slice(0, 18));
    const scored = await Promise.all(
      perps.map(async (p) => {
        const [c5, c15, cScalp] = await Promise.all([
          getCandles(p.coin, "5m", 12),
          getCandles(p.coin, "15m", 10),
          getCandles(p.coin, "1m", 120),
        ]);
        const enriched = {
          ...p,
          pct5m: candlePct(c5, p.dayPct),
          pct15m: candlePct(c15, p.dayPct),
        };
        return buildQuickWinCandidate(enriched, c15, c5, cScalp);
      })
    );

    const quickWins = scored
      .filter((w): w is NonNullable<typeof w> => w != null)
      .sort((a, b) => b.quickWinScore - a.quickWinScore)
      .slice(0, 10);

    return NextResponse.json({
      success: true,
      quickWins,
      disclaimer:
        "Quick Wins only lists symbols where Run Agent finds a LONG or SHORT on the 5 min timeframe (tight 5m/15m range + valid entry zone). A longer timeframe (e.g. 30m) can still show NO ENTRY if price is mid-range on that window. Not financial advice.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Quick Wins scan failed";
    console.error("nova-scalp-agent quick-wins:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
