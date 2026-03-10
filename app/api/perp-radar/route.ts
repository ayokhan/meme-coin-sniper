import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getBinancePerpRadar } from "@/lib/api-clients/binance-perps";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** GET - Perp Radar: extreme movers across supported exchanges (Binance USDT futures first). */
export async function GET(request: Request) {
  try {
    const { isPaid } = await getSessionAndSubscription();
    if (!isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to access Perp Radar.", locked: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const minChangePct = Number(searchParams.get("minChangePct") ?? "100");
    const minQuoteVolume = Number(searchParams.get("minQuoteVolume") ?? "5000000");
    const limit = Number(searchParams.get("limit") ?? "100");

    const binance = await getBinancePerpRadar({
      minChangePct: Number.isFinite(minChangePct) ? minChangePct : 100,
      minQuoteVolume: Number.isFinite(minQuoteVolume) ? minQuoteVolume : 5_000_000,
      limit: Number.isFinite(limit) ? limit : 100,
    });

    return NextResponse.json({
      success: true,
      items: binance,
      exchanges: ["binance"],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Perp Radar failed";
    console.error("Perp Radar error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

