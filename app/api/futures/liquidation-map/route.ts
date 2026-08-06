import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getPerpsByCoins, getTrendingPerps, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";
import {
  getBlofinMetalCandles,
  getBlofinMetalInstId,
  getBlofinMetalTrendingPerp,
  isBlofinMetal,
  normalizeMetalBase,
  type BlofinMetal,
} from "@/lib/blofin-metals";
import {
  getBlofinTrendingPerpBySymbol,
  getNovaScalpCandles,
} from "@/lib/nova-scalp-blofin-market";
import { buildLiquidationMapSuggestedPlan } from "@/lib/liquidation-map-plan";

type ClusterSide = "long_liq_below" | "short_liq_above";

type Cluster = {
  label: string;
  side: ClusterSide;
  price: number;
  distancePct: number;
  intensity: "low" | "medium" | "high";
  estimatedLiquidityUsd: number;
  reason: string;
};

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const first = upper.split(/[\/\-\s]/)[0] ?? upper;
  return first.replace(/[^A-Z0-9]/g, "");
}

function normalizeWithAliases(raw: string): { normalized: string; aliasUsed?: string } {
  const metal = normalizeMetalBase(raw);
  if (isBlofinMetal(metal)) {
    const token = normalizeSymbol(raw);
    const aliasUsed =
      token === "GOLD" || token === "SILVER" ? token : token !== metal ? token : undefined;
    return { normalized: metal, aliasUsed };
  }
  const s = normalizeSymbol(raw);
  return { normalized: s };
}

function fmtUsd(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function parseNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || from === 0 || !Number.isFinite(to)) return 0;
  return ((to - from) / from) * 100;
}

/**
 * Isolated USDT-perp approx liquidation (ignores fees / MMR nuances).
 * Long: price can fall ~1/lev before wipe; short: rise ~1/lev.
 */
function approxIsolatedLiquidationPrice(
  side: "long" | "short",
  entry: number,
  leverage: number
): { price: number; distancePct: number } | null {
  const lev = Number.isFinite(leverage) && leverage >= 1 ? leverage : 0;
  if (!(entry > 0) || lev < 1) return null;
  // Keep ~5% of 1/lev as maintenance/fee buffer so liq is slightly closer than theoretical.
  const moveFrac = Math.max(0.02, 0.95 / lev);
  const price = side === "long" ? entry * (1 - moveFrac) : entry * (1 + moveFrac);
  return { price, distancePct: Math.abs(pctChange(entry, price)) };
}

function scoreRrPoints(rrMultiple: number, rrValid: boolean, maxPts: number): number {
  if (!rrValid) return 0;
  if (rrMultiple >= 2.5) return maxPts;
  if (rrMultiple >= 2) return Math.round(maxPts * 0.87);
  if (rrMultiple >= 1.5) return Math.round(maxPts * 0.73);
  if (rrMultiple >= 1) return Math.round(maxPts * 0.53);
  if (rrMultiple >= 0.5) return Math.round(maxPts * 0.27);
  return 2;
}

