/**
 * GeckoTerminal public API — pool search + recent trades (maker wallet + USD notional).
 * Docs: https://api.geckoterminal.com/docs/index.html
 */

const GT_BASE = "https://api.geckoterminal.com/api/v2";

export type GtPoolHit = {
  networkId: string;
  poolAddress: string;
  name: string | null;
  reserveUsd: number | null;
};

export type GtTrade = {
  kind: "buy" | "sell" | string;
  volumeUsd: number;
  wallet: string;
  txHash: string;
  timestamp: string | null;
  blockNumber: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Map DexScreener / app chain ids → GeckoTerminal network slug. */
export function geckoNetworkForChain(chain: string): string | null {
  const c = chain.toLowerCase();
  if (c === "solana" || c === "sol") return "solana";
  if (c === "bsc" || c === "bnb") return "bsc";
  if (c === "ethereum" || c === "eth") return "eth";
  if (c === "robinhood") return "robinhood";
  if (c === "hyperevm" || c === "hyperliquid") return "hyperevm";
  if (c === "base") return "base";
  return null;
}

type GtPoolRow = {
  id?: string;
  attributes?: { name?: string; address?: string; reserve_in_usd?: string };
  relationships?: { network?: { data?: { id?: string } } };
};

function parsePoolRows(rows: GtPoolRow[] | undefined): GtPoolHit[] {
  const out: GtPoolHit[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const id = String(row.id ?? "");
    const underscore = id.indexOf("_");
    const networkId =
      row.relationships?.network?.data?.id ||
      (underscore > 0 ? id.slice(0, underscore) : "");
    const poolAddress = String(
      row.attributes?.address ?? (underscore > 0 ? id.slice(underscore + 1) : "")
    ).trim();
    if (!networkId || !poolAddress) continue;
    const key = `${networkId}:${poolAddress.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      networkId,
      poolAddress,
      name: row.attributes?.name ?? null,
      reserveUsd: num(row.attributes?.reserve_in_usd),
    });
  }
  return out.sort((a, b) => (b.reserveUsd ?? 0) - (a.reserveUsd ?? 0));
}

async function gtFetchJson(url: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

export async function searchGeckoPoolsByToken(tokenAddress: string): Promise<GtPoolHit[]> {
  const q = encodeURIComponent(tokenAddress.trim());
  const { ok, json } = await gtFetchJson(`${GT_BASE}/search/pools?query=${q}`);
  if (!ok) return [];
  return parsePoolRows((json as { data?: GtPoolRow[] } | null)?.data);
}

/** Prefer this when chain is known — more reliable than global search (avoids empty/rate-limit misses). */
export async function getGeckoTokenPools(networkId: string, tokenAddress: string): Promise<GtPoolHit[]> {
  const url = `${GT_BASE}/networks/${encodeURIComponent(networkId)}/tokens/${encodeURIComponent(tokenAddress.trim())}/pools`;
  const { ok, json } = await gtFetchJson(url);
  if (!ok) return [];
  return parsePoolRows((json as { data?: GtPoolRow[] } | null)?.data);
}

/** Build GT pool hits from DexScreener pairs when Gecko search is empty/rate-limited. */
export function poolsFromDexPairs(
  pairs: Array<{
    chainId?: string;
    pairAddress?: string;
    baseToken?: { symbol?: string };
    quoteToken?: { symbol?: string };
    liquidity?: { usd?: number };
  }>,
  preferredNetwork?: string | null
): GtPoolHit[] {
  const out: GtPoolHit[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    const networkId = geckoNetworkForChain(p.chainId || "");
    const poolAddress = String(p.pairAddress || "").trim();
    if (!networkId || !poolAddress) continue;
    if (preferredNetwork && networkId.toLowerCase() !== preferredNetwork.toLowerCase()) continue;
    const key = `${networkId}:${poolAddress.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const base = p.baseToken?.symbol || "?";
    const quote = p.quoteToken?.symbol || "?";
    out.push({
      networkId,
      poolAddress,
      name: `${base} / ${quote}`,
      reserveUsd: typeof p.liquidity?.usd === "number" ? p.liquidity.usd : null,
    });
  }
  return out.sort((a, b) => (b.reserveUsd ?? 0) - (a.reserveUsd ?? 0));
}

/**
 * Resolve pools for a token: token-pools (if network known) + search, then DexScreener fallback.
 */
export async function resolveGeckoPoolsForToken(opts: {
  tokenAddress: string;
  networkId?: string | null;
  dexPairs?: Parameters<typeof poolsFromDexPairs>[0];
}): Promise<GtPoolHit[]> {
  const token = opts.tokenAddress.trim();
  const net = opts.networkId?.trim() || null;

  const [tokenPools, searched] = await Promise.all([
    net ? getGeckoTokenPools(net, token) : Promise.resolve([] as GtPoolHit[]),
    searchGeckoPoolsByToken(token),
  ]);

  const merged: GtPoolHit[] = [];
  const seen = new Set<string>();
  for (const p of [...tokenPools, ...searched]) {
    const key = `${p.networkId}:${p.poolAddress.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(p);
  }

  let pools = merged;
  if (net) {
    const filtered = pools.filter((p) => p.networkId.toLowerCase() === net.toLowerCase());
    if (filtered.length) pools = filtered;
  }

  if (pools.length === 0 && opts.dexPairs?.length) {
    pools = poolsFromDexPairs(opts.dexPairs, net);
  }

  return pools.sort((a, b) => (b.reserveUsd ?? 0) - (a.reserveUsd ?? 0));
}

export async function getGeckoPoolTrades(opts: {
  networkId: string;
  poolAddress: string;
  minVolumeUsd?: number;
}): Promise<GtTrade[]> {
  const min = opts.minVolumeUsd != null && opts.minVolumeUsd > 0 ? opts.minVolumeUsd : 0;
  const qs = min > 0 ? `?trade_volume_in_usd_greater_than=${encodeURIComponent(String(min))}` : "";
  const url = `${GT_BASE}/networks/${encodeURIComponent(opts.networkId)}/pools/${encodeURIComponent(opts.poolAddress)}/trades${qs}`;
  const { ok, json } = await gtFetchJson(url);
  if (!ok) return [];
  const data = (json as {
    data?: Array<{
      attributes?: {
        kind?: string;
        volume_in_usd?: string;
        tx_from_address?: string;
        tx_hash?: string;
        block_timestamp?: string;
        block_number?: number;
      };
    }>;
  } | null)?.data;

  const out: GtTrade[] = [];
  for (const row of data ?? []) {
    const a = row.attributes;
    if (!a) continue;
    const volumeUsd = num(a.volume_in_usd) ?? 0;
    const wallet = String(a.tx_from_address ?? "").trim();
    const txHash = String(a.tx_hash ?? "").trim();
    if (!wallet || !txHash || volumeUsd <= 0) continue;
    out.push({
      kind: String(a.kind ?? "").toLowerCase() || "unknown",
      volumeUsd,
      wallet,
      txHash,
      timestamp: a.block_timestamp ?? null,
      blockNumber: typeof a.block_number === "number" ? a.block_number : null,
    });
  }
  return out;
}
