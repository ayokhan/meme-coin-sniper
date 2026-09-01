export type GmgnChain = "sol" | "bsc" | "robinhood" | "eth" | "base";

export type GmgnCredentials = {
  apiKey: string;
  privateKey?: string;
};

export type GmgnTrendingToken = {
  address?: string;
  token_address?: string;
  symbol?: string;
  name?: string;
  price?: number;
  liquidity?: number;
  volume?: number;
  price_change_percent?: number;
  price_change_percent1h?: number;
};

/** User-facing product name for the GMGN bot tab and panels. */
export const GMGN_BOT_DISPLAY_NAME = "GMGN Trenching Bot";
