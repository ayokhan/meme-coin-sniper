/**
 * Shared intraday timeframe configs for NovaForecast, NovaSmart, NovaQ, NovaQ Fib, Nova Forex.
 */

export const NOVA_TF_1M = { id: "1m", label: "1 min", interval: "1m", limit: 1 } as const;

export type NovaTimeframeConfig = {
  id: string;
  label: string;
  interval: string;
  limit: number;
};

export const NOVA_STANDARD_TIMEFRAMES: readonly NovaTimeframeConfig[] = [
  NOVA_TF_1M,
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "10h", label: "10 hours", interval: "15m", limit: 40 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "72h", label: "72 hours", interval: "1h", limit: 72 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "3w", label: "3 weeks", interval: "1d", limit: 21 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "5w", label: "5 weeks", interval: "1d", limit: 35 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
  { id: "52w", label: "52 weeks", interval: "1d", limit: 364 },
  { id: "104w", label: "104 weeks", interval: "1d", limit: 728 },
];

/** Checkbox ids for UI (same order as NOVA_STANDARD_TIMEFRAMES). */
export const NOVA_UI_TIMEFRAME_IDS = NOVA_STANDARD_TIMEFRAMES.map((t) => t.id);

export function sortNovaTimeframeIds(ids: string[]): string[] {
  const order = NOVA_UI_TIMEFRAME_IDS;
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export const NOVA_FORECAST_RANGES: readonly NovaTimeframeConfig[] = [
  NOVA_TF_1M,
  { id: "15m", label: "Last 15 mins", interval: "1m", limit: 15 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "10h", label: "10 hours", interval: "15m", limit: 40 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "3w", label: "3 weeks", interval: "1d", limit: 21 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
  { id: "5w", label: "5 weeks", interval: "1d", limit: 35 },
  { id: "6w", label: "6 weeks", interval: "1d", limit: 42 },
];

export const NOVA_FOREX_Q_TIMEFRAMES: readonly NovaTimeframeConfig[] = [
  NOVA_TF_1M,
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
];

export const NOVA_Q_FIB_TIMEFRAMES: readonly NovaTimeframeConfig[] = [
  NOVA_TF_1M,
  { id: "5m", label: "5 mins", interval: "1m", limit: 5 },
  { id: "15m", label: "15 mins", interval: "1m", limit: 15 },
  { id: "30m", label: "30 mins", interval: "1m", limit: 30 },
  { id: "1h", label: "1 hour", interval: "1m", limit: 60 },
  { id: "2h", label: "2 hours", interval: "5m", limit: 24 },
  { id: "4h", label: "4 hours", interval: "5m", limit: 48 },
  { id: "6h", label: "6 hours", interval: "15m", limit: 24 },
  { id: "12h", label: "12 hours", interval: "15m", limit: 48 },
  { id: "24h", label: "24 hours", interval: "1h", limit: 24 },
  { id: "48h", label: "48 hours", interval: "1h", limit: 48 },
  { id: "1w", label: "1 week", interval: "1d", limit: 7 },
  { id: "2w", label: "2 weeks", interval: "1d", limit: 14 },
  { id: "4w", label: "4 weeks", interval: "1d", limit: 28 },
];

/** Default NovaQ / Smart picks: intraday (avoid mixing 15m with 1w). */
export const NOVA_DEFAULT_TF_IDS = ["15m", "1h", "4h"] as const;
