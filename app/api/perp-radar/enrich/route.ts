import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles } from "@/lib/hyperliquid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function hlCandlePct(candles: Array<[string, string, string, string, string, ...string[]]>): number | null {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return null;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : null;
}

/** GET - Enrich base symbols with 5m–4h % from Hyperliquid (for Perp Radar when Binance klines are blocked). Subscribers only. */
export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to access.", locked: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const basesParam = searchParams.get("bases");
    const bases = basesParam ? basesParam.split(",").map((b) => b.trim()).filter(Boolean).slice(0, 40) : [];

    if (bases.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    const data: Record<string, { pct5m: number | null; pct15m: number | null; pct30m: number | null; pct1h: number | null; pct4h: number | null }> = {};
    await Promise.all(
      bases.map(async (base) => {
        const [c5, c15, c30, c1h, c4h] = await Promise.all([
          getCandles(base, "5m", 1),
          getCandles(base, "15m", 1),
          getCandles(base, "30m", 1),
          getCandles(base, "1h", 1),
          getCandles(base, "4h", 1),
        ]);
        data[base] = {
          pct5m: hlCandlePct(c5),
          pct15m: hlCandlePct(c15),
          pct30m: hlCandlePct(c30),
          pct1h: hlCandlePct(c1h),
          pct4h: hlCandlePct(c4h),
        };
      })
    );

    return NextResponse.json({ success: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enrich failed";
    console.error("Perp Radar enrich error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
