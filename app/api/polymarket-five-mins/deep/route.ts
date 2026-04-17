import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runNovaFiveMinsDeepAnalysis, type NovaDeepSource } from "@/lib/ai-nova-five-mins-deep";
import {
  fetchBinance1mKlinesWithMeta,
  inferTapeRegimeFromBars,
  klineLimitForTradeCycle,
  nextEpochFiveMinuteUtcMs,
  resolveBinanceSpotPair,
  summarizeBarsForPrompt,
} from "@/lib/nova-five-mins-spot";
import { getPolymarketFiveMinsAccess } from "@/lib/polymarket-five-mins-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/** POST — Nova Deep: next-cycle entry timing + lean (Binance context only). */
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
      return NextResponse.json({ success: false, error: "Enter a symbol (e.g. BTC)." }, { status: 400 });
    }

    const sourceRaw = String(body.source ?? "nova_deep").toLowerCase();
    const source: NovaDeepSource = sourceRaw === "post_cycle" ? "post_cycle" : "nova_deep";
    const cycleEndedAtIso =
      typeof body.cycleEndedAt === "string" && body.cycleEndedAt.trim() ? body.cycleEndedAt.trim() : null;

    const pair = resolveBinanceSpotPair(raw);
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "Could not map that to a Binance USDT spot pair." },
        { status: 400 }
      );
    }

    const { bars, meta } = await fetchBinance1mKlinesWithMeta(pair, klineLimitForTradeCycle());
    if (!bars.length) {
      return NextResponse.json(
        { success: false, error: "Could not load candles from Binance for Nova Deep." },
        { status: 502 }
      );
    }

    const feed = meta?.feed ?? "binance_spot";
    let facts = summarizeBarsForPrompt(bars, pair, feed, 5);
    if (source === "post_cycle" && cycleEndedAtIso) {
      facts = `${facts}\n\n--- POST_CYCLE ---\nUser 5m trade cycle ended at (client/server hint): ${cycleEndedAtIso}\n`;
    }

    const now = Date.now();
    const nextSlotMs = nextEpochFiveMinuteUtcMs(now);
    const nextCycleEntryUtcIso = new Date(nextSlotMs).toISOString();
    const secondsUntilNextSlot = Math.max(0, Math.floor((nextSlotMs - Date.now()) / 1000));

    const deep = await runNovaFiveMinsDeepAnalysis(facts, pair.replace("USDT", ""), {
      nextSlotUtcIso: nextCycleEntryUtcIso,
      secondsUntilNextSlot,
      source,
      cycleEndedAtIso,
    });

    const lookback = 30;
    const heuristicRegime = inferTapeRegimeFromBars(bars, lookback);
    const tapeRegime = deep.tapeRegime === "mixed" ? heuristicRegime : deep.tapeRegime;

    return NextResponse.json({
      success: true,
      source,
      pair,
      symbolInput: raw,
      nextCycleEntryUtcIso,
      secondsUntilNextSlot,
      timingRecommendation: deep.timingRecommendation,
      timingLabel:
        deep.timingRecommendation === "start_now"
          ? "Start next cycle now"
          : deep.timingRecommendation === "wait_for_boundary"
            ? `Wait for next UTC 5m slot (${nextCycleEntryUtcIso})`
            : "Wait for cleaner tape (may be past the next slot)",
      nextSlotNote: deep.nextSlotNote,
      directionLean: deep.directionLean,
      confidenceScore: Math.min(100, Math.max(0, Math.round(deep.confidencePct))),
      summary: deep.summary,
      factors: deep.factors,
      riskNote: deep.riskNote,
      tapeRegime,
      dataSourceNote:
        "Nova Deep uses Binance 1m context and UTC 5-minute epoch slots — not Polymarket’s Chainlink clock or ET window titles.",
    });
  } catch (e) {
    console.error("polymarket-five-mins/deep:", e);
    return NextResponse.json({ success: false, error: "Nova Deep failed." }, { status: 500 });
  }
}
