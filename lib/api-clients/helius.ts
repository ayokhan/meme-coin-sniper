/**
 * Helius Enhanced Transactions API – wallet transaction history and token buys.
 * Used by Wallet Tracker: detect when 3+ tracked wallets buy the same token.
 * Set HELIUS_API_KEY in env. Docs: https://docs.helius.dev/solana-apis/enhanced-transactions-api
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const HELIUS_BASE = 'https://api.mainnet.helius-rpc.com';

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
  nativeTransfers?: Array<{ fromUserAccount?: string; toUserAccount?: string; amount?: number }>;
};

/**
 * Fetch transactions for a wallet filtered by type.
 * Helius: SWAP = Jupiter/Raydium/Elixir; BUY = Pump.fun bonding curve buys.
 */
async function fetchTransactionsByType(
  walletAddress: string,
  type: string,
  limit: number
): Promise<HeliusTx[]> {
  const url = `${HELIUS_BASE}/v0/addresses/${walletAddress}/transactions`;
  const params = new URLSearchParams({
    'api-key': HELIUS_API_KEY!,
    limit: String(limit),
    type,
  });
  const res = await fetch(`${url}?${params}`, { cache: 'no-store', next: { revalidate: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.transactions ?? [];
}

/**
 * Fetch recent token buys for a wallet. Includes:
 * - SWAP (Jupiter, Raydium, Elixir, etc.)
 * - BUY (Pump.fun bonding curve buys — Helius uses BUY, not SWAP, for pump.fun)
 * Returns list of token mints this wallet bought in the last 24h.
 */
export async function getRecentTokenBuysForWallet(
  walletAddress: string,
  limit = 50,
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<WalletBuy[]> {
  if (!HELIUS_API_KEY) return [];

  try {
    const perType = Math.min(limit, 25);
    const [swapTxs, buyTxs] = await Promise.all([
      fetchTransactionsByType(walletAddress, 'SWAP', perType),
      fetchTransactionsByType(walletAddress, 'BUY', perType),
    ]);
    const txs = [...swapTxs, ...buyTxs];
    const cutoff = Date.now() - maxAgeMs;
    const seen = new Map<string, WalletBuy>();

    for (const tx of txs) {
      const ts = tx.timestamp ? tx.timestamp * 1000 : 0;
      if (ts < cutoff) continue;
      const transfers = tx.tokenTransfers ?? [];
      for (const t of transfers) {
        const mint = t.mint ?? '';
        if (mint && !seen.has(mint)) {
          seen.set(mint, {
            mint,
            timestamp: ts || Date.now(),
            signature: tx.signature,
          });
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn('Helius getRecentTokenBuysForWallet error:', e);
    return [];
  }
}
