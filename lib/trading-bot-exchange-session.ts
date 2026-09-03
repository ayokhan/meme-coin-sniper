/**
 * Unified exchange session resolver for Trading Bot — Blofin or Coinbase.
 */
import type { Session } from "next-auth";
import type { BlofinConfig } from "@/lib/blofin";
import type { CoinbaseConfig } from "@/lib/coinbase";
import { resolveBlofinConfigForTradingBotSession, getTradingBotBlofinMeta } from "@/lib/trading-bot-blofin-session";
import { resolveCoinbaseConfigForTradingBotSession, getTradingBotCoinbaseMeta } from "@/lib/trading-bot-coinbase-session";
import { prisma } from "@/lib/db";

export type ExchangeProvider = "blofin" | "coinbase";

export async function getTradingBotProvider(): Promise<ExchangeProvider> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bot = await (prisma as any).tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    const p = String(bot?.provider ?? "blofin").toLowerCase();
    return p === "coinbase" ? "coinbase" : "blofin";
  } catch {
    return "blofin";
  }
}

export type ExchangeResolveResult =
  | { ok: true; provider: ExchangeProvider; blofin?: BlofinConfig; coinbase?: CoinbaseConfig; credentialSource: "saved" | "server" }
  | { ok: false; status: number; error: string };

export function parseExchangeProviderParam(raw: unknown): ExchangeProvider | null {
  const p = String(raw ?? "").trim().toLowerCase();
  if (p === "blofin" || p === "coinbase") return p;
  return null;
}

export async function resolveExchangeConfigForTradingBotSession(
  session: Session | null,
  opts?: { provider?: ExchangeProvider | null }
): Promise<ExchangeResolveResult> {
  const provider = opts?.provider ?? (await getTradingBotProvider());
  if (provider === "coinbase") {
    const resolved = await resolveCoinbaseConfigForTradingBotSession(session);
    if (!resolved.ok) return resolved;
    return { ok: true, provider, coinbase: resolved.config, credentialSource: resolved.credentialSource };
  }
  const resolved = await resolveBlofinConfigForTradingBotSession(session);
  if (!resolved.ok) return resolved;
  return { ok: true, provider, blofin: resolved.config, credentialSource: resolved.credentialSource };
}

export type ExchangePanelMeta = {
  provider: ExchangeProvider;
  demo: boolean;
  credentialSource: "saved" | "server";
  modeMismatchHint?: string;
  /** Legacy field for Blofin panel */
  blofinDemo?: boolean;
  /** Legacy field for Coinbase panel */
  coinbaseDemo?: boolean;
};

export async function getTradingBotExchangeMeta(
  provider: ExchangeProvider,
  credentialSource: "saved" | "server",
  config: BlofinConfig | CoinbaseConfig
): Promise<ExchangePanelMeta> {
  if (provider === "coinbase") {
    const meta = await getTradingBotCoinbaseMeta(config as CoinbaseConfig, credentialSource);
    return {
      provider,
      demo: meta.coinbaseDemo,
      coinbaseDemo: meta.coinbaseDemo,
      credentialSource: meta.credentialSource,
      modeMismatchHint: meta.modeMismatchHint,
    };
  }
  const meta = await getTradingBotBlofinMeta(config as BlofinConfig, credentialSource);
  return {
    provider,
    demo: meta.blofinDemo,
    blofinDemo: meta.blofinDemo,
    credentialSource: meta.credentialSource,
    modeMismatchHint: meta.modeMismatchHint,
  };
}
