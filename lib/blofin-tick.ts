/**
 * Round a price to Blofin instrument tickSize (minimum price increment).
 * Avoids off-tick levels like $77.127 when tick is 0.01 → $77.13.
 */

export function tickDecimals(tickSize: number): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) return 8;
  const s = tickSize.toFixed(12).replace(/0+$/, "");
  const i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(12, s.length - i - 1);
}

export function roundToTickSize(price: number, tickSize: number | null | undefined): number {
  if (!Number.isFinite(price)) return price;
  if (tickSize == null || !Number.isFinite(tickSize) || tickSize <= 0) return price;
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(tickDecimals(tickSize)));
}

/** Heuristic decimals when Blofin tickSize is unavailable (forex / missing instrument). */
export function roundPxHeuristic(n: number, ref: number): number {
  if (!Number.isFinite(n)) return n;
  const decimals = ref >= 1000 ? 2 : ref >= 10 ? 3 : ref >= 1 ? 4 : 6;
  return Number(n.toFixed(decimals));
}

export function roundPx(n: number, ref: number, tickSize?: number | null): number {
  if (tickSize != null && Number.isFinite(tickSize) && tickSize > 0) {
    return roundToTickSize(n, tickSize);
  }
  return roundPxHeuristic(n, ref);
}
