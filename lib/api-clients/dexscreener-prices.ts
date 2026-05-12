/**
 * Dexscreener price helpers (free, no API key required).
 * - Bulk Solana mint pricing via /latest/dex/tokens/{addresses}.
 * - Wrapped SOL price for SOL/USD conversion.
 *
 * Dexscreener limits unauthenticated requests; we batch (max 30 mints per call)
 * and cache hot prices in-memory for 60s to keep usage low.
 */

const DEXSCREENER_BASE = "https://api.dexscreener.com";
const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const PRICE_CACHE_MS = 60_000;

type DexPairLite = {
  chainId?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
};

type CachedPrice = {
  priceUsd: number;
  symbol?: string;
  cachedAt: number;
};

const priceCache = new Map<string, CachedPrice>();

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Returns priceUsd for each mint we can resolve. Mints with no Dexscreener pair are simply omitted. */
export async function getSolanaTokenPricesUsd(mints: string[]): Promise<Map<string, { priceUsd: number; symbol?: string }>> {
  const out = new Map<string, { priceUsd: number; symbol?: string }>();
  const now = Date.now();
  const dedup = Array.from(new Set(mints.filter(Boolean)));
  const missing: string[] = [];

  for (const mint of dedup) {
    const hit = priceCache.get(mint);
    if (hit && now - hit.cachedAt < PRICE_CACHE_MS) {
      out.set(mint, { priceUsd: hit.priceUsd, symbol: hit.symbol });
    } else {
      missing.push(mint);
    }
  }

  if (missing.length === 0) return out;

  const batches = chunk(missing, 30);
  for (const batch of batches) {
    try {
      const url = `${DEXSCREENER_BASE}/latest/dex/tokens/${batch.join(",")}`;
      const res = await fetch(url, {
        cache: "no-store",
        next: { revalidate: 0 },
        headers: { accept: "application/json" },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: DexPairLite[] };
      const pairs = Array.isArray(data?.pairs) ? data.pairs : [];

      const best = new Map<string, DexPairLite>();
      for (const p of pairs) {
        if (p?.chainId !== "solana") continue;
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const liq = p.liquidity?.usd ?? 0;
        const prev = best.get(addr);
        const prevLiq = prev?.liquidity?.usd ?? -1;
        if (liq >= prevLiq) best.set(addr, p);
      }

      for (const mint of batch) {
        const p = best.get(mint);
        const priceUsdRaw = p?.priceUsd ? Number(p.priceUsd) : NaN;
        if (!Number.isFinite(priceUsdRaw) || priceUsdRaw <= 0) continue;
        const entry = { priceUsd: priceUsdRaw, symbol: p?.baseToken?.symbol };
        out.set(mint, entry);
        priceCache.set(mint, { ...entry, cachedAt: now });
      }
    } catch {
      // skip batch on transient errors
    }
  }

  return out;
}

/** Fetch current SOL/USD. Cached for 60s. */
export async function getSolUsdPrice(): Promise<number> {
  const map = await getSolanaTokenPricesUsd([WRAPPED_SOL_MINT]);
  const sol = map.get(WRAPPED_SOL_MINT);
  if (sol && sol.priceUsd > 0) return sol.priceUsd;
  // Fallback: a small constant so the leaderboard still renders meaningful numbers.
  return 150;
}
