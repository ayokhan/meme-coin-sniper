/** Client-safe types and constants for Nova Session Sweep (no server imports). */

export type SweepMarket = "forex" | "metal" | "crypto";
export type SweepTimeframe = "5m" | "15m";
export type SweepStopMode = "structure" | "sweep";
export type SessionName = "Asia" | "London" | "New York";
export type SweepDirection = "long" | "short";

export type SweepSymbol = { symbol: string; label: string; market: SweepMarket };

export const SESSION_SWEEP_SYMBOLS: SweepSymbol[] = [
  { symbol: "XAUUSD", label: "Gold", market: "metal" },
  { symbol: "XAGUSD", label: "Silver", market: "metal" },
  { symbol: "EURUSD", label: "EUR/USD", market: "forex" },
  { symbol: "GBPUSD", label: "GBP/USD", market: "forex" },
  { symbol: "USDJPY", label: "USD/JPY", market: "forex" },
  { symbol: "AUDUSD", label: "AUD/USD", market: "forex" },
  { symbol: "USDCAD", label: "USD/CAD", market: "forex" },
  { symbol: "GBPJPY", label: "GBP/JPY", market: "forex" },
  { symbol: "EURJPY", label: "EUR/JPY", market: "forex" },
  { symbol: "BTC", label: "Bitcoin perp", market: "crypto" },
  { symbol: "ETH", label: "Ethereum perp", market: "crypto" },
  { symbol: "SOL", label: "Solana perp", market: "crypto" },
  { symbol: "XRP", label: "XRP perp", market: "crypto" },
  { symbol: "DOGE", label: "Dogecoin perp", market: "crypto" },
  { symbol: "HYPE", label: "Hyperliquid perp", market: "crypto" },
];

export const SESSION_SWEEP_TIMEFRAMES: { id: SweepTimeframe; label: string; minutes: number }[] = [
  { id: "5m", label: "5 minutes", minutes: 5 },
  { id: "15m", label: "15 minutes", minutes: 15 },
];

export const SESSION_SWEEP_LOOKBACK_DAYS = [7, 14, 30, 60] as const;

export const SESSION_SWEEP_STOP_MODES: { id: SweepStopMode; label: string; hint: string }[] = [
  { id: "structure", label: "Structure stop", hint: "Beyond the lower high / higher low that confirmed the break" },
  { id: "sweep", label: "Sweep stop", hint: "Beyond the sweep wick (wider stop, smaller size)" },
];

export const SESSION_SWEEP_NAMES: SessionName[] = ["Asia", "London", "New York"];

/** Display copy for the rules; the engine in lib/session-sweep.ts implements exactly these. */
export const SESSION_SWEEP_SESSION_HOURS: Record<SessionName, string> = {
  Asia: "8:00 pm – midnight New York time",
  London: "7:00 – 10:00 am London time",
  "New York": "7:00 – 10:00 am New York time",
};

export type SessionRange = {
  session: SessionName;
  key: string;
  startTs: number;
  endTs: number;
  high: number;
  low: number;
};

export type LevelStatus = "untouched" | "raiding" | "swept" | "broken";

export type WatchedLevel = {
  session: SessionName;
  side: "high" | "low";
  price: number;
  status: LevelStatus;
  sessionEndTs: number;
  /** False once the range is older than the sweep window (about 20h). */
  active: boolean;
};

export type SweepTradeOutcome = "open" | "tp" | "sl" | "timeout";

export type SweepTrade = {
  id: string;
  direction: SweepDirection;
  huntSession: SessionName;
  sweptSession: SessionName;
  sweptSide: "high" | "low";
  sweptLevel: number;
  sweepTs: number;
  sweepExtreme: number;
  chochTs: number;
  chochLevel: number;
  bosTs: number;
  bosLevel: number;
  structureSwing: number;
  entryTs: number;
  entry: number;
  stop: number;
  target: number;
  risk: number;
  outcome: SweepTradeOutcome;
  exitTs: number | null;
  exitPrice: number | null;
  /** Realized R multiple (TP = +RR, SL = -1, timeout = mark-to-close). Open trades: unrealized. */
  r: number | null;
};

export type SweepLiveStage = "idle" | "swept" | "choch" | "in_trade";

export type SweepLiveState = {
  stage: SweepLiveStage;
  direction: SweepDirection | null;
  message: string;
  sweptSession: SessionName | null;
  sweptSide: "high" | "low" | null;
  sweptLevel: number | null;
  sweepExtreme: number | null;
  /** Close beyond this = change of character (CHoCH). */
  chochLevel: number | null;
  /** Close beyond this = break of structure (BOS) → entry. */
  bosLevel: number | null;
  trade: SweepTrade | null;
  currentHunt: SessionName | null;
  lastPrice: number | null;
  lastBarTs: number | null;
};

export type SweepSessionStats = { trades: number; wins: number; losses: number; totalR: number };

export type SweepStats = {
  trades: number;
  wins: number;
  losses: number;
  timeouts: number;
  open: number;
  winRate: number | null;
  totalR: number;
  avgR: number | null;
  profitFactor: number | null;
  maxLosingStreak: number;
  bySession: Record<SessionName, SweepSessionStats>;
  byDirection: Record<SweepDirection, SweepSessionStats>;
  /** Cumulative R after each closed trade (oldest → newest). */
  equity: number[];
};

/** Compact bar for charts: [openTimeMs, open, high, low, close]. */
export type SweepChartBar = [number, number, number, number, number];

export type SweepChart = {
  bars: SweepChartBar[];
  ranges: SessionRange[];
  trades: SweepTrade[];
  fromTs: number;
  toTs: number;
};

export type SessionSweepResult = {
  symbol: string;
  label: string;
  market: SweepMarket;
  timeframe: SweepTimeframe;
  lookbackDays: number;
  stopMode: SweepStopMode;
  rr: number;
  barsAnalyzed: number;
  firstBarTs: number | null;
  lastBarTs: number | null;
  dataNote: string;
  live: SweepLiveState;
  levels: WatchedLevel[];
  trades: SweepTrade[];
  stats: SweepStats;
  chart: SweepChart;
};

export type SessionSweepScanRow = {
  symbol: string;
  label: string;
  market: SweepMarket;
  ok: boolean;
  error?: string;
  live?: SweepLiveState;
  stats?: Pick<SweepStats, "trades" | "winRate" | "totalR" | "avgR">;
  lastTrade?: SweepTrade | null;
};

export function sweepPriceDecimals(price: number): number {
  const p = Math.abs(price);
  if (p >= 1000) return 2;
  if (p >= 100) return 3;
  if (p >= 10) return 4;
  if (p >= 1) return 5;
  return 6;
}

export function formatSweepPrice(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "—";
  return price.toLocaleString("en-US", {
    minimumFractionDigits: sweepPriceDecimals(price),
    maximumFractionDigits: sweepPriceDecimals(price),
  });
}
