/** Shared defaults + helpers for GMGN VIP Bot entry/risk rules. */

export const GMGN_BOT_RULES_PATH = "/gmgn-vip-bot-rules";

export const GMGN_BOT_DEFAULTS = {
  minLiquidityUsd: 15_000,
  minMomentum1hPct: 0,
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

export function parseWalletAddresses(raw: unknown, legacy: string | null): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const w of raw) {
      if (typeof w === "string") {
        const v = w.trim();
        if (v && !out.includes(v)) out.push(v);
      }
    }
    if (out.length) return out;
  }
  const legacyTrim = legacy?.trim();
  return legacyTrim ? [legacyTrim] : [];
}

export function validateWalletList(
  wallets: string[]
): { ok: true; wallets: string[] } | { ok: false; error: string } {
  const cleaned = wallets.map((w) => w.trim()).filter(Boolean);
  if (!cleaned.length) {
    return { ok: false, error: "Add at least one GMGN-bound wallet for trading." };
  }
  for (const w of cleaned) {
    const check = validateGmgnWalletAddress(w);
    if (!check.ok) return { ok: false, error: check.error };
  }
  return { ok: true, wallets: cleaned };
}

export function resolveWalletForChain(chain: string, wallets: string[]): string | null {
  for (const w of wallets) {
    const check = validateGmgnWalletAddress(w);
    if (!check.ok) continue;
    if (chain === "sol" && check.kind === "sol") return w.trim();
    if (chain !== "sol" && check.kind === "evm") return w.trim();
  }
  return null;
}

export function walletHintForChains(chains: string[]): string {
  const hasSol = chains.includes("sol");
  const hasEvm = chains.some((c) => c === "bsc" || c === "robinhood" || c === "eth");
  if (hasSol && hasEvm) {
    return "Add one Solana wallet and one EVM wallet (0x…) if you trade both. GMGN uses the matching address per chain when executing.";
  }
  if (hasSol) return "Solana wallet (base58), e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
  return "EVM wallet (0x…), must match the wallet bound to your GMGN API key.";
}
