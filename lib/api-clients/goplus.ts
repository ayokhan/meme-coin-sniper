/**
 * GoPlus Security free API client.
 *
 * Docs: https://docs.gopluslabs.io/
 * - Free, no API key required (public, rate-limited).
 * - EVM token security:   GET /api/v1/token_security/{chain_id}?contract_addresses=...
 *   chain_id: 1 = Ethereum, 56 = BSC.
 * - Solana token security: GET /api/v1/solana/token_security?contract_addresses={mint}
 *
 * Legacy helpers (checkSolanaTokenSecurity / checkBscTokenSecurity / calculateSecurityScore /
 * getTopHolderPercentage / getSecuritySummary / isLPLocked) are kept for the existing
 * /api/scan, /api/scan-twitter, ai-analyze, ai-analyze-bsc consumers.
 *
 * New helpers (getEvmTokenSecurity / getSolanaTokenSecurity) return richer normalized
 * shapes used by the Deep Meme Agent.
 */

import axios from "axios";

// ====================================================================
// Legacy API (do not remove — used by /api/scan, /api/scan-twitter, lib/ai-analyze*).
// ====================================================================

export interface GoPlusSecurityData {
  is_honeypot: string;
  is_mintable: string;
  holder_count: string;
  holders: Array<{ percent: string }>;
  lp_holders: Array<{ address: string; percent: string }>;
}

export async function checkSolanaTokenSecurity(mintAddress: string): Promise<GoPlusSecurityData | null> {
  try {
    const response = await axios.get("https://api.gopluslabs.io/api/v1/token_security/solana", {
      params: { contract_addresses: mintAddress.toLowerCase() },
      timeout: 10000,
    });
    return response.data.result?.[mintAddress.toLowerCase()] || null;
  } catch {
    return null;
  }
}

/** BSC (Binance Smart Chain) token security. Chain id 56. */
export async function checkBscTokenSecurity(contractAddress: string): Promise<GoPlusSecurityData | null> {
  try {
    const addr = contractAddress.replace(/^0x/, "").toLowerCase();
    const response = await axios.get("https://api.gopluslabs.io/api/v1/token_security/56", {
      params: { contract_addresses: addr },
      timeout: 10000,
    });
    return response.data.result?.[addr] || null;
  } catch {
    return null;
  }
}

export function calculateSecurityScore(data: GoPlusSecurityData): number {
  let score = 100;
  if (data.is_honeypot === "1") return 0;
  if (data.is_mintable === "1") score -= 30;
  if (data.holders?.length) {
    const topPct = parseFloat(data.holders[0].percent) * 100;
    if (topPct > 50) score -= 30;
    else if (topPct > 30) score -= 15;
  }
  return Math.max(0, score);
}

export function getTopHolderPercentage(data: GoPlusSecurityData): number {
  return data.holders?.length ? parseFloat(data.holders[0].percent) * 100 : 0;
}

export function isLPLocked(data: GoPlusSecurityData): boolean {
  const topLP = data.lp_holders?.[0]?.address.toLowerCase() || "";
  return ["1111111111111111111111111111111", "null"].some((addr) => topLP.includes(addr));
}

export function getSecuritySummary(data: GoPlusSecurityData) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (data.is_honeypot === "1") issues.push("🚨 HONEYPOT");
  if (data.is_mintable === "1") warnings.push("⚠️ Mintable");
  const topPct = getTopHolderPercentage(data);
  if (topPct > 30) warnings.push(`⚠️ Top holder: ${topPct.toFixed(1)}%`);
  return { issues, warnings };
}

// ====================================================================
// Deep Meme Agent: richer normalized shapes.
// ====================================================================

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";

export type GoPlusHolder = {
  address: string;
  tag: string | null;
  isContract: boolean;
  balance: string;
  percent: number;
  isLocked: boolean;
};

