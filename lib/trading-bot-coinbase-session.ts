import type { Session } from "next-auth";
import { canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { getConfig, type CoinbaseConfig } from "@/lib/coinbase";
import { getCoinbaseConfigForUser } from "@/lib/coinbase-user-config";
import { prisma } from "@/lib/db";
import { getFeatureFlag } from "@/lib/feature-flags";
import { FEATURE_FLAG_KEYS } from "@/lib/feature-flag-keys";

export type TradingBotCoinbaseResolveResult =
  | { ok: true; config: CoinbaseConfig; credentialSource: "saved" | "server" }
  | { ok: false; status: number; error: string };

export type TradingBotCoinbaseMeta = {
  coinbaseDemo: boolean;
  credentialSource: "saved" | "server";
  modeMismatchHint?: string;
};

export async function isCoinbaseTradingEnabled(session: Session | null): Promise<boolean> {
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.COINBASE_TRADING);
  if (!enabled) return false;
  const ownerOnly = await getFeatureFlag(FEATURE_FLAG_KEYS.COINBASE_TRADING_OWNER_ONLY);
  if (ownerOnly && !isOwnerSession(session)) return false;
  return true;
}

export async function resolveCoinbaseConfigForTradingBotSession(
  session: Session | null
): Promise<TradingBotCoinbaseResolveResult> {
  if (!canAccessTradingBot(session)) {
    return { ok: false, status: 403, error: "Not authorized." };
  }
  const coinbaseOn = await isCoinbaseTradingEnabled(session);
  if (!coinbaseOn) {
    return { ok: false, status: 403, error: "Coinbase trading is disabled. Contact admin." };
  }
  const userId = session?.user?.id;
  if (!userId || typeof userId !== "string") {
    return { ok: false, status: 401, error: "Sign in required." };
  }
  const saved = await getCoinbaseConfigForUser(userId);
  let config = saved;
  let credentialSource: "saved" | "server" = saved ? "saved" : "server";
  if (!config && isOwnerSession(session)) {
    config = getConfig();
    credentialSource = "server";
  }
  if (!config) {
    return {
      ok: false,
      status: 400,
      error: isOwnerSession(session)
        ? "Coinbase API keys not configured. Set COINBASE_* in server env or save keys in Trading Bot settings."
        : "Add your Coinbase API keys in Trading Bot settings. Your account only uses your keys—not the server's.",
    };
  }
  return { ok: true, config, credentialSource };
}

export async function getTradingBotCoinbaseMeta(
  config: CoinbaseConfig,
  credentialSource: "saved" | "server"
): Promise<TradingBotCoinbaseMeta> {
  const coinbaseDemo = await getTradingBotCoinbaseDemoFlag(config.demo);
  const envDemo = process.env.COINBASE_SANDBOX_MODE === "true";
  let modeMismatchHint: string | undefined;
  if (credentialSource === "server" && coinbaseDemo !== envDemo) {
    modeMismatchHint = `Panels query Coinbase ${coinbaseDemo ? "Sandbox" : "Live"} (bot Config mode). COINBASE_SANDBOX_MODE is ${envDemo ? "true" : "false"}.`;
  }
  return { coinbaseDemo, credentialSource, modeMismatchHint };
}

export async function getTradingBotCoinbaseDemoFlag(fallbackFromKeys: boolean): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bot = await (prisma as any).tradingBot.findFirst({ orderBy: { updatedAt: "desc" } });
    if (bot?.mode === "live") return false;
    if (bot?.mode === "demo") return true;
  } catch {
    /* use fallback */
  }
  return fallbackFromKeys;
}
