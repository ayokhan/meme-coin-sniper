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

function fmtUsd(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function parseNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
    const symbol = normalizeSymbol(typeof body.symbol === "string" ? body.symbol : "");
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
    const volatilityPct = computeVolatilityPct(candles);

    const analysis = buildAnalysis({
      symbol: market.coin,
      markPrice,
      dayChangePct,
      fundingRatePct,
      openInterest,
      volume24h,
      volatilityPct,
    });

    return NextResponse.json({
      success: true,
      symbol: market.coin,
      markPrice,
      dayChangePct,
      fundingRatePct,
      openInterest,
      volume24h,
      volatilityPct,
      ...analysis,
      disclaimer:
        "Educational analysis only, not financial advice. Liquidation clusters can shift quickly with changing leverage and order flow.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to analyze liquidation map.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