export type GoPlusEvmTokenSecurity = {
  chain: "ethereum" | "bsc";
  tokenName: string | null;
  tokenSymbol: string | null;
  totalSupply: number | null;
  holderCount: number | null;
  ownerAddress: string | null;
  creatorAddress: string | null;
  isHoneypot: boolean | null;
  isMintable: boolean | null;
  isProxy: boolean | null;
  canTakeBackOwnership: boolean | null;
  hiddenOwner: boolean | null;
  selfdestruct: boolean | null;
  externalCall: boolean | null;
  transferPausable: boolean | null;
  slippageModifiable: boolean | null;
  isAntiWhale: boolean | null;
  buyTaxPct: number | null;
  sellTaxPct: number | null;
  lpHolderCount: number | null;
  lpTotalSupply: number | null;
  holders: GoPlusHolder[];
  lpHolders: GoPlusHolder[];
  rawNote: string | null;
};

export type GoPlusSolanaTokenSecurity = {
  chain: "solana";
  tokenName: string | null;
  tokenSymbol: string | null;
  totalSupply: number | null;
  holderCount: number | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  creatorAddress: string | null;
  isHoneypot: boolean | null;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  holders: GoPlusHolder[];
  lpHolders: GoPlusHolder[];
  rawNote: string | null;
};

type RawHolder = {
  address?: string;
  tag?: string | null;
  is_contract?: number | string | boolean;
  balance?: string | number;
  percent?: string | number;
  is_locked?: number | string | boolean;
};

type RawEvmEntry = Record<string, unknown> & {
  token_name?: string;
  token_symbol?: string;
  total_supply?: string | number;
  holder_count?: string | number;
  owner_address?: string;
  creator_address?: string;
  is_honeypot?: string;
  is_mintable?: string;
  is_proxy?: string;
  can_take_back_ownership?: string;
  hidden_owner?: string;
  selfdestruct?: string;
  external_call?: string;
  transfer_pausable?: string;
  slippage_modifiable?: string;
  is_anti_whale?: string;
  buy_tax?: string;
  sell_tax?: string;
  lp_holder_count?: string | number;
  lp_total_supply?: string | number;
  holders?: RawHolder[];
  lp_holders?: RawHolder[];
  note?: string;
};

function toBool01(v: unknown): boolean | null {
  if (v === undefined || v === null || v === "") return null;
  if (v === 1 || v === true) return true;
  if (v === 0 || v === false) return false;
  if (typeof v === "string") {
    if (v === "1" || v.toLowerCase() === "true") return true;
    if (v === "0" || v.toLowerCase() === "false") return false;
  }
  return null;
}

