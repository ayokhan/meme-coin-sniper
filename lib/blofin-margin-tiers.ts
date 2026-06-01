/**
 * Blofin maintenance margin tiers (illustrative) for NovaRadar liquidation estimates.
 * Source: Blofin position tier updates (XAUUSDT / XAGUSDT, Jan 2026 announcements).
 * Tiers are by max contracts; notional = contracts × contractValue × mark price.
 */

export type BlofinMarginTier = { maxContracts: number; maintenanceMarginRate: number };

/** XAU-USDT perpetual tiers (contracts). */
export const BLOFIN_XAU_USDT_TIERS: BlofinMarginTier[] = [
  { maxContracts: 9_000, maintenanceMarginRate: 0.005 },
  { maxContracts: 70_000, maintenanceMarginRate: 0.0065 },
  { maxContracts: 100_000, maintenanceMarginRate: 0.01 },
  { maxContracts: 700_000, maintenanceMarginRate: 0.02 },
  { maxContracts: 1_000_000, maintenanceMarginRate: 0.025 },
  { maxContracts: 7_000_000, maintenanceMarginRate: 0.05 },
  { maxContracts: 10_000_000, maintenanceMarginRate: 0.1 },
  { maxContracts: 19_000_000, maintenanceMarginRate: 0.125 },
  { maxContracts: 30_000_000, maintenanceMarginRate: 0.25 },
  { maxContracts: 70_000_000, maintenanceMarginRate: 0.5 },
];

/** XAG-USDT — same ladder shape as XAU on Blofin metals. */
export const BLOFIN_XAG_USDT_TIERS: BlofinMarginTier[] = [...BLOFIN_XAU_USDT_TIERS];

/** Generic USDT perp default when symbol is not a known Blofin metal. */
export const BLOFIN_DEFAULT_USDT_TIERS: BlofinMarginTier[] = [
  { maxContracts: 100_000, maintenanceMarginRate: 0.004 },
  { maxContracts: 500_000, maintenanceMarginRate: 0.005 },
  { maxContracts: 2_000_000, maintenanceMarginRate: 0.01 },
  { maxContracts: 10_000_000, maintenanceMarginRate: 0.025 },
  { maxContracts: 50_000_000, maintenanceMarginRate: 0.05 },
  { maxContracts: 200_000_000, maintenanceMarginRate: 0.125 },
  { maxContracts: Number.POSITIVE_INFINITY, maintenanceMarginRate: 0.25 },
];

export function parsePositionNotionalUsdt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parsePositionContracts(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const s = String(raw ?? "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function tiersForSymbol(symbol: string): BlofinMarginTier[] {
  const u = symbol.toUpperCase();
  if (u === "XAU" || u === "GOLD") return BLOFIN_XAU_USDT_TIERS;
  if (u === "XAG" || u === "SILVER") return BLOFIN_XAG_USDT_TIERS;
  return BLOFIN_DEFAULT_USDT_TIERS;
}

export function maintenanceMarginRateForContracts(
  contracts: number,
  tiers: BlofinMarginTier[]
): number {
  if (!Number.isFinite(contracts) || contracts <= 0) return tiers[0]?.maintenanceMarginRate ?? 0.005;
  for (const t of tiers) {
    if (contracts <= t.maxContracts) return t.maintenanceMarginRate;
  }
  return tiers[tiers.length - 1]?.maintenanceMarginRate ?? 0.5;
}

export function contractsFromNotional(
  notionalUsdt: number,
  markPrice: number,
  contractValue: number
): number | null {
  if (notionalUsdt <= 0 || markPrice <= 0 || contractValue <= 0) return null;
  return notionalUsdt / (markPrice * contractValue);
}

export type ResolveBlofinMmrInput = {
  symbol: string;
  markPrice: number;
  positionNotionalUsdt?: number | null;
  positionContracts?: number | null;
  contractValue?: number | null;
};

export type ResolveBlofinMmrResult = {
  maintenanceMarginRate: number;
  contracts: number | null;
  notionalUsdt: number | null;
  tierLabel: string;
};

/** Resolve MMR for Blofin-style isolated liquidation estimates in NovaRadar. */
export function resolveBlofinMaintenanceMargin(input: ResolveBlofinMmrInput): ResolveBlofinMmrResult {
  const tiers = tiersForSymbol(input.symbol);
  const cv =
    input.contractValue != null && input.contractValue > 0 ? input.contractValue : 0.01;
  let contracts = input.positionContracts ?? null;
  let notional = input.positionNotionalUsdt ?? null;

  if (contracts == null && notional != null && input.markPrice > 0) {
    contracts = contractsFromNotional(notional, input.markPrice, cv);
  }
  if (notional == null && contracts != null && input.markPrice > 0) {
    notional = contracts * cv * input.markPrice;
  }
  if (contracts == null) {
    return {
      maintenanceMarginRate: tiers[0]?.maintenanceMarginRate ?? 0.005,
      contracts: null,
      notionalUsdt: notional,
      tierLabel: "default (smallest tier)",
    };
  }

  const mmr = maintenanceMarginRateForContracts(contracts, tiers);
  const tierIdx = tiers.findIndex((t) => contracts! <= t.maxContracts);
  const tierLabel =
    tierIdx >= 0
      ? `tier ${tierIdx + 1} (≤${tiers[tierIdx].maxContracts.toLocaleString()} contracts)`
      : "max tier";

  return {
    maintenanceMarginRate: mmr,
    contracts,
    notionalUsdt: notional,
    tierLabel,
  };
}
