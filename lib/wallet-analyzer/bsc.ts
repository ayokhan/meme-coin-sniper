/**
 * BSC wallet analyzer (free APIs only).
 *
 * Sources:
 *   - BscScan public API (free tier; works without a key with reduced rate limit). Set
 *     BSCSCAN_API_KEY in env for higher throughput.
 *   - Dexscreener (no key) for BNB/USD and per-token USD prices.
 *
 * Heuristics:
 *   For each tx hash that touches the wallet:
 *     • nativeDelta (BNB) = (BNB received via internal txs) − (BNB sent in normal tx value)
 *     • primary token  = largest |delta| ERC-20 transfer for the wallet in that tx,
 *       ignoring wrapped BNB and stablecoins.
 *   action = buy if nativeDelta<0 && tokenDelta>0; sell if nativeDelta>0 && tokenDelta<0; else swap.
 *
 * Holdings: aggregated net ERC-20 transfers (received − sent) per token in the window.
 *           Anything ≤ 0 is dropped.
 */

import type {
  AnalyzerHolding,
  AnalyzerPeriod,
  AnalyzerPosition,
  AnalyzerTrade,
  WalletAnalysis,
} from "./types";
import { buildVerdict } from "./verdict";

const BSCSCAN_API = "https://api.bscscan.com/api";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY ?? "YourApiKeyToken";
const DEXSCREENER_BASE = "https://api.dexscreener.com";

// Wrapped BNB + common stablecoins on BSC (filtered from "primary token" detection).
const WBNB = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
const STABLES = new Set([
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
  WBNB,
]);

const PERIOD_MS: Record<AnalyzerPeriod, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const MAX_TRADES = 200;
const WEI = 1e18;

type BscTokenTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  contractAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimal: string;
  value: string;
};

type BscNormalTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
};

type BscInternalTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
};

async function bscGet<T>(params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams({ ...params, apikey: BSCSCAN_API_KEY });
  try {
    const res = await fetch(`${BSCSCAN_API}?${qs.toString()}`, { cache: "no-store", next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { status?: string; result?: T[] | string };
    if (typeof data.result === "string") return []; // BscScan returns string on rate-limit
    return Array.isArray(data.result) ? data.result : [];
  } catch {
    return [];
  }
}

function lowerOrEmpty(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

async function getBnbUsdPrice(): Promise<number> {
  // Dexscreener has WBNB priced on multiple chains; we can hit /latest/dex/tokens/{wbnb} which
  // returns pairs across all chains, then pick the BSC one with deepest liquidity.
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${WBNB}`, { cache: "no-store" });
    if (!res.ok) throw new Error("dex");
    const data = (await res.json()) as { pairs?: Array<{ chainId?: string; priceUsd?: string; liquidity?: { usd?: number } }> };
    const pairs = (data.pairs ?? []).filter((p) => p.chainId === "bsc");
    pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const best = pairs[0];
    const price = best?.priceUsd ? Number(best.priceUsd) : NaN;
    if (Number.isFinite(price) && price > 0) return price;
  } catch {
    /* fall through */
  }
  return 700; // safe fallback; only used if Dexscreener is down
}

async function getBscTokenPricesUsd(addresses: string[]): Promise<Map<string, { priceUsd: number; symbol?: string }>> {
  const out = new Map<string, { priceUsd: number; symbol?: string }>();
  const dedup = Array.from(new Set(addresses.filter(Boolean).map((a) => a.toLowerCase())));
  if (dedup.length === 0) return out;
  const chunks: string[][] = [];
  for (let i = 0; i < dedup.length; i += 30) chunks.push(dedup.slice(i, i + 30));
  for (const c of chunks) {
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${c.join(",")}`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: Array<{ chainId?: string; baseToken?: { address?: string; symbol?: string }; priceUsd?: string; liquidity?: { usd?: number } }> };
      const best = new Map<string, { priceUsd: number; symbol?: string; liq: number }>();
      for (const p of data.pairs ?? []) {
        if (p.chainId !== "bsc") continue;
        const addr = lowerOrEmpty(p.baseToken?.address);
        const priceUsd = p.priceUsd ? Number(p.priceUsd) : NaN;
        if (!addr || !Number.isFinite(priceUsd) || priceUsd <= 0) continue;
        const liq = p.liquidity?.usd ?? 0;
        const prev = best.get(addr);
        if (!prev || liq > prev.liq) {
          best.set(addr, { priceUsd, symbol: p.baseToken?.symbol, liq });
        }
      }
      for (const [addr, v] of best.entries()) out.set(addr, { priceUsd: v.priceUsd, symbol: v.symbol });
    } catch {
      /* skip batch */
    }
  }
  return out;
}

