import { estimateBlofinIsolatedLiquidation } from "@/lib/blofin-estimated-liq";

/**
 * Illustrative leverage / ROE / liquidation helpers for NovaRadar.
 * Uses Blofin-style isolated formulas when symbol is provided.
 */

export type NovaRadarLeverageRisk = "low" | "moderate" | "high" | "extreme";

export type NovaRadarLeverageInput = {
  leverage: number;
  takeProfitPrice?: number | null;
  stopLossPrice?: number | null;
  /** Symbol for Blofin tier MMR + liq (e.g. XAU). */
  symbol?: string;
  side?: "long" | "short";
  positionNotionalUsdt?: number | null;
  contractValue?: number | null;
  /** Maintenance margin rate (decimal). XAU small tiers often ~0.005 on Blofin. */
  maintenanceMarginRate?: number;
  /** Taker fee per side (decimal). */
  takerFeeRate?: number;
};

export type NovaRadarStressSource = "other_plan" | "structure" | "none";

export type NovaRadarLeverageMetrics = {
  leverage: number;
  takeProfitPrice: number | null;
  stopLossPrice: number | null;
  estimatedLiqPrice: number | null;
  liqDistancePct: number | null;
  roeAtTpPct: number | null;
  roeAtSlPct: number | null;
  roeAtStressPct: number | null;
  stressPrice: number | null;
  stressSource: NovaRadarStressSource;
  maintenanceMarginRate: number;
  maintenanceMarginNote: string | null;
  riskRewardToTp: number | null;
  leverageRisk: NovaRadarLeverageRisk;
  notes: string[];
};

const DEFAULT_MMR = 0.005;
const DEFAULT_FEE = 0.0006;

export function parseLeverage(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 125) {
    return Math.round(raw);
  }
  const s = String(raw ?? "").replace(/[xX\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1 || n > 125) return null;
  return Math.round(n);
}

/** Signed spot move % from entry (long: positive when price above entry). */
export function spotMovePctFromEntry(entry: number, price: number, side: "long" | "short"): number {
  if (entry <= 0) return 0;
  const raw = ((price - entry) / entry) * 100;
  return side === "long" ? raw : -raw;
}

/** ROE % on margin ≈ spot move % × leverage (perp convention). */
export function roePct(spotMovePct: number, leverage: number): number {
  return spotMovePct * leverage;
}

/**
 * Isolated long liquidation price (illustrative).
 * Move against position ≈ 1/leverage − MMR − fees.
 */
export function estimateIsolatedLiqPriceLong(
  entry: number,
  leverage: number,
  mmr = DEFAULT_MMR,
  takerFeeRate = DEFAULT_FEE
): number | null {
  if (entry <= 0 || leverage < 1) return null;
  const buffer = 1 / leverage - mmr - takerFeeRate;
  if (buffer <= 0) return null;
  return entry * (1 - buffer);
}

export function estimateIsolatedLiqPriceShort(
  entry: number,
  leverage: number,
  mmr = DEFAULT_MMR,
  takerFeeRate = DEFAULT_FEE
): number | null {
  if (entry <= 0 || leverage < 1) return null;
  const buffer = 1 / leverage - mmr - takerFeeRate;
  if (buffer <= 0) return null;
  return entry * (1 + buffer);
}

export function classifyLeverageRisk(
  leverage: number,
  roeAtSl: number | null,
  roeAtStress: number | null,
  liqDistancePct: number | null,
  riskRewardToTp: number | null
): NovaRadarLeverageRisk {
  const worstLoss = Math.min(
    roeAtSl ?? 0,
    roeAtStress ?? 0,
    liqDistancePct != null ? -Math.abs(liqDistancePct) * leverage : 0
  );

  if (leverage >= 30 && (worstLoss <= -50 || (liqDistancePct != null && liqDistancePct < 3.5))) {
    return "extreme";
  }
  if (leverage >= 20 && worstLoss <= -40) return "extreme";
  if (leverage >= 15 && worstLoss <= -30) return "high";
  if (leverage >= 10 && worstLoss <= -20) return "high";
  if (riskRewardToTp != null && riskRewardToTp < 1 && leverage >= 10) return "high";
  if (leverage >= 5 && worstLoss <= -15) return "moderate";
  if (leverage >= 1) return "low";
  return "low";
}

