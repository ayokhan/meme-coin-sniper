const HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info";

type RawPosition = {
  coin?: string;
  szi?: string;
  entryPx?: string;
  positionValue?: string;
  unrealizedPnl?: string;
  leverage?: { type?: string; value?: number; rawUsd?: string };
  liquidationPx?: string;
  marginUsed?: string;
};

type RawAssetPosition = {
  position?: RawPosition;
  type?: string;
};

type RawClearinghouseState = {
  assetPositions?: RawAssetPosition[];
  marginSummary?: { accountValue?: string };
  crossMarginSummary?: { accountValue?: string };
};

export type HyperliquidPosition = {
  coin: string;
  side: "long" | "short";
  szi: string;
  entryPx: string;
  positionValue: string;
  openedAtMs?: number;
  marginUsed?: string;  // margin invested for this position
  unrealizedPnl: string;
  leverage?: number;
  liquidationPx?: string;
};

export type TopTraderState = {
  address: string;
  label?: string;
  nickname?: string | null;
  accountValue?: string;
  positions: HyperliquidPosition[];
  lastTradeTimeMs?: number | null;
  alertEnabled?: boolean;
};

function parsePosition(ap: RawAssetPosition): HyperliquidPosition | null {
  const p = ap?.position;
  if (!p?.coin) return null;
  const szi = (p.szi ?? "0").trim();
  const num = parseFloat(szi);
  const side: "long" | "short" = num >= 0 ? "long" : "short";
  return {
    coin: p.coin,
    side,
    szi: szi,
    entryPx: p.entryPx ?? "0",
    positionValue: p.positionValue ?? "0",
    marginUsed: p.marginUsed,
    unrealizedPnl: p.unrealizedPnl ?? "0",
    leverage: p.leverage?.value,
    liquidationPx: p.liquidationPx,
  };
}

function parseStateToTrader(
  state: RawClearinghouseState,
  address: string,
  traders: { address: string; label?: string; nickname?: string | null; alertEnabled?: boolean }[]
): TopTraderState {
  const trader = traders.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? { address, label: undefined, nickname: null, alertEnabled: false };
  const positions: HyperliquidPosition[] = (state.assetPositions ?? [])
    .map(parsePosition)
    .filter((p): p is HyperliquidPosition => p != null);
  const accountValue =
    state.marginSummary?.accountValue ?? state.crossMarginSummary?.accountValue;
  return {
    address: trader.address,
    label: trader.label,
    nickname: trader.nickname,
    accountValue,
    positions,
    alertEnabled: trader.alertEnabled,
  };
}

export type UserFill = {
  time: number;
  coin: string;
  dir: string;   // e.g. "Open Long", "Close Short", "Add Long"
  side: string;  // A | B
  sz: string;
  px: string;
  closedPnl?: string;
  fee?: string;
};

/** Fetch last fill time (ms) for a user. Returns undefined if API fails or no fills. */
export async function getLastFillTimeMs(user: string): Promise<number | undefined> {
  try {
    const end = Date.now();
    const start = end - 7 * 24 * 60 * 60 * 1000;
    const res = await fetch(HYPERLIQUID_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "userFillsByTime", user, startTime: start, endTime: end }),
    });
    if (!res.ok) return undefined;
    const raw = await res.json();
    const fills = Array.isArray(raw) ? raw : [];
    if (fills.length === 0) return undefined;
    const times = fills.map((f: { time?: number }) => (typeof f.time === "number" ? f.time : 0)).filter((t: number) => t > 0);
    return times.length > 0 ? Math.max(...times) : undefined;
  } catch {
    return undefined;
  }
}

