/** Open NovaStaris AI Agent tab with contract prefilled. */
export const NOVASTARIS_OPEN_AI_AGENT = "novastaris-open-ai-agent";

export function openNovaStarisAiAgent(
  contractAddress: string,
  chain: "solana" | "bsc" | "ethereum" = "solana"
) {
  const ca = contractAddress.trim();
  if (!ca || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(NOVASTARIS_OPEN_AI_AGENT, {
      detail: { contractAddress: ca, chain },
    })
  );
}
