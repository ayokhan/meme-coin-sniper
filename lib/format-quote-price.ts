/**
 * Display formatting for perp/spot quote prices (BTC, XAU, XLM, etc.).
 * Avoids forcing 2 decimals on sub-dollar alts (e.g. XLM 0.20634 → not "0.21").
 */

export function quotePriceDecimals(price: number): number {
  const abs = Math.abs(price);
  if (!Number.isFinite(abs) || abs === 0) return 2;
  if (abs >= 10_000) return 0;
  if (abs >= 1_000) return 1;
  if (abs >= 100) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.1) return 5;
  if (abs >= 0.01) return 5;
  if (abs >= 0.0001) return 6;
  return 8;
}

export function formatQuotePrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  const dec = quotePriceDecimals(price);
  return price.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, dec),
    maximumFractionDigits: dec,
  });
}

export function formatQuotePriceUsd(price: number | null | undefined): string {
  const s = formatQuotePrice(price);
  return s === "—" ? s : `$${s}`;
}
