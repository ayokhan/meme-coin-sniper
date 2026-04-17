import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runNovaFiveMinsAnalysis } from "@/lib/ai-nova-five-mins";
import {
  fetchBinance1mKlinesWithMeta,
  inferTapeRegimeFromBars,
  resolveBinanceSpotPair,
  summarizeBarsForPrompt,
} from "@/lib/nova-five-mins-spot";
import { getPolymarketFiveMinsAccess } from "@/lib/polymarket-five-mins-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/** POST — AI lean Up/Down for short horizon (Binance spot context; not Polymarket oracle). */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getPolymarketFiveMinsAccess(session);
    if (!access.ok) {
      return NextResponse.json(
        {
          success: false,
          error: access.error,
          disabled: access.disabled,
          fiveMinsDisabled: access.fiveMinsDisabled,
        },
        { status: access.status }
      );
    }

    const body = await request.json().catch(() => ({}));
    const raw = String(body.symbol ?? body.contract ?? "").trim();
    if (!raw) {
      return NextResponse.json({ success: false, error: "Enter a symbol (e.g. BTC, ETH, SOL)." }, { status: 400 });
    }

    const pair = resolveBinanceSpotPair(raw);
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "Could not map that to a Binance USDT spot pair. Try BTC, ETH, SOL, etc." },
        { status: 400 }
      );
    }

    const { bars, meta } = await fetchBinance1mKlinesWithMeta(pair, 48);
    if (!bars.length) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not load 1m candles from Binance (spot mirrors and futures fallback all failed). This is often a temporary network or regional block — try again in a moment.",
        },
        { status: 502 }
      );
    }

    const feed = meta?.feed ?? "binance_spot";
    const facts = summarizeBarsForPrompt(bars, pair, feed);
    const ai = await runNovaFiveMinsAnalysis(facts, pair.replace("USDT", ""));

    const lastClose = bars[bars.length - 1]?.close ?? null;
    const benchmarkOpen5m = bars.length >= 5 ? bars[bars.length - 5]!.open : bars[0]!.open;
    const heuristicRegime = inferTapeRegimeFromBars(bars);
    const tapeRegime = ai.tapeRegime === "mixed" ? heuristicRegime : ai.tapeRegime;

    let alignedWithSignal = false;
    if (
      lastClose != null &&
      Number.isFinite(lastClose) &&
      Number.isFinite(benchmarkOpen5m) &&
      (ai.direction === "Up" || ai.direction === "Down")
    ) {
      if (ai.direction === "Up") alignedWithSignal = lastClose >= benchmarkOpen5m;
      else alignedWithSignal = lastClose <= benchmarkOpen5m;
    }

    return NextResponse.json({
      success: true,
      pair,
      symbolInput: raw,
      lastClose,
      benchmarkOpen5m,
      alignedWithSignal,
      dataSourceNote:
        feed === "binance_futures"
          ? "Context uses Binance USDT-M futures 1m candles (spot API was unreachable). Polymarket 5m markets typically resolve on Chainlink — prices can differ."
          : "Context uses Binance spot 1m candles. Polymarket 5m crypto markets (e.g. Bitcoin Up or Down) typically resolve on Chainlink streams — prices can differ from Binance.",
      polymarketStyleUrl: "https://polymarket.com/crypto",
      ...ai,
      tapeRegime,
    });
  } catch (e) {
    console.error("polymarket-five-mins/analyze:", e);
    const message = e instanceof Error ? e.message : "Analysis failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
