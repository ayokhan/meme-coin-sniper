import type { GmgnTrendingToken } from "@/lib/gmgn-client-types";

function parseMetric(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const cleaned = raw.trim().replace(/%$/, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** GMGN may return percent as 5.2 or occasionally as 0.052 for 5.2%. */
function normalizePercent(n: number): number {
  if (n !== 0 && Math.abs(n) < 1) return n * 100;
  return n;
}

function field(tok: GmgnTrendingToken, key: string): unknown {
  return (tok as Record<string, unknown>)[key];
}

/** Liquidity in USD; 0 when unknown. */
export function tokenLiquidityUsd(tok: GmgnTrendingToken): number {
  const liq = parseMetric(tok.liquidity);
  if (liq != null && liq > 0) return liq;
  const mc = parseMetric(field(tok, "market_cap"));
  return mc != null && mc > 0 ? mc : 0;
}

/** Best 1h momentum reading from a 1h trending row. */
export function tokenMomentum1h(tok: GmgnTrendingToken): { value: number; known: boolean } {
  const candidates = [
    tok.price_change_percent,
    tok.price_change_percent1h,
    field(tok, "change1h"),
    field(tok, "price_change_percent_1h"),
  ];
  for (const c of candidates) {
    const n = parseMetric(c);
    if (n != null) return { value: normalizePercent(n), known: true };
  }
  return { value: 0, known: false };
}

export function tokenContractAddress(tok: GmgnTrendingToken): string | null {
  const addr = String(tok.address ?? tok.token_address ?? field(tok, "token_address") ?? "").trim();
  return addr || null;
}
