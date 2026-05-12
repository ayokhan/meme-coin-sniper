/**
 * Solana wallet analyzer (free APIs only).
 *
 * Sources:
 *   - Helius Enhanced Transactions (free tier) for SWAP/BUY/SELL history.
 *   - Helius RPC getTokenAccountsByOwner (free) for current SPL holdings.
 *   - Dexscreener (no key) for SOL/USD and token USD prices.
 */

import { getWalletHoldings } from "@/lib/api-clients/helius-wallet-pnl";
import { getSolanaTokenPricesUsd, getSolUsdPrice } from "@/lib/api-clients/dexscreener-prices";
import type {
  AnalyzerHolding,
  AnalyzerPeriod,
  AnalyzerPosition,
  AnalyzerTrade,
  WalletAnalysis,
} from "./types";
import { buildVerdict } from "./verdict";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE = "https://api-mainnet.helius-rpc.com";
const WRAPPED_SOL = "So11111111111111111111111111111111111111112";
const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);
const IGNORE_AS_PRIMARY = new Set([WRAPPED_SOL, ...STABLE_MINTS]);

const PERIOD_MS: Record<AnalyzerPeriod, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_TRADES = 200;

type TokenBalanceChange = {
  userAccount?: string;
  mint?: string;
  rawTokenAmount?: { tokenAmount?: string; decimals?: number };
};

type HeliusTx = {
  type?: string;
  signature?: string;
  timestamp?: number;
  accountData?: Array<{
    account?: string;
    nativeBalanceChange?: number;
    tokenBalanceChanges?: TokenBalanceChange[];
  }>;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint?: string;
    tokenSymbol?: string;
    tokenAmount?: number;
  }>;
};

