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

export async function searchGeckoPoolsByToken(tokenAddress: string): Promise<GtPoolHit[]> {
  const q = encodeURIComponent(tokenAddress.trim());
  const res = await fetch(`${GT_BASE}/search/pools?query=${q}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as {
    data?: Array<{
      id?: string;
      attributes?: { name?: string; address?: string; reserve_in_usd?: string };
      relationships?: { network?: { data?: { id?: string } } };
    }>;
  } | null;
  const out: GtPoolHit[] = [];
  const seen = new Set<string>();
  for (const row of json?.data ?? []) {
    const id = String(row.id ?? "");
    const underscore = id.indexOf("_");
    const networkId =
      row.relationships?.network?.data?.id ||
      (underscore > 0 ? id.slice(0, underscore) : "");
    const poolAddress = String(row.attributes?.address ?? (underscore > 0 ? id.slice(underscore + 1) : "")).trim();
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

export async function getGeckoPoolTrades(opts: {
  networkId: string;
  poolAddress: string;
  minVolumeUsd?: number;
}): Promise<GtTrade[]> {
  const min = opts.minVolumeUsd != null && opts.minVolumeUsd > 0 ? opts.minVolumeUsd : 0;
  const qs = min > 0 ? `?trade_volume_in_usd_greater_than=${encodeURIComponent(String(min))}` : "";
  const url = `${GT_BASE}/networks/${encodeURIComponent(opts.networkId)}/pools/${encodeURIComponent(opts.poolAddress)}/trades${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as {
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
  } | null;

  const out: GtTrade[] = [];
  for (const row of json?.data ?? []) {
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