export async function analyzeBscWallet(walletAddress: string, period: AnalyzerPeriod): Promise<WalletAnalysis> {
  const generatedAtMs = Date.now();
  const periodMs = PERIOD_MS[period];
  const cutoffSec = Math.floor((generatedAtMs - periodMs) / 1000);
  const wallet = walletAddress.toLowerCase();
  const notes: string[] = [];
  if (BSCSCAN_API_KEY === "YourApiKeyToken") {
    notes.push(
      "BscScan API key is not set on the server (BSCSCAN_API_KEY). Free public access works but is rate-limited; large windows may be partial.",
    );
  }

  const bnbUsd = await getBnbUsdPrice();

  // Fetch ERC-20 transfers, normal txs, and internal txs in parallel.
  const [tokenTxs, normalTxs, internalTxs] = await Promise.all([
    bscGet<BscTokenTx>({
      module: "account",
      action: "tokentx",
      address: walletAddress,
      page: "1",
      offset: "500",
      sort: "desc",
    }),
    bscGet<BscNormalTx>({
      module: "account",
      action: "txlist",
      address: walletAddress,
      page: "1",
      offset: "500",
      sort: "desc",
    }),
    bscGet<BscInternalTx>({
      module: "account",
      action: "txlistinternal",
      address: walletAddress,
      page: "1",
      offset: "500",
      sort: "desc",
    }),
  ]);

  // Group by tx hash: build (nativeDelta, primary token).
  type Agg = {
    hash: string;
    timeStamp: number;
    nativeDelta: number; // BNB (signed)
    transfers: Array<{ contract: string; amount: number; symbol: string; from: string; to: string }>;
  };
  const byHash = new Map<string, Agg>();

  function ensure(hash: string, timeStamp: number): Agg {
    let agg = byHash.get(hash);
    if (!agg) {
      agg = { hash, timeStamp, nativeDelta: 0, transfers: [] };
      byHash.set(hash, agg);
    }
    return agg;
  }

  // Normal txs → BNB out (when wallet is sender)
  for (const t of normalTxs) {
    const ts = Number(t.timeStamp);
    if (!Number.isFinite(ts) || ts < cutoffSec) continue;
    if (t.isError === "1") continue;
    const fromMatch = lowerOrEmpty(t.from) === wallet;
    const toMatch = lowerOrEmpty(t.to) === wallet;
    if (!fromMatch && !toMatch) continue;
    const valueBnb = Number(t.value) / WEI;
    if (!Number.isFinite(valueBnb) || valueBnb === 0) continue;
    const agg = ensure(t.hash, ts);
    if (fromMatch) agg.nativeDelta -= valueBnb;
    if (toMatch) agg.nativeDelta += valueBnb;
  }

  // Internal txs → BNB in/out (router payouts on sells, etc.)
  for (const t of internalTxs) {
    const ts = Number(t.timeStamp);
    if (!Number.isFinite(ts) || ts < cutoffSec) continue;
    const fromMatch = lowerOrEmpty(t.from) === wallet;
    const toMatch = lowerOrEmpty(t.to) === wallet;
    if (!fromMatch && !toMatch) continue;
    const valueBnb = Number(t.value) / WEI;
    if (!Number.isFinite(valueBnb) || valueBnb === 0) continue;
    const agg = ensure(t.hash, ts);
    if (fromMatch) agg.nativeDelta -= valueBnb;
    if (toMatch) agg.nativeDelta += valueBnb;
  }

  // Token transfers
  for (const t of tokenTxs) {
    const ts = Number(t.timeStamp);
    if (!Number.isFinite(ts) || ts < cutoffSec) continue;
    const dec = Number(t.tokenDecimal) || 0;
    const raw = Number(t.value);
    if (!Number.isFinite(raw) || raw === 0) continue;
    const amount = raw / 10 ** dec;
    const contract = lowerOrEmpty(t.contractAddress);
    if (!contract) continue;
    const agg = ensure(t.hash, ts);
    agg.transfers.push({
      contract,
      amount,
      symbol: t.tokenSymbol,
      from: lowerOrEmpty(t.from),
      to: lowerOrEmpty(t.to),
    });
  }

  // Build trade list + per-token aggregates from the merged map.
  const trades: AnalyzerTrade[] = [];
  const perToken = new Map<string, {
    symbol?: string;
    trades: number;
    buys: number;
    sells: number;
    spentNative: number;
    receivedNative: number;
    netUiAmount: number;
    tokensReceived: number;
    tokensSold: number;
    firstBuyAtMs: number | null;
  }>();
  let volumeNative = 0;
  let totalCostBasisNative = 0;

  const sorted = Array.from(byHash.values()).sort((a, b) => b.timeStamp - a.timeStamp);
  for (const agg of sorted) {
    // Determine primary token: largest |amount| transfer for the wallet, excluding WBNB/stables.
    let primary: { contract: string; amount: number; symbol: string } | null = null;
    for (const tr of agg.transfers) {
      if (STABLES.has(tr.contract)) continue;
      const involvesWallet = tr.from === wallet || tr.to === wallet;
      if (!involvesWallet) continue;
      const signed = tr.to === wallet ? tr.amount : -tr.amount;
      if (!primary || Math.abs(signed) > Math.abs(primary.amount)) {
        primary = { contract: tr.contract, amount: signed, symbol: tr.symbol };
      }
      // Track net UI amount for holdings aggregation (regardless of whether it's the primary one).
      const cur = perToken.get(tr.contract) ?? {
        symbol: tr.symbol,
        trades: 0,
        buys: 0,
        sells: 0,
        spentNative: 0,
        receivedNative: 0,
        netUiAmount: 0,
        tokensReceived: 0,
        tokensSold: 0,
        firstBuyAtMs: null as number | null,
      };
      cur.netUiAmount += signed;
      if (tr.symbol && !cur.symbol) cur.symbol = tr.symbol;
      perToken.set(tr.contract, cur);
    }
    if (!primary) continue;

    const nativeDelta = agg.nativeDelta;
    volumeNative += Math.abs(nativeDelta);

    let action: AnalyzerTrade["action"] = "swap";
    if (nativeDelta < 0 && primary.amount > 0) action = "buy";
    else if (nativeDelta > 0 && primary.amount < 0) action = "sell";

    const cur = perToken.get(primary.contract)!;
    cur.trades += 1;
    const tsMs = agg.timeStamp * 1000;
    if (action === "buy") {
      cur.buys += 1;
      cur.spentNative += Math.abs(nativeDelta);
      cur.tokensReceived += Math.abs(primary.amount);
      totalCostBasisNative += Math.abs(nativeDelta);
      if (tsMs && (cur.firstBuyAtMs === null || tsMs < cur.firstBuyAtMs)) cur.firstBuyAtMs = tsMs;
    } else if (action === "sell") {
      cur.sells += 1;
      cur.receivedNative += nativeDelta;
      cur.tokensSold += Math.abs(primary.amount);
    }

    if (trades.length < MAX_TRADES) {
      trades.push({
        signature: agg.hash,
        timestampMs: agg.timeStamp * 1000,
        action,
        mint: primary.contract,
        symbol: primary.symbol ?? null,
        nativeDelta,
        tokenDelta: primary.amount,
        notionalUsd: Math.abs(nativeDelta) * bnbUsd,
      });
    }
  }

  // Price every contract once (held + traded, excluding stables) so positions + holdings share prices.
  const allMintsToPrice = new Set<string>(Array.from(perToken.keys()).filter((c) => !STABLES.has(c)));
  const priceMap = allMintsToPrice.size > 0 ? await getBscTokenPricesUsd(Array.from(allMintsToPrice)) : new Map();

  const holdingsValueUsd = Array.from(perToken.entries()).reduce((acc, [contract, v]) => {
    if (v.netUiAmount <= 0) return acc;
    const p = priceMap.get(contract);
    return acc + (p?.priceUsd ? p.priceUsd * v.netUiAmount : 0);
  }, 0);

  const positions: AnalyzerPosition[] = Array.from(perToken.entries())
    .filter(([contract]) => !STABLES.has(contract))
    .map(([contract, v]) => {
      const realizedNative = v.receivedNative - v.spentNative;
      const realizedUsd = realizedNative * bnbUsd;
      const costBasisUsd = v.spentNative * bnbUsd;
      const realizedPct = costBasisUsd > 0 ? (realizedUsd / costBasisUsd) * 100 : null;
      const p = priceMap.get(contract);
      const heldUi = Math.max(v.netUiAmount, 0);
      const holdingUsd = p?.priceUsd ? heldUi * p.priceUsd : null;
      const pctSold = v.tokensReceived > 0 ? Math.min((v.tokensSold / v.tokensReceived) * 100, 100) : null;
      const pctHeld = v.tokensReceived > 0 ? Math.max(0, (heldUi / v.tokensReceived) * 100) : null;
      return {
        mint: contract,
        symbol: v.symbol ?? p?.symbol ?? null,
        trades: v.trades,
        buys: v.buys,
        sells: v.sells,
        spentNative: v.spentNative,
        receivedNative: v.receivedNative,
        realizedNative,
        realizedUsd,
        realizedPct,
        currentHoldingUiAmount: heldUi,
        currentHoldingUsd: holdingUsd,
        firstBuyAtMs: v.firstBuyAtMs,
        tokensReceived: v.tokensReceived,
        tokensSold: v.tokensSold,
        pctSold,
        pctHeld,
        recommendedCopy: false,
      };
    });
  positions.sort((a, b) => b.realizedUsd - a.realizedUsd);

  let biggestWin: AnalyzerPosition | null = positions[0] ?? null;
  let biggestLoss: AnalyzerPosition | null = positions[positions.length - 1] ?? null;
  if (biggestWin && biggestWin.realizedUsd <= 0) biggestWin = null;
  if (biggestLoss && biggestLoss.realizedUsd >= 0) biggestLoss = null;
  const sellsCount = positions.filter((p) => p.sells > 0).length;
  const sellWins = positions.filter((p) => p.sells > 0 && p.realizedUsd > 0).length;
  const winRatePct = sellsCount > 0 ? (sellWins / sellsCount) * 100 : null;
  const realizedPnlUsd = positions.reduce((acc, p) => acc + p.realizedUsd, 0);
  const totalCostBasisUsd = totalCostBasisNative * bnbUsd;
  const realizedPnlPct = totalCostBasisUsd > 0 ? (realizedPnlUsd / totalCostBasisUsd) * 100 : null;

  const totals = {
    realizedPnlUsd,
    realizedPnlPct,
    volumeUsd: volumeNative * bnbUsd,
    tradeCount: trades.length,
    winRatePct,
    biggestWinSymbol: biggestWin?.symbol ?? null,
    biggestWinPnlUsd: biggestWin?.realizedUsd ?? null,
    biggestLossSymbol: biggestLoss?.symbol ?? null,
    biggestLossPnlUsd: biggestLoss?.realizedUsd ?? null,
    holdingsValueUsd,
    uniqueMints: positions.length,
  };

  // Build holdings after positions so we can attach per-mint metadata.
  const positionByMint = new Map(positions.map((p) => [p.mint, p]));
  const holdings: AnalyzerHolding[] = Array.from(perToken.entries())
    .filter(([, v]) => v.netUiAmount > 0)
    .map(([contract, v]) => {
      const p = priceMap.get(contract);
      const pos = positionByMint.get(contract);
      return {
        mint: contract,
        symbol: pos?.symbol ?? v.symbol ?? p?.symbol ?? null,
        name: null,
        uiAmount: v.netUiAmount,
        priceUsd: p?.priceUsd ?? null,
        valueUsd: p?.priceUsd ? p.priceUsd * v.netUiAmount : null,
        firstBuyAtMs: pos?.firstBuyAtMs ?? null,
        pctSold: pos?.pctSold ?? null,
        pctHeld: pos?.pctHeld ?? null,
        recommendedCopy: false,
        realizedUsd: pos?.realizedUsd ?? 0,
      };
    });
  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const verdict = buildVerdict({ positions, trades, holdings, totals });

  const walletGood = verdict.label === "Strong copy" || verdict.label === "Moderate copy";
  for (const pos of positions) {
    pos.recommendedCopy = walletGood && pos.currentHoldingUiAmount > 0 && ((pos.pctHeld ?? 0) > 30 || pos.realizedUsd >= 0);
  }
  for (const h of holdings) {
    const pos = positionByMint.get(h.mint);
    h.recommendedCopy = walletGood && h.uiAmount > 0 && ((h.pctHeld ?? 100) > 30 || (pos?.realizedUsd ?? 0) >= 0);
  }

  notes.push(
    "Realized PnL pairs ERC-20 transfers with BNB deltas (normal + internal txs) per hash — same approximation we use on Solana.",
  );
  notes.push("Token prices via Dexscreener (chainId=bsc, free).");

  return {
    chain: "bsc",
    walletAddress,
    period,
    generatedAtMs,
    nativeSymbol: "BNB",
    nativePriceUsd: bnbUsd,
    totals,
    positions: positions.slice(0, 40),
    trades,
    holdings: holdings.slice(0, 40),
    verdict,
    notes,
  };
}

// Re-export helpers used elsewhere if needed
export { getBnbUsdPrice };
