import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { runNovaFiveMinsAnalysis } from "@/lib/ai-nova-five-mins";
import type { NovaFiveMinsTradeCycleContext } from "@/lib/ai-nova-five-mins";
import {
  anchorOpenForTimestamp,
  benchmarkOpenForHorizon,
  buildTradeCycleDeepStats,
  fetchBinance1mKlinesWithMeta,
  inferTapeRegimeFromBars,
  klineLimitForHorizon,
  klineLimitForTradeCycle,
  normalizeNovaFiveMinsHorizon,
  resolveBinanceSpotPair,
  summarizeBarsForPrompt,
} from "@/lib/nova-five-mins-spot";
import { getPolymarketFiveMinsAccess } from "@/lib/polymarket-five-mins-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

const CYCLE_MIN_MS = 4 * 60 * 1000;
const CYCLE_MAX_MS = 6 * 60 * 1000 + 30_000;

function parseTradeCycle(body: unknown): { startedAt: string; endsAt: string } | null {
  if (!body || typeof body !== "object") return null;
  const tc = (body as { tradeCycle?: unknown }).tradeCycle;
  if (!tc || typeof tc !== "object") return null;
  const startedAt = new Date(String((tc as { startedAt?: unknown }).startedAt ?? ""));
  const endsAt = new Date(String((tc as { endsAt?: unknown }).endsAt ?? ""));
  if (!Number.isFinite(startedAt.getTime()) || !Number.isFinite(endsAt.getTime())) return null;
  if (endsAt.getTime() <= startedAt.getTime()) return null;
  const dur = endsAt.getTime() - startedAt.getTime();
  if (dur < CYCLE_MIN_MS || dur > CYCLE_MAX_MS) return null;
  return { startedAt: startedAt.toISOString(), endsAt: endsAt.toISOString() };
}

/** POST — AI lean Up/Down for selected horizon (Binance context; not Polymarket oracle). */
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

    const tradeCycleParsed = parseTradeCycle(body);
    const now = Date.now();

    if (tradeCycleParsed) {
      const endMs = new Date(tradeCycleParsed.endsAt).getTime();
      if (now > endMs + 8 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: "That trade cycle ended too long ago. Start a new 5-minute cycle." },
          { status: 400 }
        );
      }
    }

    let horizonMinutes = normalizeNovaFiveMinsHorizon(body.horizonMinutes ?? body.timeframeMinutes);
    if (tradeCycleParsed) horizonMinutes = 5;

    const pair = resolveBinanceSpotPair(raw);
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "Could not map that to a Binance USDT spot pair. Try BTC, ETH, SOL, etc." },
        { status: 400 }
      );
    }

    const kLimit = tradeCycleParsed ? klineLimitForTradeCycle() : klineLimitForHorizon(horizonMinutes);
    const { bars, meta } = await fetchBinance1mKlinesWithMeta(pair, kLimit);
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
    let facts = summarizeBarsForPrompt(bars, pair, feed, horizonMinutes);

    let benchmarkOpen: number | null = benchmarkOpenForHorizon(bars, horizonMinutes);
    if (benchmarkOpen == null && !tradeCycleParsed) {
      return NextResponse.json(
        {
          success: false,
          error: `Not enough candle history for a ${horizonMinutes}-minute window yet. Pick a shorter horizon or retry in a minute.`,
        },
        { status: 400 }
      );
    }

    let cycleContext: NovaFiveMinsTradeCycleContext | null = null;
    let tradeCycleResponse: {
      startedAt: string;
      endsAt: string;
      anchorOpen: number | null;
      secondsRemaining: number;
      active: boolean;
    } | null = null;

    if (tradeCycleParsed) {
      const startMs = new Date(tradeCycleParsed.startedAt).getTime();
      const endMs = new Date(tradeCycleParsed.endsAt).getTime();
      if (now < startMs - 120_000) {
        return NextResponse.json({ success: false, error: "Trade cycle start time is too far in the future." }, { status: 400 });
      }

      const anchorOpen = anchorOpenForTimestamp(bars, startMs);
      if (anchorOpen == null) {
        return NextResponse.json(
          { success: false, error: "Could not resolve anchor price for this cycle on the loaded candles." },
          { status: 400 }
        );
      }

      benchmarkOpen = anchorOpen;
      const nowCapped = Math.min(now, endMs);
      const deep = buildTradeCycleDeepStats(bars, startMs, anchorOpen, nowCapped);
      facts = `${facts}\n\n${deep}`;

      const secondsRemaining = Math.max(0, Math.floor((endMs - now) / 1000));
      cycleContext = {
        startedAtIso: tradeCycleParsed.startedAt,
        endsAtIso: tradeCycleParsed.endsAt,
        secondsRemaining,
        anchorOpen,
      };
      tradeCycleResponse = {
        startedAt: tradeCycleParsed.startedAt,
        endsAt: tradeCycleParsed.endsAt,
        anchorOpen,
        secondsRemaining,
        active: now < endMs,
      };
    }

    const ai = await runNovaFiveMinsAnalysis(
      facts,
      pair.replace("USDT", ""),
      horizonMinutes,
      cycleContext
    );

    const lastClose = bars[bars.length - 1]?.close ?? null;
    const lookback = Math.min(60, Math.max(15, horizonMinutes));
    const heuristicRegime = inferTapeRegimeFromBars(bars, lookback);
    const tapeRegime = ai.tapeRegime === "mixed" ? heuristicRegime : ai.tapeRegime;

    let alignedWithSignal = false;
    if (
      lastClose != null &&
      Number.isFinite(lastClose) &&
      benchmarkOpen != null &&
      Number.isFinite(benchmarkOpen) &&
      (ai.direction === "Up" || ai.direction === "Down")
    ) {
      if (ai.direction === "Up") alignedWithSignal = lastClose >= benchmarkOpen;
      else alignedWithSignal = lastClose <= benchmarkOpen;
    }

    const confidenceScore = Math.min(100, Math.max(0, Math.round(ai.confidencePct)));

    return NextResponse.json({
      success: true,
      pair,
      symbolInput: raw,
      horizonMinutes,
      lastClose,
      benchmarkOpen,
      alignedWithSignal,
      feed,
      confidenceScore,
      tradeCycle: tradeCycleResponse,
      canSubmitOwnerFeedback: isOwnerSession(session),
      dataSourceNote:
        feed === "binance_futures"
          ? "Context uses Binance USDT-M futures 1m candles (spot API was unreachable). Polymarket Up/Down markets typically resolve on Chainlink — prices and window times can differ."
          : "Context uses Binance spot 1m candles. Polymarket Up/Down markets typically resolve on Chainlink streams — prices and exact window opens can differ from Binance.",
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