/** Continuous liquidation/leverage pillar (0..maxPts). */
function scoreLiquidationPoints(input: {
  leverage: number;
  entry: number;
  traderType: "long" | "short";
  estLiq: { price: number; distancePct: number } | null;
  nearestRiskCluster: { price: number; distancePct: number } | null;
  maxPts: number;
}): { pts: number; risk: "low" | "medium" | "high"; detail: string } {
  const { leverage, entry, traderType, estLiq, nearestRiskCluster, maxPts } = input;
  const lev = Number.isFinite(leverage) && leverage >= 1 ? leverage : 10;
  const pocketDistPct = nearestRiskCluster
    ? Math.abs(pctChange(entry, nearestRiskCluster.price))
    : 99;

  let liqInsidePocket = false;
  if (estLiq && nearestRiskCluster) {
    if (traderType === "long") {
      // Long wiped if price falls to estLiq; pocket below entry — bad if liq is at/above pocket (hits trap first).
      liqInsidePocket = estLiq.price >= nearestRiskCluster.price * 0.998;
    } else {
      liqInsidePocket = estLiq.price <= nearestRiskCluster.price * 1.002;
    }
  }

  // Continuous penalties
  let danger = 0;
  if (lev >= 50) danger += 5;
  else if (lev >= 25) danger += 4;
  else if (lev >= 15) danger += 3;
  else if (lev >= 10) danger += 2;
  else if (lev >= 5) danger += 1;

  if (pocketDistPct <= 0.5) danger += 4;
  else if (pocketDistPct <= 0.9) danger += 3;
  else if (pocketDistPct <= 1.5) danger += 2;
  else if (pocketDistPct <= 2.5) danger += 1;

  if (estLiq) {
    if (estLiq.distancePct <= 2) danger += 3;
    else if (estLiq.distancePct <= 4) danger += 2;
    else if (estLiq.distancePct <= 7) danger += 1;
  }
  if (liqInsidePocket) danger += 2;

  const risk: "low" | "medium" | "high" = danger >= 7 ? "high" : danger >= 4 ? "medium" : "low";
  const pts =
    risk === "low"
      ? maxPts
      : risk === "medium"
        ? Math.max(3, Math.round(maxPts * 0.5) - Math.min(2, danger - 4))
        : Math.max(0, Math.round(maxPts * 0.15) - Math.min(1, danger - 7));

  const levBit = `${lev.toFixed(lev >= 10 ? 0 : 1)}×`;
  const liqBit = estLiq
    ? `est. liq ~${estLiq.price.toLocaleString(undefined, { maximumFractionDigits: 4 })} (${estLiq.distancePct.toFixed(2)}% from entry)`
    : "est. liq n/a";
  const pocketBit = nearestRiskCluster
    ? `nearest pocket ${pocketDistPct.toFixed(2)}% away`
    : "no pocket";
  const detail =
    risk === "high"
      ? `High risk at ${levBit}: ${liqBit}; ${pocketBit}${liqInsidePocket ? "; liq sits into/near the pocket" : ""}.`
      : risk === "medium"
        ? `Moderate at ${levBit}: ${liqBit}; ${pocketBit}.`
        : `More cushion at ${levBit}: ${liqBit}; ${pocketBit}.`;

  return { pts, risk, detail };
}

function getTrendAndStructure(candles: Array<[string, string, string, string, string, ...string[]]>): {
  trend: "up" | "down" | "sideways";
  marketStructure: "higher-highs/higher-lows" | "lower-highs/lower-lows" | "mixed";
  trendlineRead: string;
} {
  const closes = candles
    .map((c) => Number(c[4]))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (closes.length < 10) {
    return {
      trend: "sideways",
      marketStructure: "mixed",
      trendlineRead: "Not enough candles for robust trendline/structure read.",
    };
  }
  const shortLen = Math.max(4, Math.floor(closes.length * 0.25));
  const longLen = Math.max(8, Math.floor(closes.length * 0.6));
  const sma = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const shortMa = sma(closes.slice(-shortLen));
  const longMa = sma(closes.slice(-longLen));
  const slopePct = pctChange(closes[Math.max(0, closes.length - longLen)], closes[closes.length - 1]);
  const trend =
    shortMa > longMa * 1.002 || slopePct > 0.8 ? "up" : shortMa < longMa * 0.998 || slopePct < -0.8 ? "down" : "sideways";

  const highs = candles.map((c) => Number(c[2])).filter((n) => Number.isFinite(n));
  const lows = candles.map((c) => Number(c[3])).filter((n) => Number.isFinite(n));
  const mid = Math.floor(Math.min(highs.length, lows.length) / 2);
  const firstHigh = Math.max(...highs.slice(0, mid));
  const secondHigh = Math.max(...highs.slice(mid));
  const firstLow = Math.min(...lows.slice(0, mid));
  const secondLow = Math.min(...lows.slice(mid));
  const hh = secondHigh > firstHigh;
  const hl = secondLow > firstLow;
  const lh = secondHigh < firstHigh;
  const ll = secondLow < firstLow;
  const marketStructure = hh && hl ? "higher-highs/higher-lows" : lh && ll ? "lower-highs/lower-lows" : "mixed";
  const trendlineRead = `MA trend ${trend} (short MA ${shortMa.toFixed(2)} vs long MA ${longMa.toFixed(2)}), slope ${slopePct >= 0 ? "+" : ""}${slopePct.toFixed(2)}%. Structure: ${marketStructure}.`;
  return { trend, marketStructure, trendlineRead };
}

