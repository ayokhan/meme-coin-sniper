import { resolveMemeAgentContract } from "@/lib/meme-contract-detect";
import {
  geckoNetworkForChain,
  getGeckoPoolTrades,
  searchGeckoPoolsByToken,
  type GtTrade,
} from "@/lib/api-clients/geckoterminal";
import { searchDexScreenerTokenPairs, type DexPair } from "@/lib/api-clients/dexscreener";

export type FindWalletSide = "buy" | "sell" | "any";

export type FindWalletMatch = {
  wallet: string;
  side: string;
  amountUsd: number;
  diffPct: number;
  txHash: string;
  timestamp: string | null;
  poolAddress: string;
  poolName: string | null;
  networkId: string;
  explorerTxUrl: string | null;
  explorerWalletUrl: string | null;
  gmgnTokenUrl: string | null;
};

export type FindWalletResult = {
  ok: true;
  chain: string;
  contractAddress: string;
  symbol: string | null;
  queriedAmountUsd: number;
  side: FindWalletSide;
  tolerancePct: number;
  poolsSearched: number;
  tradesScanned: number;
  matches: FindWalletMatch[];
};

export type FindWalletError = { ok: false; error: string };

/** Parse amounts like 49300, $49.3K, 49.3k, 1.2M. */
export function parseUsdAmountInput(raw: string): number | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/^\$/, "")
    .toUpperCase();
  if (!s) return null;
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([KMB])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suf = m[2];
  const mult = suf === "K" ? 1e3 : suf === "M" ? 1e6 : suf === "B" ? 1e9 : 1;
  return n * mult;
}

function explorerBase(networkId: string): { tx: string; wallet: string } | null {
  const n = networkId.toLowerCase();
  if (n === "eth" || n === "ethereum") {
    return { tx: "https://etherscan.io/tx/", wallet: "https://etherscan.io/address/" };
  }
  if (n === "bsc" || n === "bnb") {
    return { tx: "https://bscscan.com/tx/", wallet: "https://bscscan.com/address/" };
  }
  if (n === "solana") {
    return { tx: "https://solscan.io/tx/", wallet: "https://solscan.io/account/" };
  }
  if (n === "base") {
    return { tx: "https://basescan.org/tx/", wallet: "https://basescan.org/address/" };
  }
  // Robinhood / HyperEVM — fall back to GMGN-style links where possible
  return null;
}

function gmgnChainSlug(networkId: string): string | null {
  const n = networkId.toLowerCase();
  if (n === "solana") return "sol";
  if (n === "bsc") return "bsc";
  if (n === "eth" || n === "ethereum") return "eth";
  if (n === "robinhood") return "robinhood";
  if (n === "base") return "base";
  return null;
}

function shortDiffPct(amountUsd: number, target: number): number {
  if (target <= 0) return 100;
  return (Math.abs(amountUsd - target) / target) * 100;
}

/**
 * Find wallets that bought/sold `amountUsd` (± tolerance) on pools for this CA.
 * Uses GeckoTerminal recent trades (typically last ~24h, up to ~300 per pool).
 */
export async function findWalletsByTradeAmount(opts: {
  ca: string;
  amountUsd: number;
  side?: FindWalletSide;
  tolerancePct?: number;
  maxPools?: number;
}): Promise<FindWalletResult | FindWalletError> {
  const amountUsd = opts.amountUsd;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { ok: false, error: "Enter a valid USD amount (e.g. 49300 or 49.3K)." };
  }
  const side: FindWalletSide = opts.side ?? "any";
  const tolerancePct = Math.min(50, Math.max(1, opts.tolerancePct ?? 10));
  const maxPools = Math.min(5, Math.max(1, opts.maxPools ?? 3));

  const resolved = await resolveMemeAgentContract(opts.ca, "auto");
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const chain = resolved.chain;
  const contractAddress = resolved.contractAddress;
  const geckoNet = geckoNetworkForChain(chain);

  // Prefer DexScreener symbol if available
  let symbol: string | null = resolved.pairSymbol ?? null;
  try {
    const pairs = await searchDexScreenerTokenPairs(contractAddress);
    const onChain = pairs.filter((p) => (p.chainId || "").toLowerCase() === chain || (chain === "ethereum" && (p.chainId || "").toLowerCase() === "eth"));
    const best: DexPair | undefined = (onChain.length ? onChain : pairs).sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0];
    if (best?.baseToken?.symbol) symbol = best.baseToken.symbol;
  } catch {
    /* optional */
  }

  let pools = await searchGeckoPoolsByToken(contractAddress);
  if (geckoNet) {
    const filtered = pools.filter((p) => p.networkId.toLowerCase() === geckoNet);
    if (filtered.length) pools = filtered;
  }
  pools = pools.slice(0, maxPools);
  if (pools.length === 0) {
    return {
      ok: false,
      error: "No DEX pools found for this CA on GeckoTerminal. Try again later or verify the contract.",
    };
  }

  // Floor filter helps API return large trades; still apply tolerance client-side.
  const minVolumeUsd = Math.max(1, amountUsd * (1 - tolerancePct / 100) * 0.85);

  const allTrades: Array<GtTrade & { poolAddress: string; poolName: string | null; networkId: string }> = [];
  await Promise.all(
    pools.map(async (pool) => {
      const trades = await getGeckoPoolTrades({
        networkId: pool.networkId,
        poolAddress: pool.poolAddress,
        minVolumeUsd,
      });
      for (const t of trades) {
        allTrades.push({
          ...t,
          poolAddress: pool.poolAddress,
          poolName: pool.name,
          networkId: pool.networkId,
        });
      }
    })
  );

  const matches: FindWalletMatch[] = [];
  for (const t of allTrades) {
    if (side !== "any" && t.kind !== side) continue;
    const diffPct = shortDiffPct(t.volumeUsd, amountUsd);
    if (diffPct > tolerancePct) continue;
    const explorers = explorerBase(t.networkId);
    const gmgn = gmgnChainSlug(t.networkId);
    matches.push({
      wallet: t.wallet,
      side: t.kind,
      amountUsd: t.volumeUsd,
      diffPct,
      txHash: t.txHash,
      timestamp: t.timestamp,
      poolAddress: t.poolAddress,
      poolName: t.poolName,
      networkId: t.networkId,
      explorerTxUrl: explorers ? `${explorers.tx}${t.txHash}` : null,
      explorerWalletUrl: explorers ? `${explorers.wallet}${t.wallet}` : null,
      gmgnTokenUrl: gmgn ? `https://gmgn.ai/${gmgn}/token/${contractAddress}` : null,
    });
  }

  matches.sort((a, b) => a.diffPct - b.diffPct || (b.timestamp || "").localeCompare(a.timestamp || ""));

  // Dedupe same wallet+tx
  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const k = `${m.wallet}:${m.txHash}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    ok: true,
    chain,
    contractAddress,
    symbol,
    queriedAmountUsd: amountUsd,
    side,
    tolerancePct,
    poolsSearched: pools.length,
    tradesScanned: allTrades.length,
    matches: unique.slice(0, 25),
  };
}
