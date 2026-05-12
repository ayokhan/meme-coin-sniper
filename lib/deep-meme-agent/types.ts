export type DeepChain = "solana" | "bsc" | "ethereum";

export type HolderClass =
  | "dev"
  | "lp"
  | "exchange"
  | "burn"
  | "contract"
  | "whale"
  | "sniper"
  | "bot"
  | "pro"
  | "fresh"
  | "holder";

export type AnalyzedHolder = {
  rank: number;
  address: string;
  /** Token-account address for SPL holders (Solana only); for EVM same as owner address. */
  tokenAccount?: string | null;
  tag: string | null;
  isContract: boolean;
  balance: number | null;
  balanceFormatted: string;
  percentOfSupply: number;
  isLocked: boolean;
  classes: HolderClass[];
  reasons: string[];
};

export type SecurityFlag = {
  key: string;
  label: string;
  /** "good" - positive trait, "warn" - caution, "bad" - red flag, "info" - neutral fact. */
  level: "good" | "warn" | "bad" | "info";
  value?: string;
};

export type DeepMemeReport = {
  ok: true;
  chain: DeepChain;
  contract: string;
  /** Token overview from Dexscreener (best pair). */
  token: {
    name: string | null;
    symbol: string | null;
    priceUsd: number | null;
    marketCapUsd: number | null;
    fdvUsd: number | null;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    txns24h: { buys: number; sells: number } | null;
    priceChange24hPct: number | null;
    pairCreatedAtMs: number | null;
    dexUrl: string | null;
    pairAddress: string | null;
    socials: { website: string | null; twitter: string | null; telegram: string | null };
  };
  /** Security flags from GoPlus + heuristics. */
  security: {
    flags: SecurityFlag[];
    isHoneypotLikely: boolean;
    isRugLikely: boolean;
    lpLocked: boolean;
    lpBurnedOrLocked: boolean;
    /** Top-10 holders share of supply (excluding LPs and burn). */
    topTenSharePct: number | null;
    holderCount: number | null;
    devWallet: string | null;
    ownerWallet: string | null;
    mintAuthority?: string | null;
    freezeAuthority?: string | null;
  };
  holders: AnalyzedHolder[];
  lpHolders: AnalyzedHolder[];
  /** Final recommendation. */
  recommendation: {
    verdict: "good_buy" | "speculative" | "caution" | "avoid";
    score: number; // 0-100
    summary: string;
    pros: string[];
    cons: string[];
  };
  /** Where data came from + degradation notes. */
  sources: {
    dexscreener: boolean;
    goplus: boolean;
    helius: boolean;
  };
  /** Optional notes (e.g. partial data warnings). */
  notes: string[];
  generatedAtMs: number;
};

export type DeepMemeError = { ok: false; error: string; status?: number };

export type DeepMemeResult = DeepMemeReport | DeepMemeError;
