/**
 * Nova Pulse Calculate PnL — client + server math (no network).
 * Crypto: margin × leverage × % move. Forex: pips × pip value × lots (BabyPips-style).
 */
import { estimateBlofinIsolatedLiquidation } from "@/lib/blofin-estimated-liq";
import {
  estimateForexLotsFromMargin,
  estimateForexMarginFromLots,
  forexContractSize,
} from "@/lib/forex-lot-size";
import { normalizeForexSymbol } from "@/lib/forex-market";
import {
  lotsBreakdown,
  pipSizeForForexSymbol,
  pipValueUsdPerLot,
  pipsToPrice,
} from "@/lib/forex-pips";
import { accountGainLoss, type AccountGainLoss } from "@/lib/forex-pivots";
import { resolveScalpSymbol } from "@/lib/nova-scalp-agent";

export type PulsePnlMarket = "crypto" | "forex";
export type PulsePnlSide = "long" | "short";

export type PulsePnlInput = {
  market: PulsePnlMarket;
  symbol: string;
  side: PulsePnlSide;
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  leverage: number;
  /** Crypto USD margin, or forex fallback when lots omitted. */
  marginUsd?: number | null;
  /** Forex volume in standard lots. */
  lots?: number | null;
  accountUsd?: number | null;
  riskPct?: number | null;
  /**
   * stop — size so SL loss ≈ account × risk% (notional stays put if leverage changes).
   * margin — use risk% of account as isolated margin; notional and $ PnL scale with leverage.
   * Omit / custom — use marginUsd / lots as entered.
   */
  sizeFromRisk?: boolean;
  sizeMode?: "stop" | "margin" | "custom";
  usdJpy?: number | null;
};

export type PulsePnlLevels = {
  entryPrice: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  tpPct: number;
  slPct: number;
  tpPips: number | null;
  slPips: number | null;
  pipSize: number | null;
};

export type PulsePnlResult = {
  ok: true;
  market: PulsePnlMarket;
  symbol: string;
  side: PulsePnlSide;
  levels: PulsePnlLevels;
  leverage: number;
  notionalUsd: number;
  marginUsd: number;
  lots: number | null;
  lotBreakdown: ReturnType<typeof lotsBreakdown> | null;
  pipValueUsdPerLot: number | null;
  /** Pip value at the sized position (not 1.00 lot). */
  pipValueUsdAtSize: number | null;
  pipValueUsdPerMiniLot: number | null;
  pipValueUsdPerMicroLot: number | null;
  units: number | null;
  amountAtRiskUsd: number;
  profitIfTpUsd: number;
  lossIfSlUsd: number;
  rewardRisk: number | null;
  returnOnMarginIfTpPct: number;
  returnOnMarginIfSlPct: number;
  /** BabyPips gain/loss % of account if TP / SL hits. */
  accountIfTp: AccountGainLoss | null;
  accountIfSl: AccountGainLoss | null;
  sizedFromRisk: boolean;
  /** How the position was sized (crypto). */
  sizeMethod: "stop" | "margin" | "custom";
  riskBudgetUsd: number | null;
  estimatedLiquidationPrice: number | null;
  estimatedLiqDistancePct: number | null;
  /** USD PnL if price hits estimated isolated liq (negative for the losing side). */
  estimatedLiqLossUsd: number | null;
  estimatedLiqLossPctOfMargin: number | null;
  stopBeyondEstimatedLiq: boolean | null;
  notes: string[];
};

export type PulsePnlError = { ok: false; error: string };

function num(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : NaN;
}

export function movePct(side: PulsePnlSide, entry: number, exit: number): number {
  if (!(entry > 0) || !Number.isFinite(exit)) return 0;
  return side === "long" ? ((exit - entry) / entry) * 100 : ((entry - exit) / entry) * 100;
}

