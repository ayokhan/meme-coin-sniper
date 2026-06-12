import {
  forexContractDescription,
  getForexCandles,
  getForexTicker,
  normalizeForexSymbol,
} from "@/lib/forex-market";
import {
  combineStructureAndTrendline,
  countSupportResistanceTouches,
  highLowFromCandles,
  overallTrendlineSummary,
  structureDirectionFromCloses,
  trendlineRegressionFromCloses,
  type CandleTuple,
} from "@/lib/nova-q-analytics";
import {
  analyzeNovaRadarPlan,
  buildNovaRadarRecommendation,
  parseNovaRadarPlansFromBody,
  parseNovaRadarRunOptions,
  type NovaRadarMarketContext,
  type NovaRadarPlanInput,
  type NovaRadarPlanResult,
  type NovaRadarRecommendation,
  type NovaRadarTfRow,
} from "@/lib/nova-radar";
import { parseCapitalRiskTolerance, parseInvestmentAmountUsdt } from "@/lib/nova-radar-capital-guard";

const FOREX_STRUCTURE_TFS = [
  { id: "15m", label: "15 mins", interval: "15m", limit: 96 },
  { id: "1h", label: "1 hour", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
] as const;

/** MT5-style leverage (e.g. 1:2000). */
export function parseForexLeverage(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 2000) {
    return Math.round(raw);
  }
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return null;
  if (s.includes(":")) {
    const part = s.split(":").pop()?.replace(/[X\s]/g, "") ?? "";
    s = part;
  } else {
    s = s.replace(/[X\s]/g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1 || n > 2000) return null;
  return Math.round(n);
}

export function parseForexRadarRunOptions(body: Record<string, unknown>) {
  const opts = parseNovaRadarRunOptions(body);
  const lev = parseForexLeverage(body.leverage ?? body.lev);
  if (lev != null) opts.leverage = lev;
  const investment = parseInvestmentAmountUsdt(
    body.investmentAmountUsdt ?? body.investmentAmount ?? body.marginUsdt,
  );
  const risk = parseCapitalRiskTolerance(body.capitalRiskTolerance ?? body.riskLevel);
  if (investment != null) opts.investmentAmountUsdt = investment;
  if (risk != null) opts.capitalRiskTolerance = risk;
  opts.forexReferenceOnly = true;
  if (lev != null && lev > 125) {
    opts.maintenanceMarginNote = "High MT5-style leverage — illustrative isolated formula; confirm with broker.";
  }
  return opts;
}

export async function buildForexNovaRadarMarketContext(symbolRaw: string): Promise<{
  symbol: string;
  ctx: NovaRadarMarketContext;
  contractDescription: string;
}> {
  const symbol = normalizeForexSymbol(symbolRaw) || "XAUUSD";
  const [ticker, dailyCandles] = await Promise.all([
    getForexTicker(symbol),
    getForexCandles(symbol, "1d", 120),
  ]);

  let currentPrice = ticker?.last ? Number(ticker.last) : NaN;
  if (!Number.isFinite(currentPrice) && dailyCandles[0]) {
    currentPrice = Number(dailyCandles[0][4]);
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error(`No live price for ${symbol}.`);
  }

  const tfRows: NovaRadarTfRow[] = [];
  for (const tf of FOREX_STRUCTURE_TFS) {
    try {
      const candles = await getForexCandles(symbol, tf.interval, tf.limit);
      const candleRows = candles as CandleTuple[];
      const hl = highLowFromCandles(candleRows);
      if (!hl) continue;
      const { supportTouches, resistanceTouches } = countSupportResistanceTouches(
        candleRows,
        hl.low,
        hl.high,
      );
      const structureDirection = structureDirectionFromCloses(candleRows);
      const tl =
        trendlineRegressionFromCloses(candleRows) ?? {
          bias: "flat" as const,
          slopePctWindow: 0,
          closeVsLinePct: 0,
          read: "Too few candles for regression trendline.",
        };
      tfRows.push({
        id: tf.id,
        label: tf.label,
        support: hl.low,
        resistance: hl.high,
        supportTouches,
        resistanceTouches,
        structureDirection,
        trendlineBias: tl.bias,
        trendlineRead: tl.read,
        direction: combineStructureAndTrendline(structureDirection, tl.bias),
      });
    } catch {
      // skip tf
    }
  }

  if (tfRows.length === 0) {
    throw new Error(`No structure data for ${symbol}. Try again in a minute.`);
  }

  let marketDirection: "bullish" | "bearish" | "sideways" = "sideways";
  let score = 0;
  for (const r of tfRows) {
    if (r.direction === "bullish") score += 1;
    if (r.direction === "bearish") score -= 1;
  }
  if (score > 0) marketDirection = "bullish";
  if (score < 0) marketDirection = "bearish";

  return {
    symbol,
    contractDescription: forexContractDescription(symbol),
    ctx: {
      symbol,
      currentPrice,
      marketDirection,
      structureTimeframes: tfRows,
      dailyCandles: dailyCandles as CandleTuple[],
      overallTrendlineSummary: overallTrendlineSummary(tfRows),
    },
  };
}

export function injectForexSymbolOnPlans(
  plans: NovaRadarPlanInput[],
  symbol: string,
): NovaRadarPlanInput[] {
  return plans.map((p) => ({ ...p, symbol: p.symbol?.trim() ? p.symbol : symbol }));
}

export async function runForexNovaRadar(body: Record<string, unknown>): Promise<{
  plans: NovaRadarPlanResult[];
  recommendation: NovaRadarRecommendation;
  currentPrice: number;
  symbol: string;
  contractDescription: string;
  disclaimer: string;
}> {
  const symbolInput = normalizeForexSymbol(String(body.symbol ?? "XAUUSD")) || "XAUUSD";
  const { plans: rawPlans, error } = parseNovaRadarPlansFromBody({
    ...body,
    symbol: symbolInput,
  });
  if (error || rawPlans.length === 0) {
    throw new Error(error ?? "Enter trade plan 1: limit price and side.");
  }

  const plans = injectForexSymbolOnPlans(rawPlans, symbolInput);
  const runOptions = parseForexRadarRunOptions(body);
  const { symbol, ctx, contractDescription } = await buildForexNovaRadarMarketContext(symbolInput);

  const results = plans.map((plan) =>
    analyzeNovaRadarPlan(plan, ctx, runOptions, plans),
  );
  const recommendation = buildNovaRadarRecommendation(results);

  return {
    plans: results,
    recommendation,
    currentPrice: ctx.currentPrice,
    symbol,
    contractDescription,
    disclaimer:
      "Nova Forex Radar uses Yahoo Finance reference OHLC (MT5/broker prices may differ). Leverage and SL are illustrative for manual or EA execution—not financial advice.",
  };
}
