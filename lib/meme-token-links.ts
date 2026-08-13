/** External meme-token deep links used in Go Hunting tables and related rows. */

export type MemeLinkChain = "solana" | "sol" | "bsc" | "eth" | "ethereum";

export function memeLinkChainFromStored(chain?: string | null): MemeLinkChain {
  if (chain === "bsc" || chain === "bnb") return "bsc";
  if (chain === "eth" || chain === "ethereum") return "ethereum";
  return "solana";
}

export function dexscreenerTokenUrl(contractAddress: string, chain: string = "solana"): string {
  const ca = encodeURIComponent(contractAddress.trim());
  const slug =
    chain === "bsc" || chain === "bnb" ? "bsc" : chain === "eth" || chain === "ethereum" ? "ethereum" : "solana";
  return `https://dexscreener.com/${slug}/${ca}`;
}

export function fomoTokenUrl(contractAddress: string, chain: MemeLinkChain = "solana"): string {
  const ca = encodeURIComponent(contractAddress.trim());
  const slug = chain === "bsc" ? "bnb" : chain === "eth" || chain === "ethereum" ? "ethereum" : "solana";
  return `https://fomo.family/tokens/${slug}/${ca}`;
}
