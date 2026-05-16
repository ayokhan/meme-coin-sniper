/**
 * Polymarket Elite — consensus signals from top leaderboard traders (public Data API).
 */

import {
  fetchPolymarketTraderLeaderboard,
  fetchPolymarketTrades,
  tradeNotionalUsd,
  tradeTimestampToMs,
  type PolymarketLeaderboardCategory,
  type PolymarketLeaderboardEntry,
  type PolymarketLeaderboardTimePeriod,
  type PolymarketTradeRow,
} from "@/lib/polymarket-data-api";

export type EliteTrader = {
  rank: number;
  proxyWallet: string;
  displayName: string;
  pnl: number;
  vol: number;
  profileImage?: string;
  compositeScore: number;
};

export type EliteSignalWallet = {
  address: string;
  displayName: string;
  buyCount: number;
  sellCount: number;
  notionalUsd: number;
  lastTradeMs: number | null;
};

export type EliteConsensusSignal = {
  slug: string;
  title: string;
  outcome: string;
  /** Primary flow direction for this signal cluster */
  side: "BUY" | "SELL";
  walletCount: number;
  wallets: EliteSignalWallet[];
  totalNotionalUsd: number;
  netBuyCount: number;
  lastActivityMs: number | null;
  url: string;
  strength: "strong" | "moderate";
  score: number;
};

export type EliteScanResult = {
  category: PolymarketLeaderboardCategory;
  timePeriod: PolymarketLeaderboardTimePeriod;
  lookbackHours: number;
  eliteTraders: EliteTrader[];
  signals: EliteConsensusSignal[];
  scannedAt: string;
  note: string;
};