export function computeNovaRadarLeverageMetrics(
  entry: number,
  side: "long" | "short",
  input: NovaRadarLeverageInput,
  options?: {
    stressPrice?: number | null;
    stressSource?: NovaRadarStressSource;
    maintenanceMarginNote?: string | null;
  }
): NovaRadarLeverageMetrics | null {
  const leverage = input.leverage;
  if (!Number.isFinite(leverage) || leverage < 1) return null;

  const tp = input.takeProfitPrice ?? null;
  const sl = input.stopLossPrice ?? null;
  const stressPrice = options?.stressPrice ?? null;
  const stressSource = options?.stressSource ?? (stressPrice != null ? "structure" : "none");
  const mmrNote = options?.maintenanceMarginNote ?? null;

  const blofinLiq =
    input.symbol && input.symbol.trim()
      ? estimateBlofinIsolatedLiquidation({
          symbol: input.symbol,
          side: input.side ?? side,
          entryPrice: entry,
          leverage,
          positionNotionalUsdt: input.positionNotionalUsdt,
          contractValue: input.contractValue,
          maintenanceMarginRate: input.maintenanceMarginRate,
          takerFeeRate: input.takerFeeRate,
        })
      : null;

  const mmr = blofinLiq?.maintenanceMarginRate ?? input.maintenanceMarginRate ?? DEFAULT_MMR;
  const fee = input.takerFeeRate ?? DEFAULT_FEE;

  const liq =
    blofinLiq?.liquidationPrice ??
    (side === "long"
      ? estimateIsolatedLiqPriceLong(entry, leverage, mmr, fee)
      : estimateIsolatedLiqPriceShort(entry, leverage, mmr, fee));

  const liqDistancePct =
    blofinLiq?.liqDistancePct ??
    (liq != null && entry > 0 ? (Math.abs(liq - entry) / entry) * 100 : null);

  const roeAtTp =
    tp != null ? roePct(spotMovePctFromEntry(entry, tp, side), leverage) : null;
  const roeAtSl =
    sl != null ? roePct(spotMovePctFromEntry(entry, sl, side), leverage) : null;
  const roeAtStress =
    stressPrice != null
      ? roePct(spotMovePctFromEntry(entry, stressPrice, side), leverage)
      : null;

  let riskRewardToTp: number | null = null;
  if (roeAtTp != null && roeAtTp > 0) {
    const risk = roeAtSl != null ? Math.abs(roeAtSl) : roeAtStress != null ? Math.abs(roeAtStress) : null;
    if (risk != null && risk > 0) riskRewardToTp = roeAtTp / risk;
  }

  const leverageRisk = classifyLeverageRisk(leverage, roeAtSl, roeAtStress, liqDistancePct, riskRewardToTp);

  const notes: string[] = [];
  notes.push(
    blofinLiq?.note ??
      `${leverage}× isolated estimate (MMR ${(mmr * 100).toFixed(2)}%${mmrNote ? `, ${mmrNote}` : ""}): ROE ≈ spot move % × ${leverage}. Confirm Est. Liq. on Blofin.`
  );
  if (blofinLiq?.marginUsdt != null) {
    notes.push(`Est. margin ~$${blofinLiq.marginUsdt.toFixed(2)} USDT at ${leverage}×.`);
  }
  if (stressSource === "other_plan" && stressPrice != null) {
    notes.push(`Stress uses the other trade plan’s limit ($${stressPrice.toFixed(2)}).`);
  } else if (stressSource === "structure" && stressPrice != null) {
    notes.push(`Stress uses nearest sampled structure support/resistance ($${stressPrice.toFixed(2)}).`);
  }
  if (liq != null && liqDistancePct != null) {
    notes.push(
      `Illustrative liquidation near $${liq.toFixed(2)} (~${liqDistancePct.toFixed(2)}% from entry ${side}).`
    );
  }
  if (roeAtTp != null) {
    notes.push(`If TP fills: ~${roeAtTp >= 0 ? "+" : ""}${roeAtTp.toFixed(1)}% ROE on margin.`);
  }
  if (roeAtSl != null) {
    notes.push(`If SL hits: ~${roeAtSl.toFixed(1)}% ROE on margin.`);
  }
  if (roeAtStress != null && stressPrice != null) {
    notes.push(
      `Stress at $${stressPrice.toFixed(2)}: ~${roeAtStress.toFixed(1)}% ROE — ${roeAtStress <= -50 ? "severe drawdown at this leverage" : "watch margin ratio on exchange"}.`
    );
  }
  if (riskRewardToTp != null) {
    notes.push(
      riskRewardToTp >= 1.5
        ? `ROE risk/reward to TP ≈ ${riskRewardToTp.toFixed(2)}:1 (reward vs SL/stress).`
        : riskRewardToTp < 1
          ? `ROE risk/reward to TP ≈ ${riskRewardToTp.toFixed(2)}:1 — reward smaller than risk at this leverage.`
          : `ROE risk/reward to TP ≈ ${riskRewardToTp.toFixed(2)}:1.`
    );
  }
  if (leverageRisk === "extreme" || leverageRisk === "high") {
    notes.push(
      leverageRisk === "extreme"
        ? "Leverage risk: extreme — consider lower leverage, smaller size, or a deeper limit with tighter stop."
        : "Leverage risk: high — structure may align but margin drawdown can force exit before your limit thesis plays out."
    );
  }

  return {
    leverage,
    takeProfitPrice: tp,
    stopLossPrice: sl,
    estimatedLiqPrice: liq,
    liqDistancePct,
    roeAtTpPct: roeAtTp,
    roeAtSlPct: roeAtSl,
    roeAtStressPct: roeAtStress,
    stressPrice,
    stressSource,
    maintenanceMarginRate: mmr,
    maintenanceMarginNote: mmrNote,
    riskRewardToTp,
    leverageRisk,
    notes,
  };
}