function computeVolatilityPct(candles: Array<[string, string, string, string, string, ...string[]]>): number {
  if (!candles.length) return 1.2;
  const ranges = candles
    .map((c) => {
      const high = Number(c[2]);
      const low = Number(c[3]);
      const close = Number(c[4]);
      if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close) || close <= 0) return null;
      return ((high - low) / close) * 100;
    })
    .filter((v): v is number => v != null);
  if (!ranges.length) return 1.2;
  const avg = ranges.reduce((a, b) => a + b, 0) / ranges.length;
  return Math.min(8, Math.max(0.35, avg));
}

function locateContract(target: string, perps: TrendingPerp[]): TrendingPerp | null {
  const exact = perps.find((p) => p.coin.toUpperCase() === target);
  if (exact) return exact;
  const prefixed = perps.find((p) => p.coin.toUpperCase().startsWith(target));
  return prefixed ?? null;
}

function buildAnalysis(input: {
  symbol: string;
  markPrice: number;
  dayChangePct: number;
  fundingRatePct: number;
  openInterest: number;
  volume24h: number;
  volatilityPct: number;
}): {
  clusters: Cluster[];
  bias: "long" | "short" | "neutral";
  confidence: "low" | "medium" | "high";
  summary: string;
  liquidityRead: string;
  recommendations: {
    buyArea: string;
    noBuyArea: string;
    stopArea: string;
    noStopArea: string;
    riskNote: string;
  };
  levels: {
    buyMin: number | null;
    buyMax: number | null;
    noBuyMin: number | null;
    noBuyMax: number | null;
    stopLevel: number | null;
    noStopMin: number | null;
    noStopMax: number | null;
    invalidation: number | null;
  };
} {
  const { markPrice, fundingRatePct, dayChangePct, openInterest, volume24h, volatilityPct } = input;
  const stress = Math.max(Math.abs(fundingRatePct) / 0.04, Math.abs(dayChangePct) / 3);
  const baseSpanPct = Math.min(6.5, Math.max(0.45, volatilityPct * (0.9 + Math.min(stress, 2) * 0.2)));
  const nearPct = baseSpanPct;
  const farPct = baseSpanPct * 1.9;

  const baseLiquidity = Math.max(openInterest * markPrice * 0.002, volume24h * 0.0008, 35_000);
  const longSideWeight = fundingRatePct > 0 ? 1.35 : 0.85;
  const shortSideWeight = fundingRatePct < 0 ? 1.35 : 0.85;

  const mkCluster = (opts: {
    label: string;
    side: ClusterSide;
    pct: number;
    weight: number;
    reason: string;
    intensity: "low" | "medium" | "high";
  }): Cluster => {
    const direction = opts.side === "long_liq_below" ? -1 : 1;
    const price = markPrice * (1 + (direction * opts.pct) / 100);
    return {
      label: opts.label,
      side: opts.side,
      price,
      distancePct: opts.pct,
      intensity: opts.intensity,
      estimatedLiquidityUsd: fmtUsd(baseLiquidity * opts.weight),
      reason: opts.reason,
    };
  };

  const clusters: Cluster[] = [
    mkCluster({
      label: "Near long-liquidation pocket",
      side: "long_liq_below",
      pct: nearPct,
      weight: 1.05 * longSideWeight,
      intensity: fundingRatePct > 0 ? "high" : "medium",
      reason: "Potential downside sweep where over-leveraged longs may get forced out.",
    }),
    mkCluster({
      label: "Deep long-liquidation pocket",
      side: "long_liq_below",
      pct: farPct,
      weight: 0.8 * longSideWeight,
      intensity: fundingRatePct > 0.03 ? "high" : "medium",
      reason: "If momentum accelerates down, this zone often becomes a high-volatility flush target.",
    }),
    mkCluster({
      label: "Near short-liquidation pocket",
      side: "short_liq_above",
      pct: nearPct,
      weight: 1.05 * shortSideWeight,
      intensity: fundingRatePct < 0 ? "high" : "medium",
      reason: "Potential upside sweep where over-leveraged shorts may get squeezed.",
    }),
    mkCluster({
      label: "Deep short-liquidation pocket",
      side: "short_liq_above",
      pct: farPct,
      weight: 0.8 * shortSideWeight,
      intensity: fundingRatePct < -0.03 ? "high" : "medium",
      reason: "If momentum accelerates up, this zone often becomes a squeeze extension target.",
    }),
  ];

  const shortCrowded = fundingRatePct >= 0.03;
  const longCrowded = fundingRatePct <= -0.03;
  const strongMoveUp = dayChangePct >= 2.5;
  const strongMoveDown = dayChangePct <= -2.5;

  let bias: "long" | "short" | "neutral" = "neutral";
  if (longCrowded && strongMoveDown) bias = "long";
  else if (shortCrowded && strongMoveUp) bias = "short";
  else if (longCrowded && !strongMoveUp) bias = "long";
  else if (shortCrowded && !strongMoveDown) bias = "short";

  const confidenceScore =
    (Math.abs(fundingRatePct) >= 0.04 ? 2 : Math.abs(fundingRatePct) >= 0.02 ? 1 : 0) +
    (Math.abs(dayChangePct) >= 3 ? 1 : 0) +
    (volatilityPct >= 1.5 ? 1 : 0);
  const confidence = confidenceScore >= 3 ? "high" : confidenceScore >= 2 ? "medium" : "low";

  const buyArea =
    bias === "long"
      ? `Consider scale-in near ${clusters[0].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} down to ${clusters[1].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} if price reclaims structure after sweep.`
      : bias === "short"
      ? `Prefer pullback sells around ${clusters[2].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} up to ${clusters[3].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} if rejection confirms.`
      : "No clean buy area yet. Wait for a sweep + confirmation candle before positioning.";
  const noBuyArea =
    bias === "long"
      ? "Avoid fresh longs while price is still breaking down impulsively into liquidity without reclaim confirmation."
      : bias === "short"
      ? "Avoid chasing shorts at local lows after a heavy flush; risk of short squeeze is elevated."
      : "Avoid directional entries in the middle of the range where both sides can be trapped.";

  const stopArea =
    bias === "long"
      ? `Protect below ${clusters[1].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} (invalidates sweep thesis).`
      : bias === "short"
      ? `Protect above ${clusters[3].price.toLocaleString(undefined, { maximumFractionDigits: 4 })} (invalidates rejection thesis).`
      : "Use tight invalidation just beyond nearest sweep level; reduce size until bias is clear.";
  const noStopArea = "Do not place stops exactly at obvious round numbers or directly inside the nearest liquidity pocket.";

  const nearLong = clusters.find((c) => c.side === "long_liq_below" && c.label.toLowerCase().includes("near"));
  const deepLong = clusters.find((c) => c.side === "long_liq_below" && c.label.toLowerCase().includes("deep"));
  const nearShort = clusters.find((c) => c.side === "short_liq_above" && c.label.toLowerCase().includes("near"));
  const deepShort = clusters.find((c) => c.side === "short_liq_above" && c.label.toLowerCase().includes("deep"));

  const levels =
    bias === "long"
      ? {
          buyMin: deepLong?.price ?? null,
          buyMax: nearLong?.price ?? null,
          noBuyMin: nearShort?.price ?? null,
          noBuyMax: deepShort?.price ?? null,
          stopLevel: deepLong ? deepLong.price * 0.998 : null,
          noStopMin: nearLong ? nearLong.price * 0.997 : null,
          noStopMax: nearLong ? nearLong.price * 1.003 : null,
          invalidation: deepLong ? deepLong.price * 0.994 : null,
        }
      : bias === "short"
      ? {
          buyMin: nearShort?.price ?? null,
          buyMax: deepShort?.price ?? null,
          noBuyMin: deepLong?.price ?? null,
          noBuyMax: nearLong?.price ?? null,
          stopLevel: deepShort ? deepShort.price * 1.002 : null,
          noStopMin: nearShort ? nearShort.price * 0.997 : null,
          noStopMax: nearShort ? nearShort.price * 1.003 : null,
          invalidation: deepShort ? deepShort.price * 1.006 : null,
        }
      : {
          buyMin: nearLong?.price ?? null,
          buyMax: nearShort?.price ?? null,
          noBuyMin: nearLong ? nearLong.price * 1.001 : null,
          noBuyMax: nearShort ? nearShort.price * 0.999 : null,
          stopLevel: null,
          noStopMin: markPrice * 0.999,
          noStopMax: markPrice * 1.001,
          invalidation: null,
        };

  const summary =
    bias === "long"
      ? "Long-side setup favored after downside liquidity sweep."
      : bias === "short"
      ? "Short-side setup favored after upside liquidity sweep."
      : "Neutral: wait for confirmation after liquidity run.";
  const liquidityRead = `Funding ${fundingRatePct >= 0 ? "positive" : "negative"} (${fundingRatePct.toFixed(4)}%), 24h move ${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%, volatility ${volatilityPct.toFixed(2)}%.`;

  return {
    clusters,
    bias,
    confidence,
    summary,
    liquidityRead,
    recommendations: {
      buyArea,
      noBuyArea,
      stopArea,
      noStopArea,
      riskNote: "Liquidation zones are probabilistic. Use confirmation + risk sizing; never treat map levels as guaranteed reversal points.",
    },
    levels,
  };
}

