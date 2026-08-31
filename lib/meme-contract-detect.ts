/**
 * Detect Solana vs EVM from a pasted CA, then resolve 0x addresses to a supported EVM chain
 * via a live DexScreener pool.
 */

import {
  getBscToken,
  getEthToken,
  getHyperEvmToken,
  getRobinhoodToken,
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

const SUPPORTED_EVM_CHAIN_IDS = new Set([
  "bsc",
  "bnb",
  "ethereum",
  "eth",
  "robinhood",
  "hyperevm",
  "solana",
]);

const EVM_FORCE_MODES: MemeAgentChain[] = ["bsc", "ethereum", "robinhood", "hyperevm"];

function bestPairOnChains(pairs: DexPair[], ids: string[]): DexPair | null {
  const matched = pairs.filter((p) => ids.includes((p.chainId || "").toLowerCase()));
  if (!matched.length) return null;
  const usd = (p: DexPair) => p.liquidity?.usd ?? 0;
  return matched.sort((a, b) => usd(b) - usd(a))[0];
}

async function getEvmTokenForChain(chain: MemeAgentChain, ca: string): Promise<DexPair | null> {
  if (chain === "bsc") return getBscToken(ca);
  if (chain === "ethereum") return getEthToken(ca);
  if (chain === "robinhood") return getRobinhoodToken(ca);
  if (chain === "hyperevm") return getHyperEvmToken(ca);
  return null;
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
      error: "Paste a Solana mint (base58) or an EVM contract (0x + 40 hex).",
    };
  }

  const ca = raw.toLowerCase();
  const want = EVM_FORCE_MODES.includes(mode as MemeAgentChain) ? (mode as MemeAgentChain) : null;

  if (want) {
    const pair = await getEvmTokenForChain(want, ca);
    if (!pair) {
      return {
        ok: false,
        error: `No ${memeAgentChainLabel(want)} pool found for this 0x contract on DexScreener.`,
      };
    }
    return { ok: true, chain: want, contractAddress: ca, pairSymbol: pair.baseToken?.symbol };
  }

  const [searchPairs, bscPair, ethPair, robinhoodPair, hyperevmPair] = await Promise.all([
    searchDexScreenerTokenPairs(ca),
    getBscToken(ca),
    getEthToken(ca),
    getRobinhoodToken(ca),
    getHyperEvmToken(ca),
  ]);

  const bsc = bscPair ?? bestPairOnChains(searchPairs, ["bsc", "bnb"]);
  const eth = ethPair ?? bestPairOnChains(searchPairs, ["ethereum", "eth"]);
  const robinhood = robinhoodPair ?? bestPairOnChains(searchPairs, ["robinhood"]);
  const hyperevm = hyperevmPair ?? bestPairOnChains(searchPairs, ["hyperevm"]);

  // Priority: Robinhood & HyperEVM (hottest meme chains) → BSC → ETH
  if (robinhood) {
    return { ok: true, chain: "robinhood", contractAddress: ca, pairSymbol: robinhood.baseToken?.symbol };
  }
  if (hyperevm) {
    return { ok: true, chain: "hyperevm", contractAddress: ca, pairSymbol: hyperevm.baseToken?.symbol };
  }
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
        .filter((id) => id && !SUPPORTED_EVM_CHAIN_IDS.has(id))
    ),
  ];
  if (otherIds.length) {
    const names = otherIds.map((id) => memeAgentChainLabel(id)).join(", ");
    return {
      ok: false,
      error: `Found a pool on ${names}, which this agent does not analyze yet. Paste a Solana mint or a supported EVM 0x contract.`,
    };
  }

  return {
    ok: false,
    error:
      "No pool found on Solana, BSC, ETH, Robinhood Chain, or HyperEVM. Check the contract address or try Force mode.",
  };
}
