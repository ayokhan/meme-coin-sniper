/**
 * Detect Solana vs EVM from a pasted CA, then resolve 0x addresses to BSC or ETH
 * via a live DexScreener pool. Robinhood / Base / other EVMs are not analyzed.
 */

import {
  getBscToken,
  getEthToken,
  searchDexScreenerTokenPairs,
  type DexPair,
} from "@/lib/api-clients/dexscreener";
import {
  detectMemeContractFormat,
  memeAgentChainLabel,
  type MemeAgentChain,
  type MemeAgentChainMode,
} from "@/lib/meme-contract-format";

export type { MemeAgentChain, MemeAgentChainMode, MemeContractFormat } from "@/lib/meme-contract-format";
export { detectMemeContractFormat, memeAgentChainLabel, normalizeMemeContract } from "@/lib/meme-contract-format";

function bestPairOnChains(pairs: DexPair[], ids: string[]): DexPair | null {
  const matched = pairs.filter((p) => ids.includes((p.chainId || "").toLowerCase()));
  if (!matched.length) return null;
  const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
  return matched.sort((a, b) => usd(b) - usd(a))[0];
}

export type ResolveMemeAgentOk = {
  ok: true;
  chain: MemeAgentChain;
  contractAddress: string;
  pairSymbol?: string;
};

export type ResolveMemeAgentErr = {
  ok: false;
  error: string;
};

export async function resolveMemeAgentContract(
  input: string,
  mode: MemeAgentChainMode = "auto"
): Promise<ResolveMemeAgentOk | ResolveMemeAgentErr> {
  const raw = (input || "").trim();
  if (!raw) return { ok: false, error: "Enter a contract address." };

  const format = detectMemeContractFormat(raw);

  if (mode === "solana" || (mode === "auto" && format === "solana")) {
    if (format !== "solana") {
      return { ok: false, error: "That is not a Solana mint. Paste a base58 CA, or leave chain on Auto." };
    }
    return { ok: true, chain: "solana", contractAddress: raw };
  }

  if (format !== "evm") {
    return {
      ok: false,
      error: "Paste a Solana mint (base58) or an EVM contract (0x + 40 hex). Robinhood and other chains are not in this agent yet.",
    };
  }

  const ca = raw.toLowerCase();
  const want = mode === "bsc" || mode === "ethereum" ? mode : null;

  if (want === "bsc") {
    const pair = await getBscToken(ca);
    if (!pair) {
      return { ok: false, error: "No BSC pool found for this 0x contract on DexScreener." };
    }
    return { ok: true, chain: "bsc", contractAddress: ca, pairSymbol: pair.baseToken?.symbol };
  }
  if (want === "ethereum") {
    const pair = await getEthToken(ca);
    if (!pair) {
      return { ok: false, error: "No Ethereum pool found for this 0x contract on DexScreener." };
    }
    return { ok: true, chain: "ethereum", contractAddress: ca, pairSymbol: pair.baseToken?.symbol };
  }

  const [searchPairs, bscPair, ethPair] = await Promise.all([
    searchDexScreenerTokenPairs(ca),
    getBscToken(ca),
    getEthToken(ca),
  ]);

  const bsc = bscPair ?? bestPairOnChains(searchPairs, ["bsc", "bnb"]);
  const eth = ethPair ?? bestPairOnChains(searchPairs, ["ethereum", "eth"]);

  if (bsc) {
    return { ok: true, chain: "bsc", contractAddress: ca, pairSymbol: bsc.baseToken?.symbol };
  }
  if (eth) {
    return { ok: true, chain: "ethereum", contractAddress: ca, pairSymbol: eth.baseToken?.symbol };
  }

  const otherIds = [
    ...new Set(
      searchPairs
        .map((p) => (p.chainId || "").toLowerCase())
        .filter((id) => id && id !== "bsc" && id !== "bnb" && id !== "ethereum" && id !== "eth" && id !== "solana")
    ),
  ];
  if (otherIds.length) {
    const names = otherIds.map((id) => memeAgentChainLabel(id)).join(", ");
    return {
      ok: false,
      error: `Found a pool on ${names}, which this agent does not analyze yet. Paste a Solana mint or a BSC/ETH 0x contract.`,
    };
  }

  return {
    ok: false,
    error:
      "No pool found on Solana, BSC, or Ethereum. Robinhood, Base, and other EVMs are not in this agent yet.",
  };
}
