import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";
import { getPerpsByCoins, getTrendingPerps, type TrendingPerp } from "@/lib/api-clients/hyperliquid";
import { getCandles } from "@/lib/hyperliquid";

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
  const s = normalizeSymbol(raw);
  const alias: Record<string, string> = {
    XAU: "PAXG",
    GOLD: "PAXG",
  };
  if (alias[s]) return { normalized: alias[s], aliasUsed: s };
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
      return NextResponse.json({ success: false, error: "Enter a contract symbol like BTC, ETH, SOL, or XAU." }, { status: 400 });
    }

    const direct = await getPerpsByCoins([symbol]);
    let market: TrendingPerp | null = direct.length > 0 ? direct[0] : null;
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

    const markPrice = parseNum(market.markPx);
    const openInterest = parseNum(market.openInterest);
    const volume24h = parseNum(market.dayNtlVlm);
    const fundingRatePct = parseNum(market.funding) * 100;
    const dayChangePct = Number.isFinite(market.dayPct) ? market.dayPct : 0;
    const candles = await getCandles(market.coin, "1h", 24);
    const structureCandles = await getCandles(market.coin, "15m", 48);
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
        }
      | undefined;
    if (hasTradePlan) {
      const expectedDirOk = (traderType === "long" && analysis.bias !== "short") || (traderType === "short" && analysis.bias !== "long");
      const trendOk = (traderType === "long" && trend !== "down") || (traderType === "short" && trend !== "up");
      const structureOk =
        (traderType === "long" && marketStructure !== "lower-highs/lower-lows") ||
        (traderType === "short" && marketStructure !== "higher-highs/higher-lows");
      const rr = traderType === "long" ? (exit - entry) / Math.max(0.0000001, entry * 0.004) : (entry - exit) / Math.max(0.0000001, entry * 0.004);
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
      const base = (expectedDirOk ? 28 : 10) + (trendOk ? 22 : 8) + (structureOk ? 20 : 8) + (rr >= 1.5 ? 15 : rr >= 1 ? 10 : 5) + (liqRisk === "low" ? 15 : liqRisk === "medium" ? 8 : 2);
      const score = Math.max(0, Math.min(100, Math.round(base)));
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
        ],
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
