export type AnalyzerChain = "solana" | "bsc";
export type AnalyzerPeriod = "24h" | "7d" | "30d";

export type AnalyzerHolding = {
  mint: string;
  symbol: string | null;
  name: string | null;
  uiAmount: number;
  priceUsd: number | null;
  valueUsd: number | null;
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
