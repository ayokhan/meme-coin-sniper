import { resolveMemeAgentContract } from "@/lib/meme-contract-detect";
import {
  geckoNetworkForChain,
  getGeckoPoolTrades,
  resolveGeckoPoolsForToken,
  type GtTrade,
} from "@/lib/api-clients/geckoterminal";
import { searchDexScreenerTokenPairs, type DexPair } from "@/lib/api-clients/dexscreener";

export type FindWalletSide = "buy" | "sell" | "any";

/** Lookback window in hours. GeckoTerminal usually only returns recent (~24h) trades per pool. */
export type FindWalletLookbackHours = 1 | 6 | 24 | 72 | 168;

export type FindWalletMatch = {
  wallet: string;
  side: string;
  amountUsd: number;
  diffPct: number | null;
  txHash: string;
  timestamp: string | null;
  poolAddress: string;
  poolName: string | null;
  networkId: string;
  explorerTxUrl: string | null;
  explorerWalletUrl: string | null;
  gmgnTokenUrl: string | null;
  nearMiss?: boolean;
  nearMissReason?: string;
};

export type FindWalletResult = {
  ok: true;
  chain: string;
  contractAddress: string;
  symbol: string | null;
  /** Center amount when using legacy ±tolerance; otherwise null. */
  queriedAmountUsd: number | null;
  amountMinUsd: number | null;
  amountMaxUsd: number | null;
  side: FindWalletSide;
  tolerancePct: number;
  lookbackHours: number;
  mode: "browse" | "range" | "amount";
  poolsSearched: number;
  tradesScanned: number;
  matches: FindWalletMatch[];
  nearMisses?: FindWalletMatch[];
  hint?: string | null;
};

export type FindWalletError = { ok: false; error: string };

/** Parse amounts like 49300, $49.3K, 49.3k, 1.2M. Empty → null. */
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

export function parseLookbackHours(raw: unknown): FindWalletLookbackHours {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (n === 1 || n === 6 || n === 24 || n === 72 || n === 168) return n;
  return 24;
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

function withinLookback(iso: string | null, lookbackHours: number): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return true;
  const cutoff = Date.now() - lookbackHours * 3600 * 1000;
  return t >= cutoff;
}

function inAmountRange(usd: number, min: number | null, max: number | null): boolean {
  if (min != null && usd < min) return false;
  if (max != null && usd > max) return false;
  return true;
}

/** Distance outside range (0 if inside). Used to rank near-misses. */
function rangeDistance(usd: number, min: number | null, max: number | null): number {
  if (min != null && usd < min) return min - usd;
  if (max != null && usd > max) return usd - max;
  return 0;
}