async function fetchTransactionsBefore(
  walletAddress: string,
  type: string | null,
  before: string | null,
  limit: number,
): Promise<HeliusTx[]> {
  if (!HELIUS_API_KEY) return [];
  const url = `${HELIUS_BASE}/v0/addresses/${walletAddress}/transactions`;
  const params = new URLSearchParams({
    "api-key": HELIUS_API_KEY,
    limit: String(Math.min(limit, 100)),
  });
  if (type) params.set("type", type);
  if (before) params.set("before", before);
  try {
    const res = await fetch(`${url}?${params.toString()}`, { cache: "no-store", next: { revalidate: 0 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as HeliusTx[]) : ((data as { transactions?: HeliusTx[] }).transactions ?? []);
  } catch {
    return [];
  }
}

async function fetchWindowTxs(walletAddress: string, type: "SWAP" | "BUY", cutoffSec: number): Promise<HeliusTx[]> {
  const all: HeliusTx[] = [];
  let before: string | null = null;
  const HARD_PAGE_LIMIT = 4;
  for (let i = 0; i < HARD_PAGE_LIMIT; i++) {
    const batch = await fetchTransactionsBefore(walletAddress, type, before, 100);
    if (batch.length === 0) break;
    all.push(...batch);
    const last = batch[batch.length - 1];
    const lastTs = last.timestamp ?? 0;
    if (lastTs && lastTs < cutoffSec) break;
    if (!last.signature) break;
    before = last.signature;
  }
  return all;
}

function decodeRaw(tc: TokenBalanceChange | undefined): number {
  if (!tc?.rawTokenAmount?.tokenAmount) return 0;
  const decimals = tc.rawTokenAmount.decimals ?? 0;
  const amt = Number(tc.rawTokenAmount.tokenAmount);
  if (!Number.isFinite(amt)) return 0;
  return amt / 10 ** decimals;
}

function findPrimaryMint(tx: HeliusTx, walletAddress: string): { mint: string; tokenDelta: number; symbol?: string } | null {
  const ad = tx.accountData?.find((a) => a.account === walletAddress);
  if (ad) {
    let best: { mint: string; tokenDelta: number; symbol?: string } | null = null;
    for (const tc of ad.tokenBalanceChanges ?? []) {
      if (!tc.mint || tc.userAccount !== walletAddress) continue;
      if (IGNORE_AS_PRIMARY.has(tc.mint)) continue;
      const amount = decodeRaw(tc);
      if (!Number.isFinite(amount) || amount === 0) continue;
      if (!best || Math.abs(amount) > Math.abs(best.tokenDelta)) best = { mint: tc.mint, tokenDelta: amount };
    }
    if (best) {
      const friendly = (tx.tokenTransfers ?? []).find((t) => t.mint === best!.mint && t.tokenSymbol);
      if (friendly?.tokenSymbol) best.symbol = friendly.tokenSymbol;
      return best;
    }
  }
  // Fallback: tokenTransfers
  let bestT: { mint: string; tokenDelta: number; symbol?: string } | null = null;
  for (const t of tx.tokenTransfers ?? []) {
    if (!t.mint || IGNORE_AS_PRIMARY.has(t.mint)) continue;
    const amt = t.toUserAccount === walletAddress
      ? Number(t.tokenAmount ?? 0)
      : t.fromUserAccount === walletAddress
        ? -Number(t.tokenAmount ?? 0)
        : 0;
    if (!Number.isFinite(amt) || amt === 0) continue;
    if (!bestT || Math.abs(amt) > Math.abs(bestT.tokenDelta)) {
      bestT = { mint: t.mint, tokenDelta: amt, symbol: t.tokenSymbol };
    }
  }
  return bestT;
}

export async function analyzeSolanaWallet(walletAddress: string, period: AnalyzerPeriod): Promise<WalletAnalysis> {
  const periodMs = PERIOD_MS[period];
  const generatedAtMs = Date.now();
  const cutoffSec = Math.floor((generatedAtMs - periodMs) / 1000);
  const notes: string[] = [];

  const solUsd = await getSolUsdPrice();

  if (!HELIUS_API_KEY) {
    notes.push("Helius API key not configured on the server — analyzer cannot fetch Solana trade history.");
  }

  // Trades
  const [swapTxs, buyTxs] = await Promise.all([
    fetchWindowTxs(walletAddress, "SWAP", cutoffSec),
    fetchWindowTxs(walletAddress, "BUY", cutoffSec),
  ]);
  const seen = new Set<string>();
  const merged: HeliusTx[] = [];
  for (const t of [...swapTxs, ...buyTxs]) {
    const sig = t.signature ?? "";
    if (sig && seen.has(sig)) continue;
    if (sig) seen.add(sig);
    if ((t.timestamp ?? 0) >= cutoffSec) merged.push(t);
  }
  merged.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  const trades: AnalyzerTrade[] = [];
  const perMint = new Map<string, {
    symbol?: string;
    trades: number;
    buys: number;
    sells: number;
    spentNative: number;
    receivedNative: number;
  }>();
  let volumeNative = 0;
  let totalCostBasisNative = 0;

  for (const tx of merged) {
    const ad = tx.accountData?.find((a) => a.account === walletAddress);
    if (!ad) continue;
    const lamports = ad.nativeBalanceChange ?? 0;
    const nativeDelta = lamports / LAMPORTS_PER_SOL;
    const primary = findPrimaryMint(tx, walletAddress);
    if (!primary) continue;

    let action: AnalyzerTrade["action"] = "swap";
    if (nativeDelta < 0 && primary.tokenDelta > 0) action = "buy";
    else if (nativeDelta > 0 && primary.tokenDelta < 0) action = "sell";

    volumeNative += Math.abs(nativeDelta);

    const cur = perMint.get(primary.mint) ?? {
      symbol: primary.symbol,
      trades: 0,
      buys: 0,
      sells: 0,
      spentNative: 0,
      receivedNative: 0,
    };
    cur.trades += 1;
    if (primary.symbol && !cur.symbol) cur.symbol = primary.symbol;
    if (action === "buy") {
      cur.buys += 1;
      cur.spentNative += Math.abs(nativeDelta);
      totalCostBasisNative += Math.abs(nativeDelta);
    } else if (action === "sell") {
      cur.sells += 1;
      cur.receivedNative += nativeDelta;
    }
    perMint.set(primary.mint, cur);

    if (trades.length < MAX_TRADES) {
      trades.push({
        signature: tx.signature ?? null,
        timestampMs: (tx.timestamp ?? 0) * 1000,
        action,
        mint: primary.mint,
        symbol: primary.symbol ?? null,
        nativeDelta,
        tokenDelta: primary.tokenDelta,
        notionalUsd: Math.abs(nativeDelta) * solUsd,
      });
    }
  }

  // Holdings
  const rawHoldings = await getWalletHoldings(walletAddress);
  const allMintsToPrice = new Set<string>([...rawHoldings.map((h) => h.mint), ...perMint.keys()]);
  const prices = allMintsToPrice.size > 0 ? await getSolanaTokenPricesUsd(Array.from(allMintsToPrice)) : new Map();
  const holdings: AnalyzerHolding[] = rawHoldings.map((h) => {
    const p = prices.get(h.mint);
    return {
      mint: h.mint,
      symbol: p?.symbol ?? null,
      name: null,
      uiAmount: h.uiAmount,
      priceUsd: p?.priceUsd ?? null,
      valueUsd: p?.priceUsd ? p.priceUsd * h.uiAmount : null,
    };
  });
  holdings.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  const holdingsValueUsd = holdings.reduce((acc, h) => acc + (h.valueUsd ?? 0), 0);

  // Positions
  const holdingByMint = new Map(rawHoldings.map((h) => [h.mint, h.uiAmount]));
  const positions: AnalyzerPosition[] = Array.from(perMint.entries()).map(([mint, v]) => {
    const realizedNative = v.receivedNative - v.spentNative;
    const realizedUsd = realizedNative * solUsd;
    const costBasisUsd = v.spentNative * solUsd;
    const realizedPct = costBasisUsd > 0 ? (realizedUsd / costBasisUsd) * 100 : null;
    const ui = holdingByMint.get(mint) ?? 0;
    const p = prices.get(mint);
    const holdingUsd = p?.priceUsd ? ui * p.priceUsd : null;
    return {
      mint,
      symbol: v.symbol ?? p?.symbol ?? null,
      trades: v.trades,
      buys: v.buys,
      sells: v.sells,
      spentNative: v.spentNative,
      receivedNative: v.receivedNative,
      realizedNative,
      realizedUsd,
      realizedPct,
      currentHoldingUiAmount: ui,
      currentHoldingUsd: holdingUsd,
    };
  });
  positions.sort((a, b) => b.realizedUsd - a.realizedUsd);

  // Aggregates
  let biggestWin: AnalyzerPosition | null = positions[0] ?? null;
  let biggestLoss: AnalyzerPosition | null = positions[positions.length - 1] ?? null;
  if (biggestWin && biggestWin.realizedUsd <= 0) biggestWin = null;
  if (biggestLoss && biggestLoss.realizedUsd >= 0) biggestLoss = null;
  const sellsCount = positions.filter((p) => p.sells > 0).length;
  const sellWins = positions.filter((p) => p.sells > 0 && p.realizedUsd > 0).length;
  const winRatePct = sellsCount > 0 ? (sellWins / sellsCount) * 100 : null;
  const realizedPnlUsd = positions.reduce((acc, p) => acc + p.realizedUsd, 0);
  const totalCostBasisUsd = totalCostBasisNative * solUsd;
  const realizedPnlPct = totalCostBasisUsd > 0 ? (realizedPnlUsd / totalCostBasisUsd) * 100 : null;

  const totals = {
    realizedPnlUsd,
    realizedPnlPct,
    volumeUsd: volumeNative * solUsd,
    tradeCount: trades.length,
    winRatePct,
    biggestWinSymbol: biggestWin?.symbol ?? null,
    biggestWinPnlUsd: biggestWin?.realizedUsd ?? null,
    biggestLossSymbol: biggestLoss?.symbol ?? null,
    biggestLossPnlUsd: biggestLoss?.realizedUsd ?? null,
    holdingsValueUsd,
    uniqueMints: perMint.size,
  };

  const verdict = buildVerdict({ positions, trades, holdings, totals });

  if (!notes.length && trades.length === 0) {
    notes.push(`No Solana trades found in the last ${period}. The wallet may be inactive or trading on chains we don't cover yet.`);
  }
  notes.push(
    "Realized PnL uses a net SOL-flow approximation per token (Helius free tier). Holdings are priced via Dexscreener (free, no key).",
  );

  return {
    chain: "solana",
    walletAddress,
    period,
    generatedAtMs,
    nativeSymbol: "SOL",
    nativePriceUsd: solUsd,
    totals,
    positions: positions.slice(0, 40),
    trades,
    holdings: holdings.slice(0, 40),
    verdict,
    notes,
  };
}
