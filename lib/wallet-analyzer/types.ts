export type AnalyzerChain = "solana" | "bsc";
export type AnalyzerPeriod = "30m" | "1h" | "2h" | "4h" | "8h" | "24h" | "7d" | "30d";

export type AnalyzerHolding = {
  mint: string;
  symbol: string | null;
  name: string | null;
  uiAmount: number;
  priceUsd: number | null;
  valueUsd: number | null;
  /** Earliest BUY timestamp for this mint within the analyzed window. */
  firstBuyAtMs: number | null;
  /** % of acquired tokens already sold (capped at 100). null if no buys seen in window. */
  pctSold: number | null;
  /** % of acquired tokens still held (currentHolding / totalReceived × 100). null if no buys seen. */
  pctHeld: number | null;
  /** True if the wallet's verdict is at least Moderate AND this position is still > 30% held OR realized PnL > 0. */
  recommendedCopy: boolean;
  /** Realized USD on this token across the window. May be 0 if never sold. */
  realizedUsd: number;
};

export type AnalyzerTrade = {
  signature: string | null;
  timestampMs: number;
  action: "buy" | "sell" | "swap";
  mint: string;
  symbol: string | null;
  nativeDelta: number; // SOL or BNB, signed (positive = wallet received native)
  tokenDelta: number; // signed (positive = wallet received token)
  notionalUsd: number; // abs(nativeDelta) × native price (USD)
};

export type AnalyzerPosition = {
  mint: string;
  symbol: string | null;
  trades: number;
  buys: number;
  sells: number;
  spentNative: number;
  receivedNative: number;
  realizedNative: number;
  realizedUsd: number;
  realizedPct: number | null; // (realizedUsd / cost-basis USD) × 100
  currentHoldingUiAmount: number;
  currentHoldingUsd: number | null;
  firstBuyAtMs: number | null;
  tokensReceived: number;
  tokensSold: number;
  pctSold: number | null;
  pctHeld: number | null;
  recommendedCopy: boolean;
};

export type AnalyzerVerdict = {
  label: "Strong copy" | "Moderate copy" | "Mixed signal" | "Avoid";
  score: number;
  reasons: string[];
  cautions: string[];
};

export type WalletAnalysis = {
  chain: AnalyzerChain;
  walletAddress: string;
  period: AnalyzerPeriod;
  generatedAtMs: number;
  nativeSymbol: "SOL" | "BNB";
  nativePriceUsd: number;
  totals: {
    realizedPnlUsd: number;
    realizedPnlPct: number | null; // realized USD relative to total cost-basis USD
    volumeUsd: number;
    tradeCount: number;
    winRatePct: number | null;
    biggestWinSymbol: string | null;
    biggestWinPnlUsd: number | null;
    biggestLossSymbol: string | null;
    biggestLossPnlUsd: number | null;
    holdingsValueUsd: number;
    uniqueMints: number;
  };
  positions: AnalyzerPosition[];
  trades: AnalyzerTrade[];
  holdings: AnalyzerHolding[];
  verdict: AnalyzerVerdict;
  notes: string[];
};