function positiveOrNull(n: number | null | undefined): number | null {
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Find wallets by CA + optional USD range (or legacy center amount ± tolerance).
 * Uses GeckoTerminal recent trades (typically last ~24h, up to ~300 per pool).
 */
export async function findWalletsByTradeAmount(opts: {
  ca: string;
  /** Explicit range (preferred). */
  amountMinUsd?: number | null;
  amountMaxUsd?: number | null;
  /** Legacy: center amount; converted to range via tolerancePct when min/max omitted. */
  amountUsd?: number | null;
  side?: FindWalletSide;
  tolerancePct?: number;
  lookbackHours?: number;
  maxPools?: number;
}): Promise<FindWalletResult | FindWalletError> {
  const tolerancePct = Math.min(50, Math.max(1, opts.tolerancePct ?? 10));
  const lookbackHours = parseLookbackHours(opts.lookbackHours ?? 24);

  let amountMinUsd = positiveOrNull(opts.amountMinUsd);
  let amountMaxUsd = positiveOrNull(opts.amountMaxUsd);
  const amountUsd = positiveOrNull(opts.amountUsd);
  const softBandPct = 12; // when only Min or only Max is set (FOMO paste)

  // Legacy single amount → range via tolerance
  if (amountMinUsd == null && amountMaxUsd == null && amountUsd != null) {
    amountMinUsd = amountUsd * (1 - tolerancePct / 100);
    amountMaxUsd = amountUsd * (1 + tolerancePct / 100);
  }

  // One-sided FOMO paste → soft ± band (exact FOMO USD rarely matches DEX USD 1:1)
  let usedSoftBand = false;
  if (amountMinUsd != null && amountMaxUsd == null && opts.amountUsd == null) {
    const center = amountMinUsd;
    amountMinUsd = center * (1 - softBandPct / 100);
    amountMaxUsd = center * (1 + softBandPct / 100);
    usedSoftBand = true;
  } else if (amountMaxUsd != null && amountMinUsd == null && opts.amountUsd == null) {
    const center = amountMaxUsd;
    amountMinUsd = center * (1 - softBandPct / 100);
    amountMaxUsd = center * (1 + softBandPct / 100);
    usedSoftBand = true;
  }

  if (amountMinUsd != null && amountMaxUsd != null && amountMinUsd > amountMaxUsd) {
    return { ok: false, error: "Min amount cannot be greater than max amount." };
  }

  const hasRange = amountMinUsd != null || amountMaxUsd != null;
  const browse = !hasRange;
  const mode: FindWalletResult["mode"] =
    browse ? "browse" : amountUsd != null && opts.amountMinUsd == null && opts.amountMaxUsd == null
      ? "amount"
      : "range";

  const side: FindWalletSide = opts.side ?? (browse ? "any" : "buy");
  // Fewer pools = less GT rate-limit risk
  const maxPools = Math.min(3, Math.max(1, opts.maxPools ?? (browse ? 3 : 2)));

  const resolved = await resolveMemeAgentContract(opts.ca, "auto");
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const chain = resolved.chain;
  const contractAddress = resolved.contractAddress;
  const geckoNet = geckoNetworkForChain(chain);

  let symbol: string | null = resolved.pairSymbol ?? null;
  let dexPairs: DexPair[] = [];
  try {
    dexPairs = await searchDexScreenerTokenPairs(contractAddress);
    const onChain = dexPairs.filter(
      (p) =>
        (p.chainId || "").toLowerCase() === chain ||
        (chain === "ethereum" && (p.chainId || "").toLowerCase() === "eth")
    );
    const best: DexPair | undefined = (onChain.length ? onChain : dexPairs).sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
    )[0];
    if (best?.baseToken?.symbol) symbol = best.baseToken.symbol;
  } catch {
    /* optional */
  }

  let pools = await resolveGeckoPoolsForToken({
    tokenAddress: contractAddress,
    networkId: geckoNet,
    dexPairs,
  });
  pools = pools.slice(0, maxPools);
  if (pools.length === 0) {
    return {
      ok: false,
      error:
        "No DEX pools found for this CA (GeckoTerminal + DexScreener). Verify the contract or try again in a minute.",
    };
  }

  const apiMinVolume = browse
    ? 100
    : Math.max(1, Math.min(amountMinUsd ?? 100, amountUsd ?? amountMinUsd ?? 100) * 0.75);

  const allTrades: Array<GtTrade & { poolAddress: string; poolName: string | null; networkId: string }> = [];
  let rateLimited = false;

  // Sequential fetches — parallel GT calls often all return 429
  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 350));
    let { trades, rateLimited: rl } = await getGeckoPoolTrades({
      networkId: pool.networkId,
      poolAddress: pool.poolAddress,
      minVolumeUsd: apiMinVolume,
    });
    if (rl) rateLimited = true;
    // Fallback: unfiltered recent trades if floor returned nothing
    if (trades.length === 0 && apiMinVolume > 100) {
      await new Promise((r) => setTimeout(r, 400));
      const retry = await getGeckoPoolTrades({
        networkId: pool.networkId,
        poolAddress: pool.poolAddress,
        minVolumeUsd: 100,
      });
      if (retry.rateLimited) rateLimited = true;
      trades = retry.trades;
    }
    for (const t of trades) {
      allTrades.push({
        ...t,
        poolAddress: pool.poolAddress,
        poolName: pool.name,
        networkId: pool.networkId,
      });
    }
  }

  const toMatch = (
    t: (typeof allTrades)[0],
    diffPct: number | null,
    extra?: Partial<FindWalletMatch>
  ): FindWalletMatch => {
    const explorers = explorerBase(t.networkId);
    const gmgn = gmgnChainSlug(t.networkId);
    return {
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
      ...extra,
    };
  };

  const center =
    amountUsd ??
    (amountMinUsd != null && amountMaxUsd != null
      ? (amountMinUsd + amountMaxUsd) / 2
      : amountMinUsd ?? amountMaxUsd);

  const matches: FindWalletMatch[] = [];
  for (const t of allTrades) {
    if (side !== "any" && t.kind !== side) continue;
    if (!withinLookback(t.timestamp, lookbackHours)) continue;
    if (!browse && !inAmountRange(t.volumeUsd, amountMinUsd, amountMaxUsd)) continue;

    const diffPct = center != null ? shortDiffPct(t.volumeUsd, center) : null;
    matches.push(toMatch(t, diffPct));
  }

  if (browse) {
    matches.sort(
      (a, b) =>
        (b.timestamp || "").localeCompare(a.timestamp || "") || b.amountUsd - a.amountUsd
    );
  } else {
    matches.sort(
      (a, b) =>
        b.amountUsd - a.amountUsd || (b.timestamp || "").localeCompare(a.timestamp || "")
    );
  }

  const seen = new Set<string>();
  const unique = matches.filter((m) => {
    const k = `${m.wallet}:${m.txHash}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let nearMisses: FindWalletMatch[] | undefined;
  let hint: string | null = null;

  if (!browse && unique.length === 0) {
    const candidates: FindWalletMatch[] = [];
    for (const t of allTrades) {
      if (side !== "any" && t.kind !== side) continue;
      const inWindow = withinLookback(t.timestamp, lookbackHours);
      const inRange = inAmountRange(t.volumeUsd, amountMinUsd, amountMaxUsd);
      const reasons: string[] = [];
      if (!inWindow) reasons.push(`outside ${lookbackHours}h timeframe`);
      if (!inRange) {
        if (amountMinUsd != null && t.volumeUsd < amountMinUsd) {
          reasons.push(`below min $${amountMinUsd.toLocaleString()}`);
        } else if (amountMaxUsd != null && t.volumeUsd > amountMaxUsd) {
          reasons.push(`above max $${amountMaxUsd.toLocaleString()}`);
        }
      }
      candidates.push(
        toMatch(t, center != null ? shortDiffPct(t.volumeUsd, center) : null, {
          nearMiss: true,
          nearMissReason: reasons.join(" · ") || "close but not in range",
        })
      );
    }
    candidates.sort((a, b) => {
      const da = rangeDistance(a.amountUsd, amountMinUsd, amountMaxUsd);
      const db = rangeDistance(b.amountUsd, amountMinUsd, amountMaxUsd);
      return da - db || (b.timestamp || "").localeCompare(a.timestamp || "");
    });
    const nearSeen = new Set<string>();
    nearMisses = candidates
      .filter((m) => {
        const k = `${m.wallet}:${m.txHash}`.toLowerCase();
        if (nearSeen.has(k)) return false;
        nearSeen.add(k);
        return true;
      })
      .slice(0, 10);

    const rangeLabel =
      amountMinUsd != null && amountMaxUsd != null
        ? `$${amountMinUsd.toLocaleString()}–$${amountMaxUsd.toLocaleString()}`
        : amountMinUsd != null
          ? `≥$${amountMinUsd.toLocaleString()}`
          : `≤$${amountMaxUsd!.toLocaleString()}`;

    if (nearMisses.length > 0) {
      hint = `No ${side} in ${rangeLabel} within the last ${lookbackHours}h. Closest trades below — widen range or timeframe (FOMO USD can differ from DEX).`;
    } else if (allTrades.length === 0 && rateLimited) {
      hint =
        "GeckoTerminal rate-limited this search (0 trades returned). Wait a few seconds and search again — do not spam Find wallet.";
    } else if (allTrades.length === 0) {
      hint =
        "No recent pool trades loaded. Wait a few seconds and retry, or widen timeframe.";
    } else {
      hint = `Scanned ${allTrades.length} trades but found no ${side}s to compare. Try Side: Any or browse CA alone.`;
    }
  } else if (usedSoftBand && unique.length > 0) {
    hint = `Min-only search uses a ±${softBandPct}% band around your amount (FOMO size vs DEX USD). Set both Min and Max for a hard range.`;
  }

  return {
    ok: true,
    chain,
    contractAddress,
    symbol,
    queriedAmountUsd: amountUsd,
    amountMinUsd,
    amountMaxUsd,
    side,
    tolerancePct,
    lookbackHours,
    mode,
    poolsSearched: pools.length,
    tradesScanned: allTrades.length,
    matches: unique.slice(0, browse ? 50 : 40),
    nearMisses,
    hint,
  };
}
