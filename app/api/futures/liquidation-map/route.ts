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
        { success: false, error: "Liquidation Map is disabled by admin.", disabled: true },
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
        return NextResponse.json(
          { success: false, error: `No perpetual market found for ${symbol} on the connected futures feed right now.` },
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
      useBlofinMetal
        ? getBlofinMetalCandles(symbol as BlofinMetal, interval, limit)
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
          scoreBreakdown: Array<{
            id: string;
            label: string;
            earned: number;
            max: number;
            detail: string;
            suggestedFix: string | null;
          }>;
        }
      | undefined;
    if (hasTradePlan) {
      const W = { direction: 30, trend: 25, structure: 20, rr: 15, liquidation: 10 } as const;

      const expectedDirOk = (traderType === "long" && analysis.bias !== "short") || (traderType === "short" && analysis.bias !== "long");
      const trendOk = (traderType === "long" && trend !== "down") || (traderType === "short" && trend !== "up");
      const structureOk =
        (traderType === "long" && marketStructure !== "lower-highs/lower-lows") ||
        (traderType === "short" && marketStructure !== "higher-highs/higher-lows");

      const riskProxy = Math.max(entry * 0.004, markPrice * 0.003);
      const rewardAbs =
        traderType === "long" ? exit - entry : entry - exit;
      const rrValid = rewardAbs > 0;
      const rrMultiple = rrValid ? rewardAbs / Math.max(riskProxy, 1e-12) : 0;
      const rrPts =
        !rrValid
          ? 0
          : rrMultiple >= 2.5
            ? W.rr
            : rrMultiple >= 2
              ? 13
              : rrMultiple >= 1.5
                ? 11
                : rrMultiple >= 1
                  ? 8
                  : 4;

      const nearestRiskCluster =
        traderType === "long"
          ? analysis.clusters.filter((c) => c.side === "long_liq_below").sort((a, b) => a.distancePct - b.distancePct)[0]
          : analysis.clusters.filter((c) => c.side === "short_liq_above").sort((a, b) => a.distancePct - b.distancePct)[0];
      const liqRisk =
        leverage >= 20 || (nearestRiskCluster && Math.abs(pctChange(entry, nearestRiskCluster.price)) <= 0.8)
          ? "high"
          : leverage >= 10
          ? "medium"
          : "low";
      const liqPts = liqRisk === "low" ? W.liquidation : liqRisk === "medium" ? 5 : 1;

      const dirPts = expectedDirOk ? W.direction : 8;
      const trendPts = trendOk ? W.trend : 8;
      const structPts = structureOk ? W.structure : 6;

      const exitFor1R = traderType === "long" ? entry + riskProxy : entry - riskProxy;
      const exitFor15R = traderType === "long" ? entry + 1.5 * riskProxy : entry - 1.5 * riskProxy;
      const exitFor25R = traderType === "long" ? entry + 2.5 * riskProxy : entry - 2.5 * riskProxy;
      const fmtPx = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 6 });

      const fixDirection =
        dirPts >= W.direction
          ? null
          : `Fade or counter-bias setups need smaller size and a hard invalidation beyond the trap zone — or wait until bias softens toward ${traderType === "long" ? "neutral/bullish" : "neutral/bearish"}.`;

      const fixTrend =
        trendPts >= W.trend
          ? null
          : `Prefer pullback or range-edge entries rather than chasing impulse while the read is "${trend}" against ${traderType}.`;

      const fixStructure =
        structPts >= W.structure
          ? null
          : `Consider waiting for a cleaner swing break (and retest) that supports ${traderType} before adding notional — structure "${marketStructure}" is awkward here.`;

      let fixRr: string | null = null;
      if (rrPts >= W.rr) {
        fixRr = null;
      } else if (!rrValid) {
        fixRr = `Set take-profit ${traderType === "long" ? "above" : "below"} entry — e.g. near ${fmtPx(exitFor1R)} (~1.0× proxy R) minimum.`;
      } else if (rrMultiple < 1.5) {
        const gapPct = (Math.abs(exitFor15R - exit) / entry) * 100;
        fixRr = `Improve R:R toward ~1.5× proxy: aim take-profit near ${fmtPx(exitFor15R)} (~${gapPct.toFixed(2)}% ${traderType === "long" ? "above" : "below"} your current exit).`;
      } else if (rrMultiple < 2.5) {
        const gapPct = (Math.abs(exitFor25R - exit) / entry) * 100;
        fixRr = `For the top RR bracket (~2.5× proxy), stretch target toward ${fmtPx(exitFor25R)} (~${gapPct.toFixed(2)}% vs your exit) or tighten risk with a nearer structural stop if that target is unrealistic.`;
      }

      let fixLiq: string | null = null;
      if (liqPts >= W.liquidation) {
        fixLiq = null;
      } else if (liqRisk === "high") {
        const levN = Number.isFinite(leverage) ? leverage : 10;
        const parts: string[] = [];
        if (levN > 10) parts.push(`cut leverage toward ≤8× (you used ${levN}×)`);
        if (nearestRiskCluster && Math.abs(pctChange(entry, nearestRiskCluster.price)) <= 0.8) {
          parts.push(`bias entry away from the nearest liquidation pocket (~>0.9% clearance if possible)`);
        }
        fixLiq = parts.length ? parts.join("; ") + "." : `Add clearance from liquidation bands and keep leverage moderate (${levN}× reads hot).`;
      } else {
        fixLiq = `Trim leverage slightly or add spacing from the nearest adverse cluster (${nearestRiskCluster ? `${nearestRiskCluster.distancePct.toFixed(2)}% away` : "see map above"}).`;
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
          label: "Risk / reward vs proxy stop",
          earned: rrPts,
          max: W.rr,
          detail: !rrValid
            ? `Exit must be ${traderType === "long" ? "above" : "below"} entry for reward; RR score is zero until fixed.`
            : `RR ≈ ${rrMultiple.toFixed(2)}× vs ~0.3–0.4% structural risk proxy.`,
          suggestedFix: fixRr,
        },
        {
          id: "liquidation",
          label: "Liquidation cushion & leverage",
          earned: liqPts,
          max: W.liquidation,
          detail:
            liqRisk === "high"
              ? `High risk: lev ${Number.isFinite(leverage) ? leverage : 10}x or entry hugs nearest liq pocket.`
              : liqRisk === "medium"
              ? `Moderate: watch size; nearest cluster ${nearestRiskCluster ? `${nearestRiskCluster.distancePct.toFixed(2)}%` : "unknown"} away.`
              : `More cushion vs nearest adverse cluster ${nearestRiskCluster ? `(${nearestRiskCluster.distancePct.toFixed(2)}%)` : ""}.`,
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
            ? "High liquidation risk: entry is close to liquidation pocket and/or leverage is elevated."
            : liqRisk === "medium"
            ? "Moderate liquidation risk: keep position size conservative."
            : "Lower liquidation risk relative to current cluster spacing.",
        notes: [
          `Planned entry ${entry.toLocaleString(undefined, { maximumFractionDigits: 4 })}, exit ${exit.toLocaleString(undefined, { maximumFractionDigits: 4 })}, leverage ${Number.isFinite(leverage) ? leverage : 10}x.`,
          "Use a hard invalidation stop outside the nearest trap zone.",
          `Score sums five pillars (max ${W.direction}+${W.trend}+${W.structure}+${W.rr}+${W.liquidation}=100): direction · trend · structure · RR · liquidation.`,
        ],
        scoreBreakdown,
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