/** Fetch recent fills for a user (last 7 days). Returns array sorted by time desc. */
export async function getUserFills(user: string, startTime?: number, endTime?: number): Promise<UserFill[]> {
  const end = endTime ?? Date.now();
  const start = startTime ?? end - 7 * 24 * 60 * 60 * 1000;
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "userFillsByTime", user, startTime: start, endTime: end }),
  });
  if (!res.ok) return [];
  const raw = await res.json();
  const fills = Array.isArray(raw) ? raw : [];
  const out: UserFill[] = fills.map((f: { time?: number; coin?: string; dir?: string; side?: string; sz?: string; px?: string; closedPnl?: string; fee?: string }) => ({
    time: typeof f.time === "number" ? f.time : 0,
    coin: f.coin ?? "",
    dir: f.dir ?? "",
    side: f.side ?? "",
    sz: f.sz ?? "0",
    px: f.px ?? "0",
    closedPnl: f.closedPnl,
    fee: f.fee,
  }));
  out.sort((a, b) => b.time - a.time);
  return out;
}

/** Fetch one user's clearinghouse state (fallback when batch fails). */
async function fetchOneClearinghouseState(user: string): Promise<RawClearinghouseState> {
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user }),
  });
  if (res.status === 429) throw new Error("Rate limited—please try again in a minute.");
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  const data = await res.json();
  return data as RawClearinghouseState;
}

/**
 * Fetch clearinghouse state for multiple Hyperliquid users (e.g. ApexLiquid top traders).
 * Returns one entry per address with their open perp positions (long/short).
 * Retries once on 5xx; falls back to single-user requests if batch returns 5xx.
 */
export async function getTopTradersPositions(
  traders: { address: string; label?: string }[]
): Promise<TopTraderState[]> {
  const addresses = traders.map((t) => t.address).filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
  if (addresses.length === 0) return [];

  const doBatch = async (): Promise<RawClearinghouseState[]> => {
    const res = await fetch(HYPERLIQUID_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "batchClearinghouseStates", users: addresses }),
      next: { revalidate: 30 },
    });
    if (res.status === 429) throw new Error("Rate limited—please try again in a minute.");
    if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
    const raw = await res.json();
    return Array.isArray(raw) ? raw : [];
  };

  let rawStates: RawClearinghouseState[] = [];
  try {
    rawStates = await doBatch();
  } catch (e) {
    const is429 = e instanceof Error && (e.message.includes("429") || e.message.includes("Rate limited"));
    const is5xx = e instanceof Error && /Hyperliquid API error: 5\d\d/.test(e.message);
    if (is429) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        rawStates = await doBatch();
      } catch {
        throw e;
      }
    } else if (is5xx) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        rawStates = await doBatch();
      } catch {
        // Fallback: fetch each user individually when batch is flaky
        rawStates = await Promise.all(
          addresses.map((addr) => fetchOneClearinghouseState(addr).catch(() => ({ assetPositions: [] as RawAssetPosition[], marginSummary: undefined, crossMarginSummary: undefined })))
        );
      }
    } else {
      throw e;
    }
  }

  if (rawStates.length === 0) return [];
  const results = rawStates.map((state, i) => parseStateToTrader(state, addresses[i] ?? "", traders));
  return results;
}

/** Asset context from metaAndAssetCtxs (index aligns with universe). */
type AssetCtx = {
  markPx?: string;
  midPx?: string;
  prevDayPx?: string;
  dayNtlVlm?: string;
  openInterest?: string;
  funding?: string;
};

export type TrendingPerp = {
  coin: string;
  markPx: string;
  prevDayPx: string;
  dayPct: number;
  dayNtlVlm: string;
  openInterest: string;
  /** Current funding rate (decimal, e.g. 0.0001 = 0.01%). Positive = longs pay shorts (long-heavy), negative = short-heavy. */
  funding?: string;
  /** When requesting a non-24h timeframe (5m, 15m, 30m, 1h). */
  timeframePct?: number;
  /** Short-timeframe % (from candles). Present when allTimeframes=1. */
  pct5m?: number;
  pct15m?: number;
  pct30m?: number;
  pct1h?: number;
  pct4h?: number;
  pct48h?: number;
  pct72h?: number;
  pct1w?: number;
  pct2w?: number;
  pct3w?: number;
  pct4w?: number;
};

