/** External meme-token deep links used in Go Hunting tables and related rows. */

export type MemeLinkChain = "solana" | "sol" | "bsc" | "eth" | "ethereum";

export function fomoTokenUrl(contractAddress: string, chain: MemeLinkChain = "solana"): string {
  const ca = encodeURIComponent(contractAddress.trim());
  const slug = chain === "bsc" ? "bnb" : chain === "eth" || chain === "ethereum" ? "ethereum" : "solana";
  return `https://fomo.family/tokens/${slug}/${ca}`;
}