export function priceFromPct(side: PulsePnlSide, entry: number, pct: number, kind: "tp" | "sl"): number {
  if (!(entry > 0) || !Number.isFinite(pct)) return entry;
  const signed = kind === "sl" ? -Math.abs(pct) : Math.abs(pct);
  return side === "long" ? entry * (1 + signed / 100) : entry * (1 - signed / 100);
}

export function priceFromPips(
  symbol: string,
  side: PulsePnlSide,
  entry: number,
  pips: number,
  kind: "tp" | "sl"
): number {
  const dist = pipsToPrice(symbol, Math.abs(pips));
  const away = kind === "sl" ? -dist : dist;
  return side === "long" ? entry + away : entry - away;
}

export function pipsFromPrices(symbol: string, from: number, to: number): number {
  const pip = pipSizeForForexSymbol(symbol);
  if (!(pip > 0)) return 0;
  return (to - from) / pip;
}

function validateLevels(
  side: PulsePnlSide,
  entry: number,
  tp: number,
  sl: number
): string | null {
  if (!(entry > 0) || !(tp > 0) || !(sl > 0)) return "Entry, take profit, and stop loss must be positive prices.";
  if (side === "long") {
    if (!(tp > entry)) return "Long take profit must be above entry.";
    if (!(sl < entry)) return "Long stop loss must be below entry.";
  } else {
    if (!(tp < entry)) return "Short take profit must be below entry.";
    if (!(sl > entry)) return "Short stop loss must be above entry.";
  }
  return null;
}

function cryptoPnlUsd(side: PulsePnlSide, entry: number, exit: number, marginUsd: number, leverage: number): number {
  const pct = movePct(side, entry, exit);
  return (marginUsd * pct * leverage) / 100;
}

