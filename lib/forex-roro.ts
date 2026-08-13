/**
 * Risk-on / risk-off meter for Nova Pulse Calculate PnL (forex).
 * Inspired by BabyPips RORO: session % vs prior close, weighted into 0–100.
 * Context for sizing — not a trade signal.
 */
import { getForexCandles, normalizeForexSymbol } from "@/lib/forex-market";

export type RoroBias = "risk_on" | "risk_off" | "neutral";

export type RoroInstrument = {
  symbol: string;
  label: string;
  /** +1 = up is risk-on; -1 = up is risk-off. */
  polarity: 1 | -1;
  weight: number;
  price: number | null;
  changePct: number | null;
  /** Contribution after polarity (− = toward risk-off). */
  signedPct: number | null;
};

export type RoroMeter = {
  score: number;
  bias: RoroBias;
  label: string;
  summary: string;
  instruments: RoroInstrument[];
  updatedAt: string;
};

const BASKET: Array<Pick<RoroInstrument, "symbol" | "label" | "polarity" | "weight">> = [
  { symbol: "SPX500", label: "S&P 500", polarity: 1, weight: 0.14 },
  { symbol: "NAS100", label: "Nasdaq 100", polarity: 1, weight: 0.11 },
  { symbol: "AUDUSD", label: "AUD/USD", polarity: 1, weight: 0.13 },
  { symbol: "NZDUSD", label: "NZD/USD", polarity: 1, weight: 0.1 },
  { symbol: "EURJPY", label: "EUR/JPY", polarity: 1, weight: 0.12 },
  { symbol: "USDJPY", label: "USD/JPY", polarity: 1, weight: 0.1 },
  { symbol: "XAUUSD", label: "Gold", polarity: -1, weight: 0.18 },
  { symbol: "USDCHF", label: "USD/CHF", polarity: 1, weight: 0.12 },
];

const CACHE_TTL_MS = 60_000;
let cache: { at: number; meter: RoroMeter } | null = null;
let inflight: Promise<RoroMeter> | null = null;

function biasFromScore(score: number): { bias: RoroBias; label: string; summary: string } {
  if (score >= 62) {
    return {
      bias: "risk_on",
      label: "Risk on",
      summary:
        "Growth assets and commodity FX are bid vs safe havens. Carry and AUD/NZD longs tend to align; gold / JPY longs often fight the tape.",
    };
  }
  if (score <= 38) {
    return {
      bias: "risk_off",
      label: "Risk off",
      summary:
        "Capital is rotating toward safety (gold, JPY/CHF). Equity and AUD/NZD longs are fighting the tape; reduce size or wait for a clearer tape.",
    };
  }
  return {
    bias: "neutral",
    label: "Neutral",
    summary: "Mixed session — no clear risk-on/off tilt. Size from your stop, not from the meter.",
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, n));
}

async function sessionChangePct(symbol: string): Promise<{ price: number; changePct: number } | null> {
  const candles = await getForexCandles(symbol, "1d", 5).catch(() => []);
  if (!candles || candles.length < 2) return null;
  const last = Number(candles[0]![4]);
  const prev = Number(candles[1]![4]);
  if (!(last > 0) || !(prev > 0)) return null;
  return { price: last, changePct: ((last - prev) / prev) * 100 };
}

async function buildMeter(): Promise<RoroMeter> {
  const rows = await Promise.all(
    BASKET.map(async (b) => {
      const move = await sessionChangePct(b.symbol);
      const changePct = move?.changePct ?? null;
      const signedPct = changePct != null ? changePct * b.polarity : null;
      return {
        ...b,
        price: move?.price ?? null,
        changePct,
        signedPct,
      } satisfies RoroInstrument;
    })
  );

  const usable = rows.filter((r) => r.signedPct != null);
  const weightSum = usable.reduce((s, r) => s + r.weight, 0) || 1;
  // Typical FX session moves are ~0.2–1.5%. Scale so ±1.2% weighted ≈ ±50 on the needle.
  const weighted = usable.reduce((s, r) => s + (r.signedPct as number) * (r.weight / weightSum), 0);
  const score = clampScore(50 + weighted * (50 / 1.2));
  const { bias, label, summary } = biasFromScore(score);

  return {
    score: Number(score.toFixed(1)),
    bias,
    label,
    summary,
    instruments: rows,
    updatedAt: new Date().toISOString(),
  };
}

export async function getForexRoroMeter(force = false): Promise<RoroMeter> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) return cache.meter;
  if (!force && inflight) return inflight;
  inflight = buildMeter()
    .then((meter) => {
      cache = { at: Date.now(), meter };
      return meter;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Typical risk-on longs for alignment copy. */
const RISK_ON_LONG = new Set([
  "AUDUSD",
  "NZDUSD",
  "EURJPY",
  "GBPJPY",
  "NAS100",
  "US30",
  "SPX500",
  "USDJPY",
  "EURUSD",
  "GBPUSD",
]);
const RISK_OFF_LONG = new Set(["XAUUSD", "XAGUSD", "USDCHF"]);

export type RoroAlignment = {
  status: "aligned" | "fighting" | "neutral" | "unknown";
  note: string;
};

export function roroAlignmentForTrade(
  symbolRaw: string,
  side: "long" | "short",
  meter: RoroMeter | null
): RoroAlignment {
  if (!meter || meter.bias === "neutral") {
    return {
      status: "neutral",
      note: "Meter is mixed — it does not confirm or veto this side. Size from the stop.",
    };
  }
  const symbol = normalizeForexSymbol(symbolRaw);
  let natural: "risk_on" | "risk_off" | null = null;
  if (RISK_ON_LONG.has(symbol)) natural = "risk_on";
  else if (RISK_OFF_LONG.has(symbol)) natural = "risk_off";
  else if (symbol.includes("JPY") && symbol.startsWith("USD")) natural = "risk_on";
  else if (symbol.includes("JPY")) natural = "risk_on";

  if (!natural) {
    return {
      status: "unknown",
      note: `${symbol} is not a classic RORO proxy. Use the meter as session context only.`,
    };
  }

  const tradeBias = side === "long" ? natural : natural === "risk_on" ? "risk_off" : "risk_on";
  if (tradeBias === meter.bias) {
    return {
      status: "aligned",
      note: `${side === "long" ? "Long" : "Short"} ${symbol} lines up with a ${meter.label.toLowerCase()} tape. Still not a signal — confirm structure in NovaQ.`,
    };
  }
  return {
    status: "fighting",
    note: `${side === "long" ? "Long" : "Short"} ${symbol} is fighting a ${meter.label.toLowerCase()} tape. Consider waiting, fading only with a tight stop, or flipping the idea.`,
  };
}