function toBool(v: unknown): boolean {
  return toBool01(v) === true;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeHolders(arr: RawHolder[] | undefined | null): GoPlusHolder[] {
  if (!Array.isArray(arr)) return [];
  const out: GoPlusHolder[] = [];
  for (const h of arr) {
    const address = String(h?.address ?? "").trim();
    if (!address) continue;
    const percentRaw = toNum(h?.percent);
    const percent = percentRaw == null ? 0 : percentRaw <= 1 ? percentRaw * 100 : percentRaw;
    const tag: string | null = h?.tag == null ? null : String(h.tag);
    out.push({
      address,
      tag,
      isContract: toBool(h?.is_contract),
      balance: String(h?.balance ?? "0"),
      percent,
      isLocked: toBool(h?.is_locked),
    });
  }
  return out;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 12000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "NovaStaris/1.0 (+https://novastaris.ai)" },
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Fetch EVM token security from GoPlus. */
export async function getEvmTokenSecurity(
  contractAddress: string,
  chain: "ethereum" | "bsc",
): Promise<GoPlusEvmTokenSecurity | null> {
  const addr = (contractAddress || "").trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(addr)) return null;
  const chainId = chain === "ethereum" ? 1 : 56;
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${addr}`;
  const data = (await fetchJsonWithTimeout(url, 12000)) as
    | { code?: number; message?: string; result?: Record<string, RawEvmEntry> }
    | null;
  if (!data?.result) return null;
  const entry =
    (data.result[addr] as RawEvmEntry | undefined) ??
    (data.result[addr.toLowerCase()] as RawEvmEntry | undefined) ??
    Object.values(data.result)[0];
  if (!entry || typeof entry !== "object") return null;

  const taxBuy = toNum(entry.buy_tax);
  const taxSell = toNum(entry.sell_tax);
  return {
    chain,
    tokenName: (entry.token_name as string) || null,
    tokenSymbol: (entry.token_symbol as string) || null,
    totalSupply: toNum(entry.total_supply),
    holderCount: toNum(entry.holder_count),
    ownerAddress: (entry.owner_address as string) || null,
    creatorAddress: (entry.creator_address as string) || null,
    isHoneypot: toBool01(entry.is_honeypot),
    isMintable: toBool01(entry.is_mintable),
    isProxy: toBool01(entry.is_proxy),
    canTakeBackOwnership: toBool01(entry.can_take_back_ownership),
    hiddenOwner: toBool01(entry.hidden_owner),
    selfdestruct: toBool01(entry.selfdestruct),
    externalCall: toBool01(entry.external_call),
    transferPausable: toBool01(entry.transfer_pausable),
    slippageModifiable: toBool01(entry.slippage_modifiable),
    isAntiWhale: toBool01(entry.is_anti_whale),
    buyTaxPct: taxBuy == null ? null : taxBuy <= 1 ? taxBuy * 100 : taxBuy,
    sellTaxPct: taxSell == null ? null : taxSell <= 1 ? taxSell * 100 : taxSell,
    lpHolderCount: toNum(entry.lp_holder_count),
    lpTotalSupply: toNum(entry.lp_total_supply),
    holders: normalizeHolders(entry.holders),
    lpHolders: normalizeHolders(entry.lp_holders),
    rawNote: (entry.note as string) || null,
  };
}

/** Fetch Solana token security from GoPlus. */
export async function getSolanaTokenSecurity(mint: string): Promise<GoPlusSolanaTokenSecurity | null> {
  const addr = (mint || "").trim();
  if (!addr || addr.length < 32 || addr.length > 44) return null;
  const url = `${GOPLUS_BASE}/solana/token_security?contract_addresses=${encodeURIComponent(addr)}`;
  type SolEntry = Record<string, unknown> & {
    metadata?: { name?: string; symbol?: string };
    token_name?: string;
    token_symbol?: string;
    total_supply?: string | number;
    holder_count?: string | number;
    mint_authority?: string | { address?: string } | null;
    freeze_authority?: string | { address?: string } | null;
    creator?: Array<{ address?: string; malicious_address?: number }>;
    holders?: RawHolder[];
    lp_holders?: RawHolder[];
    note?: string;
  };
  const data = (await fetchJsonWithTimeout(url, 12000)) as
    | { code?: number; message?: string; result?: Record<string, SolEntry> }
    | null;
  if (!data?.result) return null;
  const entry = (data.result[addr] as SolEntry | undefined) ?? Object.values(data.result)[0];
  if (!entry || typeof entry !== "object") return null;

  const metadataName = entry.metadata?.name ?? (entry.token_name as string | undefined) ?? null;
  const metadataSymbol = entry.metadata?.symbol ?? (entry.token_symbol as string | undefined) ?? null;
  const mintAuthority =
    typeof entry.mint_authority === "string"
      ? entry.mint_authority
      : entry.mint_authority && typeof entry.mint_authority === "object" && "address" in entry.mint_authority
        ? ((entry.mint_authority as { address?: string }).address ?? null)
        : null;
  const freezeAuthority =
    typeof entry.freeze_authority === "string"
      ? entry.freeze_authority
      : entry.freeze_authority && typeof entry.freeze_authority === "object" && "address" in entry.freeze_authority
        ? ((entry.freeze_authority as { address?: string }).address ?? null)
        : null;
  const creator = Array.isArray(entry.creator) ? entry.creator[0]?.address ?? null : null;

  return {
    chain: "solana",
    tokenName: metadataName ?? null,
    tokenSymbol: metadataSymbol ?? null,
    totalSupply: toNum(entry.total_supply),
    holderCount: toNum(entry.holder_count),
    mintAuthority,
    freezeAuthority,
    creatorAddress: creator,
    isHoneypot: null,
    mintAuthorityRevoked: mintAuthority == null,
    freezeAuthorityRevoked: freezeAuthority == null,
    holders: normalizeHolders(entry.holders),
    lpHolders: normalizeHolders(entry.lp_holders),
    rawNote: (entry.note as string) || null,
  };
}
