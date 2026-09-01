/** Shared defaults + helpers for GMGN VIP Bot entry/risk rules. */

export const GMGN_BOT_RULES_PATH = "/gmgn-vip-bot-rules";

export const GMGN_BOT_DEFAULTS = {
  minLiquidityUsd: 15_000,
  minMomentum1hPct: 5,
  maxOpenTrades: 3,
  maxTradeUsd: 25,
  maxDailyLossUsd: 100,
  slippagePct: 15,
  stopLossPct: 20,
  takeProfitPct: 50,
  dedupeHours: 6,
  trendingLimit: 20,
} as const;

export function validateGmgnWalletAddress(raw: string): { ok: true; kind: "sol" | "evm" } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Wallet address is required for live trades." };
  if (v.includes("@")) {
    return { ok: false, error: "Enter your on-chain wallet address, not an email." };
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return { ok: true, kind: "evm" };
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return { ok: true, kind: "sol" };
  return {
    ok: false,
    error: "Use a Solana address (base58) or EVM address (0x…) bound to your GMGN API key.",
  };
}

export function walletHintForChains(chains: string[]): string {
  const hasSol = chains.includes("sol");
  const hasEvm = chains.some((c) => c === "bsc" || c === "robinhood" || c === "eth");
  if (hasSol && hasEvm) {
    return "Use the wallet GMGN bound to your API key. For multi-chain, prefer the address GMGN shows under API Management → bound wallet.";
  }
  if (hasSol) return "Solana wallet (base58), e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
  return "EVM wallet (0x…), must match the wallet bound to your GMGN API key.";
}
