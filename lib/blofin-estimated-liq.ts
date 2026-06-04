/**
 * Blofin USDT-margined perp liquidation estimates (isolated, linear).
 * Uses tier MMR + standard buffer formula; confirm on Blofin order ticket.
 */

import {
  contractsFromNotional,
  resolveBlofinMaintenanceMargin,
  type ResolveBlofinMmrResult,
} from "@/lib/blofin-margin-tiers";

export type BlofinLiqEstimateInput = {
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  leverage: number;
  positionNotionalUsdt?: number | null;
  positionContracts?: number | null;
  contractValue?: number | null;
  maintenanceMarginRate?: number | null;
  takerFeeRate?: number;
};

export type BlofinLiqEstimate = {
  liquidationPrice: number | null;
  liqDistancePct: number | null;
  marginUsdt: number | null;
  contracts: number | null;
  maintenanceMarginRate: number;
  tierLabel: string;
  initialMarginRate: number;
  note: string;
};

const DEFAULT_TAKER_FEE = 0.0006;

export function estimateBlofinIsolatedLiquidation(input: BlofinLiqEstimateInput): BlofinLiqEstimate {
  const entry = input.entryPrice;
  const leverage = Math.max(1, input.leverage);
  const cv = input.contractValue != null && input.contractValue > 0 ? input.contractValue : 0.01;
  const fee = input.takerFeeRate ?? DEFAULT_TAKER_FEE;

  let mmrResolved: ResolveBlofinMmrResult;
  if (input.maintenanceMarginRate != null && input.maintenanceMarginRate > 0) {
    mmrResolved = {
      maintenanceMarginRate: input.maintenanceMarginRate,
      contracts: input.positionContracts ?? null,
      notionalUsdt: input.positionNotionalUsdt ?? null,
      tierLabel: "custom MMR",
    };
  } else {
    mmrResolved = resolveBlofinMaintenanceMargin({
      symbol: input.symbol,
      markPrice: entry,
      positionNotionalUsdt: input.positionNotionalUsdt,
      positionContracts: input.positionContracts,
      contractValue: cv,
    });
  }

  const mmr = mmrResolved.maintenanceMarginRate;
  let contracts = input.positionContracts ?? mmrResolved.contracts;
  let notional = input.positionNotionalUsdt ?? mmrResolved.notionalUsdt;

  if (contracts == null && notional != null && entry > 0) {
    contracts = contractsFromNotional(notional, entry, cv);
  }
  if (notional == null && contracts != null && entry > 0) {
    notional = contracts * cv * entry;
  }

  const marginUsdt = notional != null && leverage > 0 ? notional / leverage : null;
  const buffer = 1 / leverage - mmr - fee;

  let liquidationPrice: number | null = null;
  if (entry > 0 && buffer > 0) {
    liquidationPrice =
      input.side === "long" ? entry * (1 - buffer) : entry * (1 + buffer);
  }

  const liqDistancePct =
    liquidationPrice != null && entry > 0
      ? (Math.abs(liquidationPrice - entry) / entry) * 100
      : null;

  return {
    liquidationPrice,
    liqDistancePct,
    marginUsdt,
    contracts,
    maintenanceMarginRate: mmr,
    tierLabel: mmrResolved.tierLabel,
    initialMarginRate: 1 / leverage,
    note:
      liquidationPrice != null
        ? `Isolated est. liq ~$${liquidationPrice.toFixed(2)} (${liqDistancePct?.toFixed(2)}% from entry, ${leverage}×, MMR ${(mmr * 100).toFixed(2)}%). Match Est. Liq. on Blofin before trading.`
        : "Could not estimate liquidation — check leverage and position size.",
  };
}