export function calculatePulsePnl(raw: PulsePnlInput): PulsePnlResult | PulsePnlError {
  const market = raw.market === "forex" ? "forex" : "crypto";
  const side = raw.side === "short" ? "short" : "long";
  const symbol =
    market === "forex"
      ? normalizeForexSymbol(raw.symbol) || String(raw.symbol ?? "").trim().toUpperCase()
      : resolveScalpSymbol(raw.symbol);
  const entry = num(raw.entryPrice);
  const tp = num(raw.takeProfitPrice);
  const sl = num(raw.stopLossPrice);
  const leverage = Math.max(1, num(raw.leverage) || 1);
  const notes: string[] = [];

  const levelErr = validateLevels(side, entry, tp, sl);
  if (levelErr) return { ok: false, error: levelErr };

  const tpPct = movePct(side, entry, tp);
  const slPctAbs = Math.abs(movePct(side, entry, sl));
  const pipSize = market === "forex" ? pipSizeForForexSymbol(symbol) : null;
  const tpPips = market === "forex" ? Math.abs(pipsFromPrices(symbol, entry, tp)) : null;
  const slPips = market === "forex" ? Math.abs(pipsFromPrices(symbol, entry, sl)) : null;

  const account = num(raw.accountUsd);
  const riskPct = num(raw.riskPct);
  const riskBudget =
    account > 0 && riskPct > 0 ? (account * riskPct) / 100 : null;
  const sizeMode: "stop" | "margin" | "custom" =
    raw.sizeMode === "stop" || raw.sizeMode === "margin" || raw.sizeMode === "custom"
      ? raw.sizeMode
      : raw.sizeFromRisk
        ? "stop"
        : "custom";

  let marginUsd = Math.max(0, num(raw.marginUsd) || 0);
  let lots: number | null = market === "forex" ? Math.max(0, num(raw.lots) || 0) || null : null;
  let sizedFromRisk = false;
  let sizeMethod: "stop" | "margin" | "custom" = "custom";

  if (market === "crypto") {
    if (sizeMode === "margin" && riskBudget != null && riskBudget > 0) {
      // Exchange-style: PnL = margin × leverage × % move. Raising leverage raises $ PnL.
      marginUsd = riskBudget;
      sizedFromRisk = true;
      sizeMethod = "margin";
      notes.push(
        `Margin = ${riskPct}% of account ($${riskBudget.toFixed(2)}). Position ${leverage}x → $${(riskBudget * leverage).toFixed(2)} notional.`
      );
    } else if (sizeMode === "stop" && riskBudget != null && slPctAbs > 0) {
      // Keep $ at stop fixed — extra leverage only reduces margin.
      marginUsd = riskBudget / ((slPctAbs / 100) * leverage);
      sizedFromRisk = true;
      sizeMethod = "stop";
      notes.push(`Sized so stop ≈ ${riskPct}% of account ($${riskBudget.toFixed(2)}).`);
    }
    if (!(marginUsd > 0)) {
      return { ok: false, error: "Enter USD margin, or account size + risk % to size the position." };
    }
    const notionalUsd = marginUsd * leverage;
    const profitIfTpUsd = cryptoPnlUsd(side, entry, tp, marginUsd, leverage);
    const lossIfSlUsd = cryptoPnlUsd(side, entry, sl, marginUsd, leverage);
    const amountAtRiskUsd = Math.abs(lossIfSlUsd);
    const rr = amountAtRiskUsd > 0 ? profitIfTpUsd / amountAtRiskUsd : null;
    const liq = estimateBlofinIsolatedLiquidation({
      symbol,
      side,
      entryPrice: entry,
      leverage,
      positionNotionalUsdt: notionalUsd,
    });
    const liqLossUsd =
      liq.liquidationPrice != null
        ? cryptoPnlUsd(side, entry, liq.liquidationPrice, marginUsd, leverage)
        : null;
    const stopBeyond =
      liq.liquidationPrice != null
        ? side === "long"
          ? sl <= liq.liquidationPrice
          : sl >= liq.liquidationPrice
        : null;
    if (sizeMethod === "margin" && riskBudget != null && amountAtRiskUsd > riskBudget * 1.02) {
      notes.push(
        `Stop would lose $${amountAtRiskUsd.toFixed(2)} (${((amountAtRiskUsd / account) * 100).toFixed(2)}% of account) — more than the ${riskPct}% margin budget. Tighten SL or cut leverage.`
      );
    }
    if (stopBeyond) {
      notes.push("Stop is beyond estimated isolated liquidation — the broker may liquidate first.");
    }
    if (rr != null && rr < 1) {
      notes.push("Reward is smaller than risk at these levels (R:R under 1).");
    }

    return {
      ok: true,
      market,
      symbol,
      side,
      levels: {
        entryPrice: entry,
        takeProfitPrice: tp,
        stopLossPrice: sl,
        tpPct,
        slPct: slPctAbs,
        tpPips: null,
        slPips: null,
        pipSize: null,
      },
      leverage,
      notionalUsd,
      marginUsd,
      lots: null,
      lotBreakdown: null,
      pipValueUsdPerLot: null,
      pipValueUsdAtSize: null,
      pipValueUsdPerMiniLot: null,
      pipValueUsdPerMicroLot: null,
      units: null,
      amountAtRiskUsd,
      profitIfTpUsd,
      lossIfSlUsd,
      rewardRisk: rr,
      returnOnMarginIfTpPct: marginUsd > 0 ? (profitIfTpUsd / marginUsd) * 100 : 0,
      returnOnMarginIfSlPct: marginUsd > 0 ? (lossIfSlUsd / marginUsd) * 100 : 0,
      accountIfTp: account > 0 ? accountGainLoss(account, profitIfTpUsd) : null,
      accountIfSl: account > 0 ? accountGainLoss(account, lossIfSlUsd) : null,
      sizedFromRisk,
      sizeMethod,
      riskBudgetUsd: riskBudget,
      estimatedLiquidationPrice: liq.liquidationPrice,
      estimatedLiqDistancePct: liq.liqDistancePct,
      estimatedLiqLossUsd: liqLossUsd,
      estimatedLiqLossPctOfMargin:
        liqLossUsd != null && marginUsd > 0 ? (liqLossUsd / marginUsd) * 100 : null,
      stopBeyondEstimatedLiq: stopBeyond,
      notes,
    };
  }

  const pipValue = pipValueUsdPerLot(symbol, entry, { usdJpy: raw.usdJpy });
  if (!(pipValue > 0) || slPips == null || !(slPips > 0)) {
    return { ok: false, error: "Could not compute pip value. Check symbol and stop distance." };
  }

  if ((sizeMode === "stop" || sizeMode === "margin") && riskBudget != null && riskBudget > 0) {
    const rawLots = riskBudget / (slPips * pipValue);
    lots = Math.round(rawLots * 100) / 100;
    sizedFromRisk = true;
    notes.push(`Lots sized so stop ≈ ${riskPct}% of account ($${riskBudget.toFixed(2)}), BabyPips-style.`);
  } else if (lots != null && lots > 0) {
    /* keep lots */
  } else if (marginUsd > 0) {
    lots = estimateForexLotsFromMargin({
      symbol,
      entryPrice: entry,
      marginUsd,
      leverage,
    });
    notes.push("Lots estimated from margin × leverage (broker contract size may differ).");
  } else {
    return { ok: false, error: "Enter lots, margin, or account size + risk % to size the trade." };
  }

  if (!(lots > 0)) {
    return { ok: false, error: "Position size rounded to zero. Increase risk budget or tighten the stop." };
  }

  const amountAtRiskUsd = slPips * pipValue * lots;
  const profitIfTpUsd = (tpPips ?? 0) * pipValue * lots;
  const lossIfSlUsd = -amountAtRiskUsd;
  marginUsd =
    marginUsd > 0
      ? marginUsd
      : estimateForexMarginFromLots({
          symbol,
          entryPrice: entry,
          lotSize: lots,
          leverage,
        });
  const notionalUsd = lots * forexContractSize(symbol) * entry;
  const rr = amountAtRiskUsd > 0 ? profitIfTpUsd / amountAtRiskUsd : null;
  if (rr != null && rr < 1) {
    notes.push("Reward is smaller than risk at these levels (R:R under 1).");
  }
  notes.push(
    `Pip size ${pipSize} · ≈ $${pipValue.toFixed(2)} per pip per 1.00 lot. Confirm on your MT broker.`
  );

  return {
    ok: true,
    market,
    symbol,
    side,
    levels: {
      entryPrice: entry,
      takeProfitPrice: tp,
      stopLossPrice: sl,
      tpPct,
      slPct: slPctAbs,
      tpPips,
      slPips,
      pipSize,
    },
    leverage,
    notionalUsd,
    marginUsd,
    lots,
    lotBreakdown: lotsBreakdown(lots, symbol),
    pipValueUsdPerLot: pipValue,
    pipValueUsdAtSize: pipValue * lots,
    pipValueUsdPerMiniLot: pipValue / 10,
    pipValueUsdPerMicroLot: pipValue / 100,
    units: lotsBreakdown(lots, symbol).units,
    amountAtRiskUsd,
    profitIfTpUsd,
    lossIfSlUsd,
    rewardRisk: rr,
    returnOnMarginIfTpPct: marginUsd > 0 ? (profitIfTpUsd / marginUsd) * 100 : 0,
    returnOnMarginIfSlPct: marginUsd > 0 ? (lossIfSlUsd / marginUsd) * 100 : 0,
    accountIfTp: account > 0 ? accountGainLoss(account, profitIfTpUsd) : null,
    accountIfSl: account > 0 ? accountGainLoss(account, lossIfSlUsd) : null,
    sizedFromRisk,
    sizeMethod: sizedFromRisk ? "stop" : "custom",
    riskBudgetUsd: riskBudget,
    estimatedLiquidationPrice: null,
    estimatedLiqDistancePct: null,
    estimatedLiqLossUsd: null,
    estimatedLiqLossPctOfMargin: null,
    stopBeyondEstimatedLiq: null,
    notes,
  };
}
