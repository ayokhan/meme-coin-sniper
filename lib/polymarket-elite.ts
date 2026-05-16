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
  /** Polymarket username when available (preferred for tracker nicknames). */
  userName: string | null;
  displayName: string;
  pnl: number;
  vol: number;
  profileImage?: string;
  compositeScore: number;
};

export type EliteSignalFill = {
  side: "BUY" | "SELL";
  size: number;
  price: number;
  priceCents: number;
  notionalUsd: number;
  timestampMs: number | null;
};

export type EliteSignalWallet = {
  address: string;
  displayName: string;
  buyCount: number;
  sellCount: number;
  notionalUsd: number;
  lastTradeMs: number | null;
  /** Recent fills for this market+outcome (newest first, capped). */
  fills: EliteSignalFill[];
  avgPrice: number | null;
  avgPriceCents: number | null;
};

export type EliteCopyRecipe = {
  action: string;
  marketTitle: string;
  outcome: string;
  side: "BUY" | "SELL";
  weightedAvgPrice: number | null;
  weightedAvgPriceCents: number | null;
  totalShares: number;
  hint: string;
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
  /** What to mirror on Polymarket (side + outcome + typical fill price). */
  copyRecipe: EliteCopyRecipe;
};

export const ELITE_COUNT_OPTIONS = [5, 10, 20, 50] as const;
export type EliteCountOption = (typeof ELITE_COUNT_OPTIONS)[number];

export function normalizeEliteCount(n: number | undefined | null): EliteCountOption {
  const v = Number(n);
  return ELITE_COUNT_OPTIONS.includes(v as EliteCountOption) ? (v as EliteCountOption) : 5;
}

