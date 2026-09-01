import { createGmgnOpenApiClient } from "@/lib/gmgn-openapi";
import type { GmgnChain, GmgnCredentials, GmgnTrendingToken } from "@/lib/gmgn-client-types";

export type { GmgnChain, GmgnCredentials, GmgnTrendingToken } from "@/lib/gmgn-client-types";
export { GMGN_BOT_DISPLAY_NAME } from "@/lib/gmgn-client-types";

const QUOTE_TOKEN: Record<GmgnChain, string> = {
  sol: "So11111111111111111111111111111111111111112",
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  robinhood: "0x4200000000000000000000000000000000000006",
  eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
};

export function resolveServerGmgnCredentials(): GmgnCredentials | null {
  const apiKey = process.env.GMGN_API_KEY?.trim();
  if (!apiKey) return null;
  const privateKey = process.env.GMGN_PRIVATE_KEY?.trim();
  return { apiKey, privateKey: privateKey || undefined };
}

export async function fetchGmgnTrending(
  chain: GmgnChain,
  creds: GmgnCredentials,
  limit = 15
): Promise<GmgnTrendingToken[]> {
  const client = createGmgnOpenApiClient(creds);
  const data = await client.getTrendingSwaps(chain, "1h", {
    limit,
    order_by: "volume",
    direction: "desc",
  });
  const payload =
    data && typeof data === "object" && !Array.isArray((data as { rank?: unknown }).rank)
      ? ((data as { data?: { rank?: unknown[] } }).data ?? data)
      : data;
  const list = Array.isArray((payload as { rank?: unknown[] })?.rank)
    ? (payload as { rank: unknown[] }).rank
    : [];
  return list as GmgnTrendingToken[];
}

export async function fetchGmgnQuote(params: {
  chain: GmgnChain;
  creds: GmgnCredentials;
  fromAddress: string;
  baseToken: string;
  amountIn: string;
  slippagePct: number;
}): Promise<unknown> {
  const client = createGmgnOpenApiClient(params.creds);
  const from =
    params.chain === "sol" ? params.fromAddress : params.fromAddress.toLowerCase();
  return client.quoteOrder({
    chain: params.chain,
    from_address: from,
    input_token: QUOTE_TOKEN[params.chain],
    output_token: params.baseToken,
    input_amount: params.amountIn,
    slippage: params.slippagePct,
  });
}

export async function executeGmgnSwap(params: {
  chain: GmgnChain;
  creds: GmgnCredentials;
  fromAddress: string;
  baseToken: string;
  amountIn: string;
  slippagePct: number;
}): Promise<unknown> {
  if (!params.creds.privateKey) {
    throw new Error("GMGN private key required for swap execution.");
  }
  const client = createGmgnOpenApiClient(params.creds);
  const from =
    params.chain === "sol" ? params.fromAddress : params.fromAddress.toLowerCase();
  return client.swap({
    chain: params.chain,
    from_address: from,
    input_token: QUOTE_TOKEN[params.chain],
    output_token: params.baseToken,
    input_amount: params.amountIn,
    slippage: params.slippagePct,
  });
}