/**
 * Fetch all perp markets with 24h price change and volume (Hyperliquid / Apex Liquid).
 * Sorted by absolute 24h % change desc so high-movers are first.
 */
export async function getTrendingPerps(limit = 50): Promise<TrendingPerp[]> {
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as [ { universe?: Array<{ name: string }> }, AssetCtx[] ];
  const meta = raw[0];
  const ctxs = Array.isArray(raw[1]) ? raw[1] : [];
  const universe = meta?.universe ?? [];
  const perps = universe
    .map((u, i): TrendingPerp | null => {
      const ctx = ctxs[i];
      if (!ctx?.markPx || ctx.prevDayPx == null || ctx.prevDayPx === "" || Number(ctx.prevDayPx) === 0)
        return null;
      const mark = Number(ctx.markPx);
      const prev = Number(ctx.prevDayPx);
      const dayPct = prev ? ((mark - prev) / prev) * 100 : 0;
      return {
        coin: u.name,
        markPx: ctx.markPx,
        prevDayPx: ctx.prevDayPx,
        dayPct,
        dayNtlVlm: ctx.dayNtlVlm ?? "0",
        openInterest: ctx.openInterest ?? "0",
        funding: ctx.funding,
      };
    })
    .filter((p): p is TrendingPerp => p != null);
  perps.sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct));
  return perps.slice(0, limit);
}

/** Coins we want (order preserved). Must match exchange symbols (e.g. BTC, ETH, SOL). */
const TOP_ALTCOINS = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "AVAX", "DOT", "LINK", "UNI", "ATOM", "LTC", "BCH", "NEAR", "APT", "ARB", "OP", "INJ", "MATIC"];

/**
 * Fetch perp data for a specific list of coins (e.g. top altcoins). Same shape as getTrendingPerps.
 * Order follows the requested coins; missing coins are omitted.
 */
export async function getPerpsByCoins(coins: string[]): Promise<TrendingPerp[]> {
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as [ { universe?: Array<{ name: string }> }, AssetCtx[] ];
  const meta = raw[0];
  const ctxs = Array.isArray(raw[1]) ? raw[1] : [];
  const universe = meta?.universe ?? [];
  const wantSet = new Set(coins.map((c) => c.toUpperCase()));
  const perps: TrendingPerp[] = [];
  for (let i = 0; i < universe.length; i++) {
    const u = universe[i];
    if (!wantSet.has(u.name.toUpperCase())) continue;
    const ctx = ctxs[i];
    if (!ctx?.markPx || ctx.prevDayPx == null || ctx.prevDayPx === "" || Number(ctx.prevDayPx) === 0) continue;
    const mark = Number(ctx.markPx);
    const prev = Number(ctx.prevDayPx);
    const dayPct = prev ? ((mark - prev) / prev) * 100 : 0;
    perps.push({
      coin: u.name,
      markPx: ctx.markPx,
      prevDayPx: ctx.prevDayPx,
      dayPct,
      dayNtlVlm: ctx.dayNtlVlm ?? "0",
      openInterest: ctx.openInterest ?? "0",
      funding: ctx.funding,
    });
  }
  // Sort to match requested coin order
  perps.sort((a, b) => {
    const ai = coins.findIndex((c) => c.toUpperCase() === a.coin.toUpperCase());
    const bi = coins.findIndex((c) => c.toUpperCase() === b.coin.toUpperCase());
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  return perps;
}

/** Fetch current perp universe symbols from Hyperliquid (for new-listing detection). */
export async function getUniverseSymbols(): Promise<string[]> {
  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as [{ universe?: Array<{ name: string }> }, unknown];
  const universe = raw[0]?.universe ?? [];
  return universe.map((u) => u.name).filter(Boolean);
}

export { TOP_ALTCOINS };