function isProxyWallet(a: string | undefined | null): a is string {
  return !!a && /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

function displayName(row: PolymarketLeaderboardEntry, wallet: string): string {
  const u = row.userName?.trim();
  if (u) return u;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Top N profitable traders by blended PnL + volume (leaderboard row fields). */
export function pickEliteTraders(entries: PolymarketLeaderboardEntry[], take = 5): EliteTrader[] {
  const valid = entries
    .filter((e) => isProxyWallet(e.proxyWallet))
    .map((e) => {
      const wallet = e.proxyWallet!.trim().toLowerCase();
      const pnl = Number(e.pnl);
      const vol = Number(e.vol);
      return { row: e, wallet, pnl, vol };
    })
    .filter((x) => Number.isFinite(x.pnl) && x.pnl > 0 && Number.isFinite(x.vol) && x.vol > 0);

  if (valid.length === 0) return [];

  const maxPnl = Math.max(...valid.map((x) => x.pnl), 1);
  const maxVol = Math.max(...valid.map((x) => x.vol), 1);

  const scored = valid.map((x) => ({
    wallet: x.wallet,
    displayName: displayName(x.row, x.wallet),
    pnl: x.pnl,
    vol: x.vol,
    profileImage: x.row.profileImage,
    compositeScore: 0.55 * (x.pnl / maxPnl) + 0.45 * (x.vol / maxVol),
  }));

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  return scored.slice(0, take).map((t, i) => ({
    rank: i + 1,
    proxyWallet: t.wallet,
    displayName: t.displayName,
    pnl: t.pnl,
    vol: t.vol,
    profileImage: t.profileImage,
    compositeScore: Number(t.compositeScore.toFixed(4)),
  }));
}

function defaultLookbackHours(period: PolymarketLeaderboardTimePeriod): number {
  if (period === "DAY") return 24;
  if (period === "WEEK") return 72;
  if (period === "MONTH") return 168;
  return 336;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type SignalAgg = {
  slug: string;
  title: string;
  outcome: string;
  side: "BUY" | "SELL";
  buys: number;
  sells: number;
  notionalUsd: number;
  wallets: Map<
    string,
    { displayName: string; buyCount: number; sellCount: number; notionalUsd: number; lastTradeMs: number | null }
  >;
  lastActivityMs: number | null;
};

function ingestTrade(
  agg: Map<string, SignalAgg>,
  t: PolymarketTradeRow,
  wallet: string,
  displayName: string,
  cutoffMs: number
) {
  const slug = String(t.slug ?? "").trim();
  if (!slug) return;
  const tsMs = tradeTimestampToMs(t.timestamp);
  if (cutoffMs > 0 && (tsMs == null || tsMs < cutoffMs)) return;

  const sideRaw = String(t.side ?? "").toUpperCase();
  if (sideRaw !== "BUY" && sideRaw !== "SELL") return;
  const side = sideRaw as "BUY" | "SELL";
  const outcome = String(t.outcome ?? "Unknown").trim() || "Unknown";
  const key = `${slug}::${outcome}::${side}`;

  const prev = agg.get(key) ?? {
    slug,
    title: String(t.title ?? "Untitled market").trim() || "Untitled market",
    outcome,
    side,
    buys: 0,
    sells: 0,
    notionalUsd: 0,
    wallets: new Map(),
    lastActivityMs: null,
  };

  const notional = tradeNotionalUsd(t);
  prev.notionalUsd += notional;
  if (side === "BUY") prev.buys += 1;
  else prev.sells += 1;

  const wPrev = prev.wallets.get(wallet) ?? {
    displayName,
    buyCount: 0,
    sellCount: 0,
    notionalUsd: 0,
    lastTradeMs: null,
  };
  if (side === "BUY") wPrev.buyCount += 1;
  else wPrev.sellCount += 1;
  wPrev.notionalUsd += notional;
  if (tsMs != null && (wPrev.lastTradeMs == null || tsMs > wPrev.lastTradeMs)) wPrev.lastTradeMs = tsMs;
  prev.wallets.set(wallet, wPrev);

  if (tsMs != null && (prev.lastActivityMs == null || tsMs > prev.lastActivityMs)) prev.lastActivityMs = tsMs;
  agg.set(key, prev);
}

function toSignals(agg: Map<string, SignalAgg>, minWallets: number): EliteConsensusSignal[] {
  const out: EliteConsensusSignal[] = [];

  for (const s of agg.values()) {
    const walletEntries = [...s.wallets.entries()].filter(([, w]) =>
      s.side === "BUY" ? w.buyCount > 0 : w.sellCount > 0
    );
    if (walletEntries.length < minWallets) continue;

    const wallets: EliteSignalWallet[] = walletEntries
      .map(([address, w]) => ({
        address,
        displayName: w.displayName,
        buyCount: w.buyCount,
        sellCount: w.sellCount,
        notionalUsd: Number(w.notionalUsd.toFixed(2)),
        lastTradeMs: w.lastTradeMs,
      }))
      .sort((a, b) => b.notionalUsd - a.notionalUsd);

    const walletCount = wallets.length;
    const netBuyCount = s.buys - s.sells;
    const score =
      walletCount * 25 +
      Math.min(50, netBuyCount * 3) +
      Math.log10(1 + s.notionalUsd) * 8 +
      (s.lastActivityMs != null ? 5 : 0);

    out.push({
      slug: s.slug,
      title: s.title,
      outcome: s.outcome,
      side: s.side,
      walletCount,
      wallets,
      totalNotionalUsd: Number(s.notionalUsd.toFixed(2)),
      netBuyCount,
      lastActivityMs: s.lastActivityMs,
      url: `https://polymarket.com/event/${s.slug}`,
      strength: walletCount >= 3 ? "strong" : "moderate",
      score: Number(score.toFixed(2)),
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export async function scanPolymarketEliteConsensus(opts: {
  category?: PolymarketLeaderboardCategory | string;
  timePeriod?: PolymarketLeaderboardTimePeriod | string;
  eliteCount?: number;
  minWallets?: number;
  lookbackHours?: number;
  tradesPerWallet?: number;
}): Promise<EliteScanResult> {
  const category = (opts.category ?? "OVERALL").toString().toUpperCase() as PolymarketLeaderboardCategory;
  const timePeriod = (opts.timePeriod ?? "WEEK").toString().toUpperCase() as PolymarketLeaderboardTimePeriod;
  const eliteCount = Math.min(5, Math.max(3, opts.eliteCount ?? 5));
  const minWallets = Math.max(2, Math.min(eliteCount, opts.minWallets ?? 2));
  const lookbackHours = opts.lookbackHours ?? defaultLookbackHours(timePeriod);
  const tradesPerWallet = Math.min(120, Math.max(30, opts.tradesPerWallet ?? 80));
  const cutoffMs = Date.now() - lookbackHours * 60 * 60 * 1000;

  const leaderboard = await fetchPolymarketTraderLeaderboard({
    category,
    timePeriod,
    orderBy: "PNL",
    limit: 50,
    offset: 0,
  });

  const eliteTraders = pickEliteTraders(leaderboard, eliteCount);
  const buyAgg = new Map<string, SignalAgg>();
  const sellAgg = new Map<string, SignalAgg>();

  for (const trader of eliteTraders) {
    const trades = await fetchPolymarketTrades(trader.proxyWallet, tradesPerWallet, 0, true);
    for (const t of trades) {
      const side = String(t.side ?? "").toUpperCase();
      if (side === "BUY") ingestTrade(buyAgg, t, trader.proxyWallet, trader.displayName, cutoffMs);
      else if (side === "SELL") ingestTrade(sellAgg, t, trader.proxyWallet, trader.displayName, cutoffMs);
    }
    await sleep(80);
  }

  const buySignals = toSignals(buyAgg, minWallets);
  const sellSignals = toSignals(sellAgg, minWallets);
  const signals = [...buySignals, ...sellSignals].sort((a, b) => b.score - a.score).slice(0, 30);

  return {
    category,
    timePeriod,
    lookbackHours,
    eliteTraders,
    signals,
    scannedAt: new Date().toISOString(),
    note:
      `Elite traders are the top ${eliteCount} profitable wallets on the Polymarket leaderboard (blended PnL + volume). Signals appear when ${minWallets}+ of them take the same side on the same market outcome within the last ${lookbackHours}h. Not financial advice.`,
  };
}
