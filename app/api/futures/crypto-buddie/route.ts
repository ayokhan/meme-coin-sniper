import { NextResponse } from "next/server";
import { getPerpsByCoins, TOP_ALTCOINS, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCryptoBuddieAccess } from "@/lib/vip-futures-addon-access";
import { meanRangePct, rankBuddy, type CryptoBuddieRow } from "@/lib/crypto-buddie-score";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function candlePct(candles: Array<[string, string, string, string, string, ...string[]]>, fallback: number): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

const DISCLAIMER =
  "Crypto Buddie ranks Hyperliquid perps using heuristics (liquidity, short-term alignment, recent 15m range tightness). It is not a promise that support/resistance will hold for 1–4 hours. Memecoin monitor uses the same AI token scan as NovaStaris AI Agent—not financial advice.";

/** VIP + flag: Top-altcoins-style table with scalp-style scores; optional ?focus=BTC for one row. */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getCryptoBuddieAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.error, locked: access.status === 403, disabled: access.disabled },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const focusRaw = searchParams.get("focus")?.trim().toUpperCase() ?? "";

    const perps = await getPerpsByCoins(TOP_ALTCOINS);
    const rows: CryptoBuddieRow[] = await Promise.all(
      perps.map(async (p) => {
        const [c5, c15, c30, c1h, c4h, c48h, c72h, c1w, c2w, c3w, c4w, c15series] = await Promise.all([
          getCandles(p.coin, "5m", 1),
          getCandles(p.coin, "15m", 1),
          getCandles(p.coin, "30m", 1),
          getCandles(p.coin, "1h", 1),
          getCandles(p.coin, "4h", 1),
          getCandles(p.coin, "1h", 48),
          getCandles(p.coin, "1h", 72),
          getCandles(p.coin, "1d", 7),
          getCandles(p.coin, "1d", 14),
          getCandles(p.coin, "1d", 21),
          getCandles(p.coin, "1d", 28),
          getCandles(p.coin, "15m", 8),
        ]);
        const enriched: TrendingPerp = {
          ...p,
          pct5m: candlePct(c5, p.dayPct),
          pct15m: candlePct(c15, p.dayPct),
          pct30m: candlePct(c30, p.dayPct),
          pct1h: candlePct(c1h, p.dayPct),
          pct4h: candlePct(c4h, p.dayPct),
          pct48h: candlePct(c48h, p.dayPct),
          pct72h: candlePct(c72h, p.dayPct),
          pct1w: candlePct(c1w, p.dayPct),
          pct2w: candlePct(c2w, p.dayPct),
          pct3w: candlePct(c3w, p.dayPct),
          pct4w: candlePct(c4w, p.dayPct),
        };
        const rangePct = meanRangePct(c15series);
        const meta = rankBuddy(enriched, rangePct);
        return {
          ...enriched,
          buddyScore: meta.buddyScore,
          stability: meta.stability,
          stabilityNote: meta.stabilityNote,
          directionHint: meta.directionHint,
          rangePct15m: rangePct,
        };
      })
    );

    rows.sort((a, b) => b.buddyScore - a.buddyScore);

    let focus: CryptoBuddieRow | null = null;
    if (focusRaw) {
      focus = rows.find((r) => r.coin.toUpperCase() === focusRaw) ?? null;
      if (!focus) {
        const single = await getPerpsByCoins([focusRaw]);
        if (single[0]) {
          const p = single[0];
          const [c5, c15, c30, c1h, c4h, c48h, c72h, c1w, c2w, c3w, c4w, c15series] = await Promise.all([
            getCandles(p.coin, "5m", 1),
            getCandles(p.coin, "15m", 1),
            getCandles(p.coin, "30m", 1),
            getCandles(p.coin, "1h", 1),
            getCandles(p.coin, "4h", 1),
            getCandles(p.coin, "1h", 48),
            getCandles(p.coin, "1h", 72),
            getCandles(p.coin, "1d", 7),
            getCandles(p.coin, "1d", 14),
            getCandles(p.coin, "1d", 21),
            getCandles(p.coin, "1d", 28),
            getCandles(p.coin, "15m", 8),
          ]);
          const enriched: TrendingPerp = {
            ...p,
            pct5m: candlePct(c5, p.dayPct),
            pct15m: candlePct(c15, p.dayPct),
            pct30m: candlePct(c30, p.dayPct),
            pct1h: candlePct(c1h, p.dayPct),
            pct4h: candlePct(c4h, p.dayPct),
            pct48h: candlePct(c48h, p.dayPct),
            pct72h: candlePct(c72h, p.dayPct),
            pct1w: candlePct(c1w, p.dayPct),
            pct2w: candlePct(c2w, p.dayPct),
            pct3w: candlePct(c3w, p.dayPct),
            pct4w: candlePct(c4w, p.dayPct),
          };
          const rangePct = meanRangePct(c15series);
          const meta = rankBuddy(enriched, rangePct);
          focus = {
            ...enriched,
            buddyScore: meta.buddyScore,
            stability: meta.stability,
            stabilityNote: meta.stabilityNote,
            directionHint: meta.directionHint,
            rangePct15m: rangePct,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      disclaimer: DISCLAIMER,
      rows,
      focus,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crypto Buddie failed";
    console.error("crypto-buddie:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
