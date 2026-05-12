/**
 * Free-API meme PnL computation for a Solana wallet.
 *
 * Sources (no paid plans):
 *   1. Helius Enhanced Transactions API (free tier) — wallet SWAP/BUY/SELL history.
 *   2. Dexscreener (no key) — current per-token USD price + SOL/USD.
 *
 * Methodology (approximation, documented to the user in the UI):
 *   - For each SWAP/BUY/SELL tx in the window, find the wallet's native SOL delta
 *     (`accountData[].nativeBalanceChange` for the wallet account) and pair it with the
 *     "primary mint" — the wallet token whose absolute balance changed the most in
 *     that tx (ignoring wrapped SOL and USDC stable side).
 *   - SOL out + token in  ⇒ BUY: solSpent[mint] += |solDelta|, tokensIn[mint] += amount
 *   - SOL in  + token out ⇒ SELL: solReceived[mint] += solDelta, tokensOut[mint] += amount
 *   - Realized PnL (USD) = (totalSolReceived − totalSolSpent) × SOL/USD, summed over mints.
 *   - Win rate = (#mints with realized SOL > 0) / (#mints with at least one SELL).
 *   - Biggest win = mint with largest positive realized SOL × SOL/USD.
 *   - Volume USD ≈ Σ |solDelta| × SOL/USD.
 *
 * This is intentionally a "net SOL flow" PnL approximation — what a copy-trader feels —
 * not full FIFO cost-basis accounting. It is cheap to compute and uses only free APIs.
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE = "https://api-mainnet.helius-rpc.com";
const HELIUS_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : null;

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const STABLE_MINTS = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
]);
const IGNORE_AS_PRIMARY = new Set([WRAPPED_SOL_MINT, ...STABLE_MINTS]);

const LAMPORTS_PER_SOL = 1_000_000_000;

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

export type MemeWalletPnl = {
  realizedPnlUsd: number;
  volumeUsd: number;
  tradeCount: number;
  winRatePct: number | null;
  biggestWinMint: string | null;
  biggestWinSymbol: string | null;
  biggestWinPnlUsd: number | null;
  /** Mints the wallet touched in this window (caller can fetch holdings for these). */
  mintsTouched: string[];
  /** Per-mint realized SOL for downstream display / debugging. */
  perMintRealizedSol: Map<string, { realizedSol: number; symbol?: string; trades: number }>;
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
    const res = await fetch(`${url}?${params.toString()}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
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
  const HARD_PAGE_LIMIT = 4; // up to 4 × 100 = 400 txs per type → safe for Helius free tier
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

function decodeRawAmount(raw: TokenBalanceChange | undefined): number {
  if (!raw?.rawTokenAmount?.tokenAmount) return 0;
  const decimals = raw.rawTokenAmount.decimals ?? 0;
  const amt = Number(raw.rawTokenAmount.tokenAmount);
  if (!Number.isFinite(amt)) return 0;
  return amt / 10 ** decimals;
}

/** Find the wallet's primary non-SOL/USDC mint and amount delta (positive = received) for a tx. */
function findPrimaryMint(tx: HeliusTx, walletAddress: string): { mint: string; amount: number; symbol?: string } | null {
  const ad = tx.accountData?.find((a) => a.account === walletAddress);
  if (!ad) return null;
  let best: { mint: string; amount: number; symbol?: string } | null = null;
  for (const tc of ad.tokenBalanceChanges ?? []) {
    if (!tc.mint || tc.userAccount !== walletAddress) continue;
    if (IGNORE_AS_PRIMARY.has(tc.mint)) continue;
    const amount = decodeRawAmount(tc);
    if (!Number.isFinite(amount) || amount === 0) continue;
    if (!best || Math.abs(amount) > Math.abs(best.amount)) {
      best = { mint: tc.mint, amount };
    }
  }
  if (best) {
    // Try to grab a friendly symbol from tokenTransfers in same tx
    const friendly = (tx.tokenTransfers ?? []).find((t) => t.mint === best!.mint && t.tokenSymbol);
    if (friendly?.tokenSymbol) best.symbol = friendly.tokenSymbol;
    return best;
  }
  // Fallback: use tokenTransfers
  let bestT: { mint: string; amount: number; symbol?: string } | null = null;
  for (const t of tx.tokenTransfers ?? []) {
    if (!t.mint || IGNORE_AS_PRIMARY.has(t.mint)) continue;
    const amt = t.toUserAccount === walletAddress ? Number(t.tokenAmount ?? 0) :
                t.fromUserAccount === walletAddress ? -Number(t.tokenAmount ?? 0) : 0;
    if (!Number.isFinite(amt) || amt === 0) continue;
    if (!bestT || Math.abs(amt) > Math.abs(bestT.amount)) {
      bestT = { mint: t.mint, amount: amt, symbol: t.tokenSymbol };
    }
  }
  return bestT;
}

export type PnlOptions = {
  periodMs: number;
  solUsd: number;
};

/** Compute meme PnL approximation for a wallet over a sliding window. Free APIs only. */
export async function computeWalletMemePnl(walletAddress: string, opts: PnlOptions): Promise<MemeWalletPnl> {
  const empty: MemeWalletPnl = {
    realizedPnlUsd: 0,
    volumeUsd: 0,
    tradeCount: 0,
    winRatePct: null,
    biggestWinMint: null,
    biggestWinSymbol: null,
    biggestWinPnlUsd: null,
    mintsTouched: [],
    perMintRealizedSol: new Map(),
  };
  if (!HELIUS_API_KEY) return empty;

  const cutoffSec = Math.floor((Date.now() - opts.periodMs) / 1000);
  const [swapTxs, buyTxs] = await Promise.all([
    fetchWindowTxs(walletAddress, "SWAP", cutoffSec),
    fetchWindowTxs(walletAddress, "BUY", cutoffSec),
  ]);
  const seenSig = new Set<string>();
  const txs: HeliusTx[] = [];
  for (const t of [...swapTxs, ...buyTxs]) {
    const sig = t.signature ?? "";
    if (sig && seenSig.has(sig)) continue;
    if (sig) seenSig.add(sig);
    if ((t.timestamp ?? 0) >= cutoffSec) txs.push(t);
  }
  if (txs.length === 0) return empty;

  let tradeCount = 0;
  let volumeSol = 0;
  const perMint = new Map<
    string,
    { solSpent: number; solReceived: number; tokensIn: number; tokensOut: number; trades: number; symbol?: string }
  >();

  for (const tx of txs) {
    const ad = tx.accountData?.find((a) => a.account === walletAddress);
    if (!ad) continue;
    const lamports = ad.nativeBalanceChange ?? 0;
    const solDelta = lamports / LAMPORTS_PER_SOL;
    const primary = findPrimaryMint(tx, walletAddress);
    if (!primary) continue;

    tradeCount += 1;
    volumeSol += Math.abs(solDelta);

    const entry = perMint.get(primary.mint) ?? {
      solSpent: 0,
      solReceived: 0,
      tokensIn: 0,
      tokensOut: 0,
      trades: 0,
      symbol: primary.symbol,
    };
    entry.trades += 1;
    if (primary.symbol && !entry.symbol) entry.symbol = primary.symbol;

    if (solDelta < 0 && primary.amount > 0) {
      // BUY: wallet paid SOL, received token.
      entry.solSpent += Math.abs(solDelta);
      entry.tokensIn += primary.amount;
    } else if (solDelta > 0 && primary.amount < 0) {
      // SELL: wallet received SOL, sent token.
      entry.solReceived += solDelta;
      entry.tokensOut += Math.abs(primary.amount);
    } else {
      // Token-for-token swap, or atypical SOL/token direction. Track but skip from PnL.
      // (We still count the trade and volume; just no SOL-flow contribution.)
    }

    perMint.set(primary.mint, entry);
  }

  let realizedSol = 0;
  let biggestWinSol = 0;
  let biggestWinMint: string | null = null;
  let biggestWinSymbol: string | null = null;
  let sellsCount = 0;
  let sellWins = 0;
  const perMintRealizedSol = new Map<string, { realizedSol: number; symbol?: string; trades: number }>();
  for (const [mint, e] of perMint.entries()) {
    const r = e.solReceived - e.solSpent;
    realizedSol += r;
    perMintRealizedSol.set(mint, { realizedSol: r, symbol: e.symbol, trades: e.trades });
    if (e.solReceived > 0) {
      sellsCount += 1;
      if (r > 0) sellWins += 1;
      if (r > biggestWinSol) {
        biggestWinSol = r;
        biggestWinMint = mint;
        biggestWinSymbol = e.symbol ?? null;
      }
    }
  }

  const winRatePct = sellsCount > 0 ? (sellWins / sellsCount) * 100 : null;

  return {
    realizedPnlUsd: realizedSol * opts.solUsd,
    volumeUsd: volumeSol * opts.solUsd,
    tradeCount,
    winRatePct,
    biggestWinMint,
    biggestWinSymbol,
    biggestWinPnlUsd: biggestWinMint ? biggestWinSol * opts.solUsd : null,
    mintsTouched: Array.from(perMint.keys()),
    perMintRealizedSol,
  };
}

/** Fetch a wallet's current SPL token holdings via Helius RPC (free). Skips wrapped SOL/USDC. */
export async function getWalletHoldings(walletAddress: string): Promise<Array<{ mint: string; uiAmount: number }>> {
  if (!HELIUS_RPC) return [];
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "meme-leaderboard-holdings",
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
          { encoding: "jsonParsed" },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result?: {
        value?: Array<{
          account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number } } } } };
        }>;
      };
    };
    const items = data?.result?.value ?? [];
    const out: Array<{ mint: string; uiAmount: number }> = [];
    for (const it of items) {
      const info = it?.account?.data?.parsed?.info;
      const mint = info?.mint;
      const ui = info?.tokenAmount?.uiAmount;
      if (!mint || IGNORE_AS_PRIMARY.has(mint)) continue;
      if (!Number.isFinite(ui) || !ui || ui <= 0) continue;
      out.push({ mint, uiAmount: Number(ui) });
    }
    return out;
  } catch {
    return [];
  }
}
