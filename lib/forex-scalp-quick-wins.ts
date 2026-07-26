import type { Candle } from "@/lib/hyperliquid";
import { meanRangePct, trendFrom15mCloses } from "@/lib/crypto-buddie-score";
import { FOREX_MARKET_WATCH, FOREX_SCALP_MAX_LEVERAGE, resolveForexEntry } from "@/lib/forex-market";
import {
  analyzeScalpSetup,
  isValidScalpTimeframeId,
  QUICK_WIN_MIN_OSCILLATION_SCORE,
  scalpCandlesRequest,
  scalpTimeframeConfig,
  type NovaScalpNearSetup,
  type NovaScalpQuickWin,
} from "@/lib/nova-scalp-agent";

function candlePct(candles: Candle[], fallback = 0): number {
  const c = candles[0];
  if (!c?.[1] || !c?.[4]) return fallback;
  const open = Number(c[1]);
  const close = Number(c[4]);
  return open && open > 0 ? ((close - open) / open) * 100 : fallback;
}

function scoreForexOscillation(
  symbol: string,
  candles15m: Candle[],
  candles5m: Candle[]
): {
  quickWinScore: number;
  momentumBias: "long" | "short" | "neutral";
  rangePct15m: number;
  liquidityNote: string;
  suggestedLeverage: number;
  estHoldMinutes: number;
} | null {
  const range15 = meanRangePct(candles15m);
  const range5 = meanRangePct(candles5m);
  const { label: trend15m, netPct } = trendFrom15mCloses(candles15m);
  const pct5m = candlePct(candles5m);
  const pct15m = candlePct(candles15m);

  let score = 0;
  const entry = resolveForexEntry(symbol);
  if (entry?.category === "metal") score += 12;
  else if (entry?.category === "forex") score += 10;
  else score += 6;

  if (range15 >= 0.003 && range15 <= 0.035) score += 28;
  else if (range15 < 0.055) score += 12;

  if (range5 >= 0.002 && range5 <= 0.03) score += 18;

  const a15 = Math.abs(pct15m);
  if (a15 >= 0.02 && a15 <= 2.5) score += 14;

  if (trend15m === "sideways") score += 12;
  else if (Math.abs(netPct) < 0.4) score += 6;

  const quickWinScore = Math.max(0, Math.min(100, Math.round(score)));
  if (quickWinScore < QUICK_WIN_MIN_OSCILLATION_SCORE) return null;

  let momentumBias: "long" | "short" | "neutral" = "neutral";
  if (pct5m > 0.03) momentumBias = "long";
  else if (pct5m < -0.03) momentumBias = "short";

  const suggestedLeverage = range15 < 0.012 ? 30 : range15 < 0.022 ? 20 : 15;
  const category = entry?.category ?? "forex";

  return {
    quickWinScore,
    momentumBias,
    rangePct15m: Number((range15 * 100).toFixed(3)),
    liquidityNote:
      category === "stock"
        ? "Equity — mind session gaps and wider spreads overnight."
        : category === "metal"
          ? "Gold/silver — spot-calibrated; mind session volatility."
          : "FX/index — check spread around news and session opens.",
    suggestedLeverage,
    estHoldMinutes: range15 < 0.014 ? 8 : 14,
  };
}

export function evaluateQuickWinForex(input: {
  symbol: string;
  candles15m: Candle[];
  candles5m: Candle[];
  scalpCandles: Candle[];
  currentPrice: number | null;
  amountUsd?: number;
  scalpTimeframeId?: string;
  userLeverage?: number;
  maxLossPctOnMargin?: number;
}): { win: NovaScalpQuickWin | null; near: NovaScalpNearSetup | null; oscillationOk: boolean } {
  const oscillation = scoreForexOscillation(input.symbol, input.candles15m, input.candles5m);
  if (!oscillation) return { win: null, near: null, oscillationOk: false };

  const tfId = isValidScalpTimeframeId(input.scalpTimeframeId ?? "")
    ? input.scalpTimeframeId!
    : "5m";
  const leverage =
    input.userLeverage != null && Number.isFinite(input.userLeverage)
      ? Math.min(FOREX_SCALP_MAX_LEVERAGE, Math.max(1, input.userLeverage))
      : oscillation.suggestedLeverage;
  const amountUsd = Math.max(1, Number(input.amountUsd) || 100);

  const analysis = analyzeScalpSetup({
    symbol: input.symbol,
    timeframeId: tfId,
    amountUsd,
    leverage,
    maxLossPctOnMargin: input.maxLossPctOnMargin ?? 5,
    candles: input.scalpCandles,
    currentPrice: input.currentPrice,
    maxLeverage: FOREX_SCALP_MAX_LEVERAGE,
  });

  if (
    (analysis.side === "long" || analysis.side === "short") &&
    analysis.entryPrice != null &&
    analysis.exitPrice != null
  ) {
    const side = analysis.side;
    return {
      win: {
        symbol: input.symbol,
        quickWinScore: oscillation.quickWinScore,
        momentumBias: oscillation.momentumBias,
        rangePct15m: oscillation.rangePct15m,
        liquidityNote: oscillation.liquidityNote,
        directionHint: `${side.toUpperCase()} on ${analysis.timeframeLabel}: ${analysis.rationale.split(".")[0]}.`,
        suggestedLeverage: leverage,
        estHoldMinutes: analysis.estimatedHoldMinutes ?? oscillation.estHoldMinutes,
        currentPrice: input.currentPrice,
        scalpSide: side,
        scalpTimeframeId: analysis.timeframeId,
        scalpTimeframeLabel: analysis.timeframeLabel,
        entryPrice: analysis.entryPrice,
        exitPrice: analysis.exitPrice,
        stopLossPrice: analysis.stopLossPrice ?? analysis.entryPrice,
        entryTouches: analysis.entryTouches ?? 0,
        exitTouches: analysis.exitTouches ?? 0,
        previewPnlUsd: analysis.expectedPnlUsd,
      },
      near: null,
      oscillationOk: true,
    };
  }

  const near =
    oscillation.quickWinScore >= 48
      ? {
          symbol: input.symbol,
          quickWinScore: oscillation.quickWinScore,
          blendedDirection: analysis.blendedDirection,
          structureDirection: analysis.structureDirection,
          note: analysis.rationale.split(".")[0] ?? analysis.rationale,
        }
      : null;

  return { win: null, near, oscillationOk: true };
}

export const FOREX_QUICK_WIN_SYMBOLS = FOREX_MARKET_WATCH.map((e) => e.symbol);

export function forexScalpCandlesRequest(timeframeId: string) {
  return scalpCandlesRequest(timeframeId);
}

export function forexScalpTimeframeConfig(timeframeId: string) {
  return scalpTimeframeConfig(timeframeId);
}
