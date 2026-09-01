import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

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

function gmgnEnv(creds: GmgnCredentials): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GMGN_API_KEY: creds.apiKey,
    ...(creds.privateKey ? { GMGN_PRIVATE_KEY: creds.privateKey } : {}),
    GMGN_ALLOW_AUTOMATED_TRADES: creds.privateKey ? "1" : "0",
  };
}

async function runGmgnCli(args: string[], creds: GmgnCredentials): Promise<string> {
  const env = gmgnEnv(creds);
  const withRaw = args.includes("--raw") ? args : [...args, "--raw"];
  const localBin = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "gmgn-cli.cmd" : "gmgn-cli"
  );

  try {
    const { stdout } = await execFileAsync(localBin, withRaw, {
      env,
      timeout: 45000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  } catch {
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const { stdout } = await execFileAsync(npx, ["gmgn-cli", ...withRaw], {
      env,
      timeout: 45000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim();
  }
}

export async function gmgnCliJson<T>(args: string[], creds: GmgnCredentials): Promise<T> {
  const raw = await runGmgnCli(args, creds);
  if (!raw) throw new Error("Empty GMGN response.");
  return JSON.parse(raw) as T;
}

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
  const data = await gmgnCliJson<{ data?: GmgnTrendingToken[]; tokens?: GmgnTrendingToken[] }>(
    ["market", "trending", "--chain", chain, "--interval", "1h", "--limit", String(limit)],
    creds
  );
  const list = data.data ?? data.tokens ?? (Array.isArray(data) ? (data as GmgnTrendingToken[]) : []);
  return Array.isArray(list) ? list : [];
}

const QUOTE_TOKEN: Record<GmgnChain, string> = {
  sol: "So11111111111111111111111111111111111111112",
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  robinhood: "0x4200000000000000000000000000000000000006",
  eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
};

export async function fetchGmgnQuote(params: {
  chain: GmgnChain;
  creds: GmgnCredentials;
  fromAddress: string;
  baseToken: string;
  amountIn: string;
  slippagePct: number;
}): Promise<unknown> {
  const slippage = Math.max(0.01, Math.min(0.99, params.slippagePct / 100));
  return gmgnCliJson(
    [
      "order",
      "quote",
      "--chain",
      params.chain,
      "--from",
      params.fromAddress,
      "--base-token",
      params.baseToken,
      "--quote-token",
      QUOTE_TOKEN[params.chain],
      "--amount-in",
      params.amountIn,
      "--slippage",
      String(slippage),
    ],
    params.creds
  );
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
  const slippage = Math.max(0.01, Math.min(0.99, params.slippagePct / 100));
  return gmgnCliJson(
    [
      "swap",
      "--chain",
      params.chain,
      "--from",
      params.fromAddress,
      "--base-token",
      params.baseToken,
      "--quote-token",
      QUOTE_TOKEN[params.chain],
      "--amount-in",
      params.amountIn,
      "--slippage",
      String(slippage),
    ],
    params.creds
  );
}
