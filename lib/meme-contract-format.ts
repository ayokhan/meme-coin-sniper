/** Client-safe Solana vs EVM CA format helpers (no DexScreener). */

export type MemeAgentChain = "solana" | "bsc" | "ethereum" | "robinhood" | "hyperevm";
export type MemeAgentChainMode = MemeAgentChain | "auto";
export type MemeContractFormat = "solana" | "evm" | "invalid";

const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;

const CHAIN_LABEL: Record<string, string> = {
  solana: "Solana",
  bsc: "BSC",
  bnb: "BSC",
  ethereum: "Ethereum",
  eth: "Ethereum",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  avalanche: "Avalanche",
  monad: "Monad",
  robinhood: "Robinhood Chain",
  hyperevm: "HyperEVM",
  hyperliquid: "Hyperliquid",
};

export function memeAgentChainLabel(chain: MemeAgentChain | string): string {
  return CHAIN_LABEL[chain.toLowerCase()] ?? chain;
}

/** Narrow unknown API/UI values to a supported meme agent chain. */
export function parseMemeAgentChain(raw: unknown): MemeAgentChain | null {
  if (
    raw === "solana" ||
    raw === "bsc" ||
    raw === "ethereum" ||
    raw === "robinhood" ||
    raw === "hyperevm"
  ) {
    return raw;
  }
  return null;
}

export function detectMemeContractFormat(input: string): MemeContractFormat {
  const raw = (input || "").trim();
  if (!raw) return "invalid";
  if (EVM_RE.test(raw)) return "evm";
  if (SOLANA_RE.test(raw) && !raw.startsWith("0x")) return "solana";
  return "invalid";
}

export function normalizeMemeContract(input: string, format: MemeContractFormat): string {
  const raw = (input || "").trim();
  if (format === "evm") return raw.toLowerCase();
  return raw;
}
