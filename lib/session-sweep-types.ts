/** Client-safe types and constants for Nova Session Sweep (no server imports). */

export type SweepMarket = "forex" | "metal" | "crypto";
export type SweepTimeframe = "5m" | "15m" | "30m" | "1h";
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
  { id: "30m", label: "30 minutes", minutes: 30 },
  { id: "1h", label: "1 hour", minutes: 60 },
];

export type SweepLookbackId = "4h" | "12h" | "24h" | "3d" | "7d" | "14d" | "30d" | "60d";

export const SESSION_SWEEP_LOOKBACKS: { id: SweepLookbackId; label: string; hours: number }[] = [
  { id: "4h", label: "Last 4 hours", hours: 4 },
  { id: "12h", label: "Last 12 hours", hours: 12 },
  { id: "24h", label: "Last 24 hours", hours: 24 },
  { id: "3d", label: "Last 3 days", hours: 72 },
  { id: "7d", label: "Last 7 days", hours: 7 * 24 },
  { id: "14d", label: "Last 14 days", hours: 14 * 24 },
  { id: "30d", label: "Last 30 days", hours: 30 * 24 },
  { id: "60d", label: "Last 60 days", hours: 60 * 24 },
];

export function sweepLookbackLabel(hours: number): string {
  if (hours < 48) return `last ${hours} hours`;
  return `last ${Math.round(hours / 24)} days`;
}

export const SESSION_SWEEP_STOP_MODES: { id: SweepStopMode; label: string; hint: string }[] = [
  {
    id: "structure",
    label: "Tight stop (structure)",
    hint: "Stop just beyond the pullback swing that set up the break. Smaller risk, stopped out more often.",
  },
  {
    id: "sweep",
    label: "Wide stop (sweep wick)",
    hint: "Stop just beyond the tip of the sweep wick. Bigger risk, so the 3R target is further away.",
  },
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
  /** When the BOS level is known: the order that would be placed if it breaks. */
  plannedEntry: number | null;
  plannedStop: number | null;
  plannedTarget: number | null;
  /** In a trade: price is still within 0.3R of the entry, so joining late keeps roughly the same risk/reward. */
  entryStillValid: boolean;
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
  lookbackHours: number;
  /** Trades and stats only count entries at or after this time. */
  windowStartTs: number;
  stopMode: SweepStopMode;
  rr: number;
  barsAnalyzed: number;
  firstBarTs: number | null;
  lastBarTs: number | null;
  dataNote: string;
  live: SweepLiveState;
  levels: WatchedLevel[];
  /** Session ranges still in progress (their high/low can still move). */
  forming: SessionRange[];
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
