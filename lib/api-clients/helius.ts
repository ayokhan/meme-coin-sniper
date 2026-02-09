/**
 * Helius Enhanced Transactions API – wallet transaction history and token buys.
 * Used by Wallet Tracker: detect when 3+ tracked wallets buy the same token.
 * Set HELIUS_API_KEY in env. Docs: https://docs.helius.dev/solana-apis/enhanced-transactions-api
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
// Official Helius endpoint per docs (api-mainnet, not api.mainnet)
const HELIUS_BASE = 'https://api-mainnet.helius-rpc.com';

export function isHeliusConfigured(): boolean {
  return Boolean(HELIUS_API_KEY);
}

/** Parsed "buy" from a wallet: token mint received and when */
export type WalletBuy = {
  mint: string;
  timestamp: number;
  signature?: string;
};

/**
 * Helius enhanced transaction item (subset we need).
 * See: GET /v0/addresses/{address}/transactions
 */
type HeliusTx = {
  type?: string;
  signature?: string;
  timestamp?: number;
  tokenTransfers?: Array<{
    fromUserAccount?: string;
    toUserAccount?: string;
    mint?: string;
    tokenSymbol?: string;
    tokenAmount?: number;
  }>;
  source?: string;
  accountData?: Array<{
    account?: string;
    nativeBalanceChange?: number;
    tokenBalanceChanges?: Array<{
      userAccount?: string;
      mint?: string;
      rawTokenAmount?: { tokenAmount?: string; decimals?: number };
    }>;
  }>;
};

/**
 * Fetch transactions for a wallet. Uses token-accounts=all to include
 * transactions where the wallet's token accounts received tokens (buys).
 * Helius: SWAP = Jupiter/Raydium; BUY = Pump.fun (PUMP_AMM).
 */
async function fetchTransactions(
  walletAddress: string,
  type: string | null,
  limit: number
): Promise<HeliusTx[]> {
  const url = `${HELIUS_BASE}/v0/addresses/${walletAddress}/transactions`;
  const params = new URLSearchParams({
    'api-key': HELIUS_API_KEY!,
    limit: String(Math.min(limit, 100)),
    'token-accounts': 'all',
  });
  if (type) params.set('type', type);
  const res = await fetch(`${url}?${params}`, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.transactions ?? [];
}

/**
 * Extract token mints this wallet RECEIVED (bought) from a tx.
 * Uses accountData.tokenBalanceChanges (positive = received) when available,
 * otherwise tokenTransfers where wallet is toUserAccount.
 */
function getReceivedMints(tx: HeliusTx, walletAddress: string): string[] {
  const mints: string[] = [];

  // 1. Prefer accountData: positive tokenBalanceChange = wallet received tokens
  const accountData = tx.accountData ?? [];
  for (const ad of accountData) {
    if (ad.account !== walletAddress) continue;
    for (const tc of ad.tokenBalanceChanges ?? []) {
      const amount = tc.rawTokenAmount?.tokenAmount;
      if (amount && tc.mint) {
        const n = parseInt(amount, 10);
        if (n > 0) mints.push(tc.mint);
      }
    }
    return mints;
  }

  // 2. Fallback: tokenTransfers where wallet is recipient (toUserAccount)
  for (const t of tx.tokenTransfers ?? []) {
    const mint = t.mint ?? '';
    const to = t.toUserAccount ?? '';
    if (mint && to === walletAddress) mints.push(mint);
  }

  // 3. Last resort: in SWAP/BUY txs, wallet was involved; take all mints (may include sold tokens)
  if (mints.length === 0) {
    for (const t of tx.tokenTransfers ?? []) {
      const mint = t.mint ?? '';
      if (mint) mints.push(mint);
    }
  }

  return mints;
}

/**
 * Fetch recent token buys for a wallet. Includes:
 * - SWAP (Jupiter, Raydium, Elixir)
 * - BUY (Pump.fun PUMP_AMM)
 * Returns list of token mints this wallet bought in the time window.
 */
export async function getRecentTokenBuysForWallet(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<WalletBuy[]> {
  if (!HELIUS_API_KEY) return [];

  try {
    const perType = 50;
    const [swapTxs, buyTxs] = await Promise.all([
      fetchTransactions(walletAddress, 'SWAP', perType),
      fetchTransactions(walletAddress, 'BUY', perType),
    ]);
    const txs = [...swapTxs, ...buyTxs];
    const cutoff = Date.now() - maxAgeMs;
    const seen = new Map<string, WalletBuy>();

    for (const tx of txs) {
      const ts = tx.timestamp ? tx.timestamp * 1000 : 0;
      if (ts < cutoff) continue;
      const receivedMints = getReceivedMints(tx, walletAddress);
      for (const mint of receivedMints) {
        if (mint && !seen.has(mint)) {
          seen.set(mint, { mint, timestamp: ts || Date.now(), signature: tx.signature });
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn('Helius getRecentTokenBuysForWallet error:', e);
    return [];
  }
}