export type EliteScanResult = {
  category: PolymarketLeaderboardCategory;
  timePeriod: PolymarketLeaderboardTimePeriod;
  eliteCount: EliteCountOption;
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
    userName: x.row.userName?.trim() || null,
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
    userName: t.userName,
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

type WalletAgg = {
  displayName: string;
  buyCount: number;
  sellCount: number;
  notionalUsd: number;
  lastTradeMs: number | null;
  fills: EliteSignalFill[];
};

type SignalAgg = {
  slug: string;
  title: string;
  outcome: string;
  side: "BUY" | "SELL";
  buys: number;
  sells: number;
  notionalUsd: number;
  wallets: Map<string, WalletAgg>;
  lastActivityMs: number | null;
};

const MAX_FILLS_PER_WALLET = 12;

function pushFill(w: WalletAgg, t: PolymarketTradeRow, side: "BUY" | "SELL") {
  const sz = Number(t.size);
  const px = Number(t.price);
  if (!Number.isFinite(sz) || !Number.isFinite(px) || sz <= 0 || px <= 0) return;
  const tsMs = tradeTimestampToMs(t.timestamp);
  const fill: EliteSignalFill = {
    side,
    size: sz,
    price: px,
    priceCents: Math.round(px * 1000) / 10,
    notionalUsd: Number(tradeNotionalUsd(t).toFixed(2)),
    timestampMs: tsMs,
  };
  w.fills.push(fill);
  w.fills.sort((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
  if (w.fills.length > MAX_FILLS_PER_WALLET) w.fills.length = MAX_FILLS_PER_WALLET;
}

function walletAvgPrice(fills: EliteSignalFill[]): { avgPrice: number | null; avgPriceCents: number | null } {
  let shares = 0;
  let weighted = 0;
  for (const f of fills) {
    shares += f.size;
    weighted += f.size * f.price;
  }
  if (shares <= 0) return { avgPrice: null, avgPriceCents: null };
  const avgPrice = weighted / shares;
  return { avgPrice, avgPriceCents: Math.round(avgPrice * 1000) / 10 };
}

function buildCopyRecipe(
  title: string,
  outcome: string,
  side: "BUY" | "SELL",
  wallets: EliteSignalWallet[]
): EliteCopyRecipe {
  let totalShares = 0;
  let weighted = 0;
  for (const w of wallets) {
    for (const f of w.fills) {
      if (f.side !== side) continue;
      totalShares += f.size;
      weighted += f.size * f.price;
    }
  }
  const weightedAvgPrice = totalShares > 0 ? weighted / totalShares : null;
  const weightedAvgPriceCents =
    weightedAvgPrice != null ? Math.round(weightedAvgPrice * 1000) / 10 : null;
  const pricePart =
    weightedAvgPriceCents != null ? ` at ~${weightedAvgPriceCents}¢/share` : "";
  const action = `${side} · ${outcome}${pricePart}`;
  const hint =
    weightedAvgPriceCents != null
      ? `On Polymarket, open this market and ${side === "BUY" ? "buy" : "sell"} the “${outcome}” outcome. Elites paid about ${weightedAvgPriceCents}¢ per share on average (your fill may differ). Size to your own risk — not financial advice.`
      : `On Polymarket, open this market and ${side === "BUY" ? "buy" : "sell"} the “${outcome}” outcome. Size to your own risk — not financial advice.`;
  return {
    action,
    marketTitle: title,
    outcome,
    side,
    weightedAvgPrice: weightedAvgPrice != null ? Number(weightedAvgPrice.toFixed(4)) : null,
    weightedAvgPriceCents,
    totalShares: Number(totalShares.toFixed(2)),
    hint,
  };
}

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
    fills: [],
  };
  if (side === "BUY") wPrev.buyCount += 1;
  else wPrev.sellCount += 1;
  wPrev.notionalUsd += notional;
  pushFill(wPrev, t, side);
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
      .map(([address, w]) => {
        const sideFills = w.fills.filter((f) => f.side === s.side);
        const { avgPrice, avgPriceCents } = walletAvgPrice(sideFills);
        return {
          address,
          displayName: w.displayName,
          buyCount: w.buyCount,
          sellCount: w.sellCount,
          notionalUsd: Number(w.notionalUsd.toFixed(2)),
          lastTradeMs: w.lastTradeMs,
          fills: sideFills,
          avgPrice,
          avgPriceCents,
        };
      })
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
      copyRecipe: buildCopyRecipe(s.title, s.outcome, s.side, wallets),
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
  const eliteCount = normalizeEliteCount(opts.eliteCount);
  const minWallets = Math.max(2, Math.min(eliteCount, opts.minWallets ?? 2));
  const lookbackHours = opts.lookbackHours ?? defaultLookbackHours(timePeriod);
  const tradesPerWallet = Math.min(120, Math.max(30, opts.tradesPerWallet ?? (eliteCount > 20 ? 60 : 80)));
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

  const batchSize = 5;
  for (let i = 0; i < eliteTraders.length; i += batchSize) {
    const batch = eliteTraders.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (trader) => {
        const trades = await fetchPolymarketTrades(trader.proxyWallet, tradesPerWallet, 0, true);
        for (const t of trades) {
          const side = String(t.side ?? "").toUpperCase();
          if (side === "BUY") ingestTrade(buyAgg, t, trader.proxyWallet, trader.displayName, cutoffMs);
          else if (side === "SELL") ingestTrade(sellAgg, t, trader.proxyWallet, trader.displayName, cutoffMs);
        }
      })
    );
    if (i + batchSize < eliteTraders.length) await sleep(60);
  }

  const buySignals = toSignals(buyAgg, minWallets);
  const sellSignals = toSignals(sellAgg, minWallets);
  const signals = [...buySignals, ...sellSignals].sort((a, b) => b.score - a.score).slice(0, 30);

  return {
    category,
    timePeriod,
    eliteCount,
    lookbackHours,
    eliteTraders,
    signals,
    scannedAt: new Date().toISOString(),
    note:
      `Elite traders are the top ${eliteCount} profitable wallets on the Polymarket leaderboard (blended PnL + volume). Signals appear when ${minWallets}+ of them take the same side on the same market outcome within the last ${lookbackHours}h. Not financial advice.`,
  };
}

/** Format Polymarket Elite copy recipe for Coach Calls share (owner / coach user). */
export function formatEliteCopyRecipeForShare(
  recipe: EliteCopyRecipe,
  marketUrl: string,
  extras?: {
    walletCount?: number;
    strength?: "strong" | "moderate";
    totalNotionalUsd?: number;
    eliteNames?: string[];
  }
): { title: string; content: string } {
  const title = `Polymarket Elite · ${recipe.marketTitle}`;
  const lines: string[] = [
    "📊 Polymarket Elite consensus signal",
    "",
    `🎯 ${recipe.action}`,
    "",
    recipe.hint,
    "",
    `🔗 ${marketUrl}`,
  ];
  if (extras?.walletCount != null) {
    const strengthLabel = extras.strength === "strong" ? "Strong" : extras.strength === "moderate" ? "Moderate" : "";
    lines.push(
      `👥 ${extras.walletCount} elite trader${extras.walletCount === 1 ? "" : "s"} aligned${strengthLabel ? ` (${strengthLabel})` : ""}.`
    );
  }
  if (extras?.totalNotionalUsd != null && extras.totalNotionalUsd > 0) {
    lines.push(`💵 Combined elite notional ~$${Math.round(extras.totalNotionalUsd).toLocaleString()}.`);
  }
  if (extras?.eliteNames && extras.eliteNames.length > 0) {
    lines.push(`Traders: ${extras.eliteNames.slice(0, 8).join(", ")}${extras.eliteNames.length > 8 ? "…" : ""}`);
  }
  lines.push("", "Not financial advice. Size to your own risk.");
  return { title, content: lines.join("\n") };
}
