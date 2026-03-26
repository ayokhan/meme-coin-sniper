import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getCandles, getTicker } from "@/lib/hyperliquid";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type RiskProfitPreset = "low_low" | "low_medium" | "medium_medium" | "high_high";
type DurationMode =
  | "long_term"
  | "short_term"
  | "scalp"
  | "swing"
  | "hybrid_scalp_swing"
  | "hybrid_short_long";

type DurationId =
  | "1w"
  | "2w"
  | "1m"
  | "2m"
  | "1d"
  | "2d"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "8h"
  | "24h"
  | "48h"
  | "72h";

type CandleWindow = {
  id: DurationId;
  label: string;
  interval: string; // Hyperliquid interval
  limit: number;
};

const LONG_WINDOWS: CandleWindow[] = [
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "1m", label: "1 month", interval: "1d", limit: 30 },
  { id: "2m", label: "2 months", interval: "1d", limit: 60 },
];

const SHORT_WINDOWS: CandleWindow[] = [
  { id: "1d", label: "1 day", interval: "1h", limit: 24 },
  { id: "2d", label: "2 days", interval: "1h", limit: 48 },
];

const SCALP_WINDOWS: CandleWindow[] = [
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "5m", limit: 12 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
];

const SWING_WINDOWS: CandleWindow[] = [
  { id: "1h", label: "1 hour", interval: "5m", limit: 12 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "15m", limit: 16 },
  { id: "8h", label: "8 hours", interval: "30m", limit: 16 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
];

const ALL_WINDOWS: CandleWindow[] = [...LONG_WINDOWS, ...SHORT_WINDOWS, ...SCALP_WINDOWS, ...SWING_WINDOWS];

type CandleTuple = [string, string, string, string, string, ...string[]];

type StrategyLegCoin = {
  symbol: string;
  allocationPct: number;
  direction: "long" | "short";
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLossPrice: number;
  takeProfitPrice: number;
};

type StrategyLeg = {
  legType: "scalp" | "swing" | "long" | "short";
  durationLabel: string;
  timeframeId: string;
  direction: "long" | "short";
  leverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  expectedReturnPctOnMargin: number;
  expectedReturnUsdOnLeg: number;
  entryPlan: string;
  exitPlan: string;
  coins: StrategyLegCoin[];
  notes?: string[];
};

type NovaInvestmentAgentResult = {
  baseSymbol: string;
  amountUsd: number;
  riskProfitPreset: RiskProfitPreset;
  durationMode: DurationMode;
  totalExpectedReturnPct: number;
  totalExpectedReturnUsd: number;
  legs: StrategyLeg[];
  overallNote?: string;
};

function normalizeSymbol(raw: string): string {
  const upper = String(raw ?? "").trim().toUpperCase();
  if (!upper) return "BTC";
  // Normalize BTC/USDT, BTC-USDT, BTC.USDT -> BTC
  return upper.replace(/\/USDT$/i, "").replace(/\/USD$/i, "").replace(/-USDT$/i, "").replace(/\.USDT$/i, "").trim() || upper;
}

function highLowFromCandles(candles: CandleTuple[]): { high: number; low: number } | null {
  if (!candles.length) return null;
  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

function getTfDirection(candles: CandleTuple[]): "bullish" | "bearish" | "sideways" {
  if (candles.length < 5) return "sideways";
  const closesNewestFirst = candles.map((c) => Number(c[4])).filter((n) => Number.isFinite(n));
  if (closesNewestFirst.length < 5) return "sideways";

  // candles are newest first in this codebase convention
  const closes = [...closesNewestFirst].reverse(); // oldest -> newest
  const mid = Math.floor(closes.length / 2);
  const first = closes.slice(0, mid);
  const second = closes.slice(mid);
  if (first.length === 0 || second.length === 0) return "sideways";

  const avg = (arr: number[]) => arr.reduce((sum, n) => sum + n, 0) / arr.length;
  const firstAvg = avg(first);
  const secondAvg = avg(second);
  if (!Number.isFinite(firstAvg) || !Number.isFinite(secondAvg) || firstAvg <= 0) return "sideways";

  const pct = (secondAvg - firstAvg) / firstAvg;
  if (pct > 0.0025) return "bullish";
  if (pct < -0.0025) return "bearish";
  return "sideways";
}

function mapRiskPreset(preset: RiskProfitPreset): { leverage: number; stopLossPct: number; takeProfitPct: number; highVolAllocPct: number } {
  if (preset === "low_low") return { leverage: 3, stopLossPct: 1.0, takeProfitPct: 2.0, highVolAllocPct: 0 };
  if (preset === "low_medium") return { leverage: 4, stopLossPct: 1.2, takeProfitPct: 3.5, highVolAllocPct: 10 };
  if (preset === "medium_medium") return { leverage: 7, stopLossPct: 1.8, takeProfitPct: 5.0, highVolAllocPct: 15 };
  return { leverage: 12, stopLossPct: 2.5, takeProfitPct: 8.0, highVolAllocPct: 20 };
}

function chooseDirectionFromMarketStructure(tfDir: "bullish" | "bearish" | "sideways", currentPrice: number, support: number, resistance: number): "long" | "short" {
  if (tfDir === "bullish") return "long";
  if (tfDir === "bearish") return "short";
  const mid = (support + resistance) / 2;
  return currentPrice >= mid ? "short" : "long";
}

function buildLegCoins(params: {
  baseSymbol: string;
  legDirection: "long" | "short";
  candidateSymbols: string[];
  highVolatileCoinSymbols: string[];
  highVolAllocPct: number;
  leverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  amountUsd: number;
  legEntryZone: { support: number; resistance: number; entryZoneLow: number; entryZoneHigh: number; direction: "long" | "short" };
  candlesPerCoin: Record<string, CandleTuple[]>;
  tickerPerCoin: Record<string, { last: string } | null>;
}) {
  const {
    baseSymbol,
    legDirection,
    candidateSymbols,
    highVolatileCoinSymbols,
    highVolAllocPct,
    leverage,
    stopLossPct,
    takeProfitPct,
    amountUsd,
    candlesPerCoin,
    tickerPerCoin,
  } = params;

  const coinDirections: Record<string, { dir: "long" | "short"; support: number; resistance: number; currentPrice: number }> = {};
  for (const sym of candidateSymbols) {
    const candles = candlesPerCoin[sym];
    const hl = candles ? highLowFromCandles(candles) : null;
    const ticker = tickerPerCoin[sym];
    const currentPrice = ticker?.last != null && Number.isFinite(Number(ticker.last)) ? Number(ticker.last) : null;
    if (!candles || !hl || currentPrice == null) continue;
    const tfDir = getTfDirection(candles);
    const dir = chooseDirectionFromMarketStructure(tfDir, currentPrice, hl.low, hl.high);
    coinDirections[sym] = { dir, support: hl.low, resistance: hl.high, currentPrice };
  }

  const base = coinDirections[baseSymbol];
  const pool = Object.keys(coinDirections).filter((s) => s !== baseSymbol);
  const matching = pool.filter((s) => coinDirections[s]?.dir === legDirection);
  const nonMatching = pool.filter((s) => coinDirections[s]?.dir !== legDirection);

  const pickOrder = (arr: string[]) => {
    // Pick the closest to entry risk side to get a better expectation (simple heuristic).
    const scored = arr
      .map((sym) => {
        const d = coinDirections[sym];
        if (!d) return null;
        const mid = (d.support + d.resistance) / 2;
        const distPct = d.currentPrice > 0 ? Math.abs((d.currentPrice - mid) / d.currentPrice) : 0;
        return { sym, distPct };
      })
      .filter(Boolean) as Array<{ sym: string; distPct: number }>;
    scored.sort((a, b) => b.distPct - a.distPct);
    return scored.map((s) => s.sym);
  };

  const bestMatches = pickOrder(matching);
  const fallbacks = pickOrder(nonMatching);

  const coinsChosen: string[] = [];
  coinsChosen.push(baseSymbol);
  for (const sym of bestMatches) {
    if (coinsChosen.length >= 3) break;
    coinsChosen.push(sym);
  }
  for (const sym of fallbacks) {
    if (coinsChosen.length >= 3) break;
    coinsChosen.push(sym);
  }

  let highVolCoin: string | null = null;
  if (highVolAllocPct > 0) {
    const volPool = highVolatileCoinSymbols.filter((s) => s !== baseSymbol);
    const volMatching = volPool.filter((s) => coinDirections[s]?.dir === legDirection);
    highVolCoin = (volMatching[0] ?? volPool[0] ?? null) as string | null;
  }

  const finalCoins = [...new Set([baseSymbol, ...coinsChosen.slice(1), ...(highVolCoin ? [highVolCoin] : [])])];
  const allocation: Record<string, number> = {};

  if (highVolCoin && finalCoins.includes(highVolCoin) && highVolAllocPct > 0) {
    allocation[highVolCoin] = highVolAllocPct;
  }

  const remainingPct = 100 - Object.values(allocation).reduce((sum, n) => sum + n, 0);
  const restCoins = finalCoins.filter((s) => allocation[s] == null);
  const per = restCoins.length > 0 ? remainingPct / restCoins.length : 0;
  for (const s of restCoins) allocation[s] = per;

  const coins: StrategyLegCoin[] = [];
  for (const sym of finalCoins) {
    const d = coinDirections[sym];
    if (!d) continue;
    const entryZoneLow = legDirection === "long" ? d.support * (1 + 0.002) : d.resistance * (1 - 0.002);
    const entryZoneHigh = legDirection === "long" ? d.support * (1 + 0.006) : d.resistance * (1 - 0.006);
    const stopLossPrice = legDirection === "long" ? entryZoneLow * (1 - stopLossPct / 100) : entryZoneLow * (1 + stopLossPct / 100);
    const takeProfitPrice = legDirection === "long" ? entryZoneHigh * (1 + takeProfitPct / 100) : entryZoneHigh * (1 - takeProfitPct / 100);

    coins.push({
      symbol: sym,
      allocationPct: allocation[sym] ?? 0,
      direction: legDirection,
      entryZoneLow: Math.min(entryZoneLow, entryZoneHigh),
      entryZoneHigh: Math.max(entryZoneLow, entryZoneHigh),
      stopLossPrice,
      takeProfitPrice,
    });
  }

  const notes: string[] = [];
  if (highVolCoin && highVolAllocPct > 0) {
    notes.push(`Included a high-volatility coin (${highVolCoin}) for upside in ${legDirection === "long" ? "bull" : "bear"} conditions.`);
  }

  return { coins, notes };
}

function getWindow(mode: DurationMode, windowId: DurationId): CandleWindow | null {
  const allowed = mode === "long_term" ? LONG_WINDOWS : mode === "short_term" ? SHORT_WINDOWS : mode === "scalp" ? SCALP_WINDOWS : mode === "swing" ? SWING_WINDOWS : [];
  return (allowed.length ? allowed : ALL_WINDOWS).find((w) => w.id === windowId) ?? null;
}

export async function POST(request: Request) {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_NOVA_INVESTMENT_AGENT);
  if (!enabled) {
    return NextResponse.json({ success: false, error: "Nova Investment Agent is temporarily disabled.", locked: true }, { status: 403 });
  }

  try {
    const { tier } = await getSessionAndSubscription();
    if (tier !== "vip") {
      return NextResponse.json({ success: false, error: "Nova Investment Agent is for VIP subscribers.", locked: true }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const amountUsdRaw = body.amountUsd ?? body.amount ?? body.investmentAmount;
    const baseSymbol = normalizeSymbol(String(body.baseSymbol ?? body.symbol ?? "BTC"));
    const riskProfitPreset: RiskProfitPreset = body.riskProfitPreset ?? body.risk_profile ?? "low_medium";
    const durationMode: DurationMode = body.durationMode ?? body.duration_mode ?? "short_term";

    const amountUsd = Number(amountUsdRaw);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      return NextResponse.json({ success: false, error: "Enter a valid investment amount (USD)." }, { status: 400 });
    }

    const candidateMajors = Array.from(new Set([baseSymbol, "BTC", "ETH", "SOL", "AVAX", "LINK", "UNI", "DOGE"]));
    const highVolatile = Array.from(new Set(["DOGE", "AVAX", "UNI", "SOL", "SHIB", "PEPE", "APT"])).filter((s) => s !== baseSymbol);

    const { leverage, stopLossPct, takeProfitPct, highVolAllocPct } = mapRiskPreset(riskProfitPreset as RiskProfitPreset);

    const buildLegFromWindow = async (legType: StrategyLeg["legType"], window: CandleWindow, legUsd: number) => {
      const [candlesBase, tickerBase] = await Promise.all([getCandles(baseSymbol, window.interval, window.limit), getTicker(baseSymbol)]);
      const hl = highLowFromCandles(candlesBase as CandleTuple[]);
      const currentPrice = tickerBase?.last != null && Number.isFinite(Number(tickerBase.last)) ? Number(tickerBase.last) : null;

      if (!hl || currentPrice == null || !Number.isFinite(currentPrice)) {
        return {
          legType,
          durationLabel: window.label,
          timeframeId: window.id,
          direction: "long" as const,
          leverage,
          stopLossPct,
          takeProfitPct,
          expectedReturnPctOnMargin: leverage * takeProfitPct,
          expectedReturnUsdOnLeg: 0,
          entryPlan: "No candle data available for this timeframe. Try another symbol/timeframe.",
          exitPlan: "—",
          coins: [],
          notes: ["Missing candle/ticker data."],
        } satisfies StrategyLeg;
      }

      const tfDir = getTfDirection(candlesBase as CandleTuple[]);
      const legDirection = chooseDirectionFromMarketStructure(tfDir, currentPrice, hl.low, hl.high);

      const candidateSymbols = Array.from(new Set([baseSymbol, ...candidateMajors])).slice(0, 6);
      const candlesPerCoin: Record<string, CandleTuple[]> = {};
      const tickerPerCoin: Record<string, { last: string } | null> = {};

      await Promise.all(
        candidateSymbols.map(async (sym) => {
          const [c, t] = await Promise.all([getCandles(sym, window.interval, window.limit), getTicker(sym)]);
          candlesPerCoin[sym] = (c ?? []) as CandleTuple[];
          tickerPerCoin[sym] = t;
        })
      );

      const { coins, notes } = buildLegCoins({
        baseSymbol,
        legDirection,
        candidateSymbols,
        highVolatileCoinSymbols: highVolatile,
        highVolAllocPct,
        leverage,
        stopLossPct,
        takeProfitPct,
        amountUsd: legUsd,
        legEntryZone: {
          support: hl.low,
          resistance: hl.high,
          entryZoneLow: legDirection === "long" ? hl.low * 1.002 : hl.high * 0.998,
          entryZoneHigh: legDirection === "long" ? hl.low * 1.006 : hl.high * 0.994,
          direction: legDirection,
        },
        candlesPerCoin,
        tickerPerCoin,
      });

      // Futures approximation: expected return on margin ~ leverage * takeProfitPct
      const expectedReturnPctOnMargin = leverage * takeProfitPct;
      const expectedReturnUsdOnLeg = (legUsd * expectedReturnPctOnMargin) / 100;

      const directionTxt = legDirection === "long" ? "Long" : "Short";
      const entryZoneTxt = legDirection === "long" ? `pullback to support zone (${hl.low.toFixed(4)} … ${(hl.low * 1.006).toFixed(4)})` : `retest of resistance zone (${(hl.high * 0.994).toFixed(4)} … ${hl.high.toFixed(4)})`;
      const stopLossTxt = legDirection === "long" ? `stop below support (${(hl.low * (1 - stopLossPct / 100)).toFixed(4)})` : `stop above resistance (${(hl.high * (1 + stopLossPct / 100)).toFixed(4)})`;
      const takeProfitTxt = legDirection === "long" ? `take profit near ${takeProfitPct}% move` : `take profit near ${takeProfitPct}% move`;

      return {
        legType,
        durationLabel: window.label,
        timeframeId: window.id,
        direction: legDirection,
        leverage,
        stopLossPct,
        takeProfitPct,
        expectedReturnPctOnMargin,
        expectedReturnUsdOnLeg,
        entryPlan: `${directionTxt} entry: wait for ${baseSymbol} price to ${entryZoneTxt}.`,
        exitPlan: `Exit plan: ${takeProfitTxt}; ${stopLossTxt}. If neither hits within the selected timeframe, close/rotate.`,
        coins,
        notes: notes.length ? notes : undefined,
      } satisfies StrategyLeg;
    };

    const amountForLegs = (legSplitsPct: { scalpUsdPct: number; swingUsdPct: number } | null) => {
      if (!legSplitsPct) return null;
      return {
        leg1Usd: (amountUsd * legSplitsPct.scalpUsdPct) / 100,
        leg2Usd: (amountUsd * legSplitsPct.swingUsdPct) / 100,
      };
    };

    let legs: StrategyLeg[] = [];

    if (durationMode === "long_term") {
      const id = String(body.longTermId ?? body.durationId ?? "2w") as DurationId;
      const window = LONG_WINDOWS.find((w) => w.id === id) ?? LONG_WINDOWS[1];
      legs = [await buildLegFromWindow("long", window, amountUsd)];
    } else if (durationMode === "short_term") {
      const id = String(body.shortTermId ?? body.durationId ?? "1d") as DurationId;
      const window = SHORT_WINDOWS.find((w) => w.id === id) ?? SHORT_WINDOWS[0];
      legs = [await buildLegFromWindow("short", window, amountUsd)];
    } else if (durationMode === "scalp") {
      const id = String(body.scalpId ?? body.durationId ?? "15m") as DurationId;
      const window = SCALP_WINDOWS.find((w) => w.id === id) ?? SCALP_WINDOWS[1];
      legs = [await buildLegFromWindow("scalp", window, amountUsd)];
    } else if (durationMode === "swing") {
      const id = String(body.swingId ?? body.durationId ?? "4h") as DurationId;
      const window = SWING_WINDOWS.find((w) => w.id === id) ?? SWING_WINDOWS[2];
      legs = [await buildLegFromWindow("swing", window, amountUsd)];
    } else if (durationMode === "hybrid_scalp_swing") {
      const scalpId = String(body.scalpId ?? "15m") as DurationId;
      const swingId = String(body.swingId ?? "24h") as DurationId;
      const scalpSplitPct = Math.max(0, Math.min(100, Number(body.scalpSplitPct ?? 50)));
      const swingSplitPct = 100 - scalpSplitPct;

      const scalpWindow = SCALP_WINDOWS.find((w) => w.id === scalpId) ?? SCALP_WINDOWS[1];
      const swingWindow = SWING_WINDOWS.find((w) => w.id === swingId) ?? SWING_WINDOWS[4];

      const leg1Usd = (amountUsd * scalpSplitPct) / 100;
      const leg2Usd = (amountUsd * swingSplitPct) / 100;

      legs = [
        await buildLegFromWindow("scalp", scalpWindow, leg1Usd),
        await buildLegFromWindow("swing", swingWindow, leg2Usd),
      ];
    } else if (durationMode === "hybrid_short_long") {
      const shortId = String(body.shortId ?? "1d") as DurationId;
      const longId = String(body.longId ?? "2w") as DurationId;
      const shortSplitPct = Math.max(0, Math.min(100, Number(body.shortSplitPct ?? 50)));
      const longSplitPct = 100 - shortSplitPct;

      const shortWindow = SHORT_WINDOWS.find((w) => w.id === shortId) ?? SHORT_WINDOWS[0];
      const longWindow = LONG_WINDOWS.find((w) => w.id === longId) ?? LONG_WINDOWS[1];

      const leg1Usd = (amountUsd * shortSplitPct) / 100;
      const leg2Usd = (amountUsd * longSplitPct) / 100;

      legs = [
        await buildLegFromWindow("short", shortWindow, leg1Usd),
        await buildLegFromWindow("long", longWindow, leg2Usd),
      ];
    } else {
      return NextResponse.json({ success: false, error: "Invalid durationMode." }, { status: 400 });
    }

    const totalExpectedReturnUsd = legs.reduce((sum, l) => sum + (l.expectedReturnUsdOnLeg ?? 0), 0);
    const totalExpectedReturnPct = amountUsd > 0 ? (totalExpectedReturnUsd / amountUsd) * 100 : 0;

    return NextResponse.json({
      success: true,
      result: {
        baseSymbol,
        amountUsd,
        riskProfitPreset,
        durationMode,
        totalExpectedReturnPct,
        totalExpectedReturnUsd,
        legs,
        overallNote:
          "This is a strategy suggestion (not financial advice). Use it as a checklist for your own execution and risk limits.",
      } satisfies NovaInvestmentAgentResult,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nova Investment Agent failed";
    console.error("Nova Investment Agent error:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