export async function POST(request: Request) {
  try {
    const { tier, session } = await getSessionAndSubscription();
    const isOwner = !!session?.user?.isOwner;
    if (!(isOwner || tier === "vip")) {
      return NextResponse.json(
        { success: false, error: "VIP required for Liquidation Map.", locked: true },
        { status: 403 }
      );
    }

    const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_LIQUIDATION_MAP);
    if (!enabled) {
      return NextResponse.json(
        { success: false, error: "Liquidation Map is not available on your account yet. Contact support if you need access.", disabled: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { normalized: symbol, aliasUsed } = normalizeWithAliases(typeof body.symbol === "string" ? body.symbol : "");
    const traderTypeRaw = typeof body.traderType === "string" ? body.traderType.toLowerCase().trim() : "";
    const traderType = traderTypeRaw === "long" || traderTypeRaw === "short" ? traderTypeRaw : null;
    const entry = Number(body.entry);
    const exit = Number(body.exit);
    const leverage = Number(body.leverage ?? 10);
    if (!symbol) {
      return NextResponse.json({ success: false, error: "Enter a contract symbol like BTC, ETH, SOL, XAU, or XAG." }, { status: 400 });
    }

    const useBlofinMetal = isBlofinMetal(symbol);
    let market: TrendingPerp | null = null;
    /** Candles from Blofin when metal or Blofin-only crypto (e.g. SNXX). */
    let useBlofinCandles = useBlofinMetal;
    if (useBlofinMetal) {
      market = await getBlofinMetalTrendingPerp(symbol as BlofinMetal);
      if (!market) {
        const inst = getBlofinMetalInstId(symbol);
        return NextResponse.json(
          { success: false, error: `No live price for ${symbol}. Check Blofin (${inst}) availability.` },
          { status: 404 }
        );
      }
    } else {
      const direct = await getPerpsByCoins([symbol]);
      market = direct.length > 0 ? direct[0] : null;
      if (!market) {
        const all = await getTrendingPerps(300);
        market = locateContract(symbol, all);
      }
      if (!market) {
        market = await getBlofinTrendingPerpBySymbol(symbol);
        if (market) useBlofinCandles = true;
      }
      if (!market) {
        return NextResponse.json(
          {
            success: false,
            error: `No perpetual market found for ${symbol} on Hyperliquid or Blofin right now.`,
          },
          { status: 404 }
        );
      }
    }

    const markPrice = parseNum(market.markPx);
    const openInterest = parseNum(market.openInterest);
    const volume24h = parseNum(market.dayNtlVlm);
    const fundingRatePct = parseNum(market.funding) * 100;
    const dayChangePct = Number.isFinite(market.dayPct) ? market.dayPct : 0;
    const fetchCandles = (interval: string, limit: number) =>
      useBlofinCandles
        ? useBlofinMetal
          ? getBlofinMetalCandles(symbol as BlofinMetal, interval, limit)
          : getNovaScalpCandles(market!.coin, interval, limit)
        : getCandles(market!.coin, interval, limit);
    const candles = await fetchCandles("1h", 24);
    const structureCandles = await fetchCandles("15m", 48);
    const volatilityPct = computeVolatilityPct(candles);
    const { trend, marketStructure, trendlineRead } = getTrendAndStructure(structureCandles.length ? structureCandles : candles);

    const analysis = buildAnalysis({
      symbol: market.coin,
      markPrice,
      dayChangePct,
      fundingRatePct,
      openInterest,
      volume24h,
      volatilityPct,
    });

    const hasTradePlan = traderType && Number.isFinite(entry) && Number.isFinite(exit) && entry > 0 && exit > 0;
    let tradeCheck:
      | {
          score: number;
          verdict: "good_trade" | "risky_trade" | "avoid_trade";
          directionFit: string;
          trendlineFit: string;
          structureFit: string;
          liquidationRisk: string;
          notes: string[];
          analyzed: {
            traderType: "long" | "short";
            entry: number;
            exit: number;
            leverage: number;
            estLiquidationPrice: number | null;
            estLiquidationDistancePct: number | null;
            rrMultiple: number | null;
          };
          scoreBreakdown: Array<{
            id: string;
            label: string;
            earned: number;
            max: number;
            detail: string;
            suggestedFix: string | null;
          }>;
          suggestedPlan: ReturnType<typeof buildLiquidationMapSuggestedPlan>;
        }
      | undefined;
    if (hasTradePlan) {
      const W = { direction: 30, trend: 25, structure: 20, rr: 15, liquidation: 10 } as const;
      const levN = Number.isFinite(leverage) && leverage >= 1 ? leverage : 10;

      const expectedDirOk = (traderType === "long" && analysis.bias !== "short") || (traderType === "short" && analysis.bias !== "long");
      const trendOk = (traderType === "long" && trend !== "down") || (traderType === "short" && trend !== "up");
      const structureOk =
        (traderType === "long" && marketStructure !== "lower-highs/lower-lows") ||
        (traderType === "short" && marketStructure !== "higher-highs/higher-lows");

      const nearestRiskCluster =
        traderType === "long"
          ? analysis.clusters.filter((c) => c.side === "long_liq_below").sort((a, b) => a.distancePct - b.distancePct)[0]
          : analysis.clusters.filter((c) => c.side === "short_liq_above").sort((a, b) => a.distancePct - b.distancePct)[0];

      const suggestedPlan = buildLiquidationMapSuggestedPlan({
        traderType,
        entry,
        exit,
        markPrice,
        bias: analysis.bias,
        trend,
        clusters: analysis.clusters,
      });

      // RR vs the map-derived hard stop (not a fixed 0.4% proxy — that ignored your exit/stop).
      const stopPx = suggestedPlan.suggestedStop.price;
      const riskAbs = Math.abs(entry - stopPx);
      const rewardAbs = traderType === "long" ? exit - entry : entry - exit;
      const rrValid = rewardAbs > 0 && riskAbs > 0;
      const rrMultiple = rrValid ? rewardAbs / riskAbs : 0;
      const rrPts = scoreRrPoints(rrMultiple, rrValid, W.rr);
      const planRr = suggestedPlan.planRrMultiple;

      const estLiq = approxIsolatedLiquidationPrice(traderType, entry, levN);
      const liqScore = scoreLiquidationPoints({
        leverage: levN,
        entry,
        traderType,
        estLiq,
        nearestRiskCluster: nearestRiskCluster
          ? { price: nearestRiskCluster.price, distancePct: nearestRiskCluster.distancePct }
          : null,
        maxPts: W.liquidation,
      });
      const liqPts = liqScore.pts;
      const liqRisk = liqScore.risk;

      const dirPts = expectedDirOk ? W.direction : 8;
      const trendPts = trendOk ? W.trend : 8;
      const structPts = structureOk ? W.structure : 6;

      const fmtPx = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 6 });
      const exitFor15R = traderType === "long" ? entry + 1.5 * riskAbs : entry - 1.5 * riskAbs;
      const exitFor25R = traderType === "long" ? entry + 2.5 * riskAbs : entry - 2.5 * riskAbs;

      const fixDirection =
        dirPts >= W.direction
          ? null
          : `Fade or counter-bias setups need smaller size and a hard invalidation at ~${fmtPx(suggestedPlan.suggestedStop.price)} — or wait until bias softens toward ${traderType === "long" ? "neutral/bullish" : "neutral/bearish"}.`;

      const fixTrend =
        trendPts >= W.trend
          ? null
          : `Prefer pullback or range-edge entries rather than chasing impulse while the read is "${trend}" against ${traderType}.${
              suggestedPlan.suggestedEntry
                ? ` Map suggests waiting near ${fmtPx(suggestedPlan.suggestedEntry.price)}.`
                : ""
            }`;

      const fixStructure =
        structPts >= W.structure
          ? null
          : `Consider waiting for a cleaner swing break (and retest) that supports ${traderType} before adding notional — structure "${marketStructure}" is awkward here.`;

      let fixRr: string | null = null;
      if (rrPts >= W.rr) {
        fixRr = null;
      } else if (!rrValid) {
        fixRr = `Set take-profit ${traderType === "long" ? "above" : "below"} entry — risk to stop is ${fmtPx(riskAbs)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}%).`;
      } else if (rrMultiple < 1.5) {
        const gapPct = (Math.abs(exitFor15R - exit) / entry) * 100;
        fixRr = `Improve R:R toward ~1.5× vs suggested stop ${fmtPx(stopPx)}: aim take-profit near ${fmtPx(exitFor15R)} (~${gapPct.toFixed(2)}% ${traderType === "long" ? "beyond" : "below"} your current exit). Plan R:R ≈ ${planRr?.toFixed(2) ?? rrMultiple.toFixed(2)}×.`;
      } else if (rrMultiple < 2.5) {
        const gapPct = (Math.abs(exitFor25R - exit) / entry) * 100;
        fixRr = `For the top RR bracket (~2.5× vs stop), stretch target toward ${fmtPx(exitFor25R)} (~${gapPct.toFixed(2)}% vs your exit) or tighten risk with stop near ${fmtPx(stopPx)}.`;
      }

      let fixLiq: string | null = null;
      if (liqPts >= W.liquidation) {
        fixLiq = null;
      } else if (liqRisk === "high") {
        const parts: string[] = [];
        if (levN > 10) parts.push(`cut leverage toward ≤8× (you used ${levN}×)`);
        if (estLiq) parts.push(`your est. liquidation ~${fmtPx(estLiq.price)} is only ${estLiq.distancePct.toFixed(2)}% from entry`);
        if (nearestRiskCluster && Math.abs(pctChange(entry, nearestRiskCluster.price)) <= 0.9) {
          if (suggestedPlan.suggestedEntry) {
            parts.push(`wait for better entry near ${fmtPx(suggestedPlan.suggestedEntry.price)}`);
          } else {
            parts.push(`bias entry away from the nearest liquidation pocket`);
          }
        }
        parts.push(`place hard stop near ${fmtPx(suggestedPlan.suggestedStop.price)}`);
        fixLiq = parts.join("; ") + ".";
      } else {
        fixLiq = `Trim leverage (now ${levN}×) or add spacing from the nearest adverse cluster (${nearestRiskCluster ? `${nearestRiskCluster.distancePct.toFixed(2)}% away` : "see map"}). Suggested stop: ${fmtPx(suggestedPlan.suggestedStop.price)}.`;
      }

      const scoreBreakdown: Array<{
        id: string;
        label: string;
        earned: number;
        max: number;
        detail: string;
        suggestedFix: string | null;
      }> = [
        {
          id: "direction",
          label: "Direction vs liquidity bias",
          earned: dirPts,
          max: W.direction,
          detail: expectedDirOk
            ? `Your ${traderType} aligns with NovaStaris liquidity bias (${analysis.bias}).`
            : `Your ${traderType} fights liquidity bias (${analysis.bias}) — fades can work but carry extra risk.`,
          suggestedFix: fixDirection,
        },
        {
          id: "trend",
          label: "Trend & MA slope",
          earned: trendPts,
          max: W.trend,
          detail: trendOk
            ? `15m/regression read: trend ${trend} — workable for ${traderType}.`
            : `15m/regression read: trend ${trend} — crowded against ${traderType}.`,
          suggestedFix: fixTrend,
        },
        {
          id: "structure",
          label: "Market structure",
          earned: structPts,
          max: W.structure,
          detail: structureOk
            ? `Structure ${marketStructure} is not aggressively against ${traderType}.`
            : `Structure ${marketStructure} argues against naive ${traderType} continuation.`,
          suggestedFix: fixStructure,
        },
        {
          id: "rr",
          label: "Risk / reward vs suggested stop",
          earned: rrPts,
          max: W.rr,
          detail: !rrValid
            ? `Exit must be ${traderType === "long" ? "above" : "below"} entry for reward; RR score is zero until fixed.`
            : `RR ≈ ${rrMultiple.toFixed(2)}× using stop ${fmtPx(stopPx)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}% risk) → exit ${fmtPx(exit)}.`,
          suggestedFix: fixRr,
        },
        {
          id: "liquidation",
          label: "Liquidation cushion & leverage",
          earned: liqPts,
          max: W.liquidation,
          detail: liqScore.detail,
          suggestedFix: fixLiq,
        },
      ];

      const score = Math.max(0, Math.min(100, Math.round(dirPts + trendPts + structPts + rrPts + liqPts)));
      tradeCheck = {
        score,
        verdict: score >= 70 ? "good_trade" : score >= 45 ? "risky_trade" : "avoid_trade",
        directionFit: expectedDirOk ? "Trade direction aligns with current liquidity bias." : "Direction conflicts with current liquidity bias.",
        trendlineFit: trendOk ? `Trend is ${trend}; setup is acceptable for ${traderType}.` : `Trend is ${trend}; setup fights trend for ${traderType}.`,
        structureFit: structureOk ? `Market structure (${marketStructure}) supports this setup.` : `Market structure (${marketStructure}) is not favorable for this setup.`,
        liquidationRisk:
          liqRisk === "high"
            ? `High liquidation risk at ${levN}×${estLiq ? ` (est. liq ~${fmtPx(estLiq.price)}, ${estLiq.distancePct.toFixed(2)}% away)` : ""}.`
            : liqRisk === "medium"
            ? `Moderate liquidation risk at ${levN}× — keep size conservative.`
            : `Lower liquidation risk at ${levN}× relative to pocket spacing.`,
        analyzed: {
          traderType,
          entry,
          exit,
          leverage: levN,
          estLiquidationPrice: estLiq?.price ?? null,
          estLiquidationDistancePct: estLiq?.distancePct ?? null,
          rrMultiple: rrValid ? rrMultiple : null,
        },
        notes: [
          `Analyzed ${traderType} · entry ${fmtPx(entry)} · exit ${fmtPx(exit)} · leverage ${levN}×${
            estLiq ? ` · est. isolated liq ~${fmtPx(estLiq.price)} (${estLiq.distancePct.toFixed(2)}% from entry)` : ""
          }.`,
          `Suggested hard stop: ${fmtPx(suggestedPlan.suggestedStop.price)} (${suggestedPlan.suggestedStop.distancePctFromEntry.toFixed(2)}% from your entry) — ${suggestedPlan.suggestedStop.reason}`,
          ...(suggestedPlan.suggestedEntry
            ? [
                `Better entry suggestion: ${fmtPx(suggestedPlan.suggestedEntry.price)} (${suggestedPlan.suggestedEntry.distancePctFromCurrent.toFixed(2)}% vs your entry) — ${suggestedPlan.suggestedEntry.reason}`,
              ]
            : ["Your entry location looks acceptable vs nearest pocket; no better-entry wait required."]),
          suggestedPlan.summary,
          `Score sums five pillars (max ${W.direction}+${W.trend}+${W.structure}+${W.rr}+${W.liquidation}=100): direction · trend · structure · RR · liquidation.`,
          "Market Bias / clusters above are symbol-wide (they do not change with your entry). Trade check below does.",
        ],
        scoreBreakdown,
        suggestedPlan,
      };
    }

    return NextResponse.json({
      success: true,
      symbol: market.coin,
      aliasUsed: aliasUsed ?? null,
      markPrice,
      dayChangePct,
      fundingRatePct,
      openInterest,
      volume24h,
      volatilityPct,
      trend,
      marketStructure,
      trendlineRead,
      ...analysis,
      tradeCheck,
      disclaimer:
        "Educational analysis only, not financial advice. Liquidation clusters can shift quickly with changing leverage and order flow.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze liquidation map.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
